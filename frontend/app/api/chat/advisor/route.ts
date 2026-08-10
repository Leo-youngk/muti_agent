import OpenAI from 'openai'
import type { AdvisorJudgment, PriorTurn, PreviousJudgment, AdvisorId } from '@/lib/types'
import {
  buildAdvisorSystemPrompt, buildOthersAddendum, buildDebateSystemPrompt,
  serializeJudgmentTurn,
  parseJSON, extractPartialAdvisorJudgment, MAX_TOKENS_HARD_CAP,
  createSSEHelpers, makeSSEResponse, sleep,
} from '../shared'

export const runtime = 'nodejs'
export const maxDuration = 120

const TOKEN_FLUSH_MS = 50

export async function POST(request: Request) {
  let body: {
    task?: string
    priorTurn?: PriorTurn
    isFollowUp?: boolean
    model?: string
    clientApiKey?: string
    clientBaseUrl?: string
    advisorId: string
    advisorName: string
    profile: string
    previousJudgments?: PreviousJudgment[]
    mode?: 'normal' | 'debate'
    allJudgments?: Record<string, AdvisorJudgment>
    // 高级参数（来自前端设置页；undefined 或非法时用服务端默认）
    temperature?: number | 'auto'
    maxTokensCap?: number
    timeoutMs?: number
  }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const apiKey = body.clientApiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return Response.json({ error: 'API Key 未配置' }, { status: 400 })

  const rawBase = body.clientBaseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim()
  const baseURL = rawBase || undefined
  const model = body.model?.trim() || 'gpt-4o'
  // 高级参数：前端不传 / 非法时回落到服务端默认值
  const DEFAULT_MAX_TOKENS = 16_384
  const DEFAULT_TIMEOUT_MS = 120_000
  const DEFAULT_TEMPERATURE: number | 'auto' = 'auto'

  let requestedCap: number = DEFAULT_MAX_TOKENS
  if (typeof body.maxTokensCap === 'number' && Number.isFinite(body.maxTokensCap) && body.maxTokensCap >= 1024) {
    requestedCap = body.maxTokensCap
  }
  // advisor JSON 正文约 300-600 token；但推理型模型（deepseek-v4-flash、qwen、glm 等）会
  // 先输出数千 token 的思考内容，封顶过小时正式 JSON 会被截断（finish_reason=length）。
  const maxTokens = Math.min(MAX_TOKENS_HARD_CAP, requestedCap)

  let timeoutMs: number = DEFAULT_TIMEOUT_MS
  if (typeof body.timeoutMs === 'number' && Number.isFinite(body.timeoutMs) && body.timeoutMs >= 10_000) {
    timeoutMs = body.timeoutMs
  }

  // temperature：前端传 'auto' 或不传 → 先尝试 0.7，失败且报 temperature 就降级不传；
  // 前端传具体数字 → 就用这个值（失败且报 temperature 时仍然降级）。
  const initialTemperature: number | undefined =
    typeof body.temperature === 'number' && Number.isFinite(body.temperature)
      ? body.temperature
      : (body.temperature === 'auto' ? 0.7 : DEFAULT_TEMPERATURE === 'auto' ? 0.7 : DEFAULT_TEMPERATURE)
  const task = (body.task ?? '').trim()
  if (!task) return Response.json({ error: 'Task cannot be empty' }, { status: 422 })

  if (baseURL) {
    let parsed: URL
    try { parsed = new URL(baseURL) } catch {
      return Response.json({ error: `Invalid Base URL: "${baseURL}"` }, { status: 400 })
    }
    // 仅允许 http/https，挡掉 file:/ftp: 等协议被当作请求目标。
    // 本产品面向本地/自建模型，刻意不封禁 localhost/内网地址。
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return Response.json({ error: `Base URL must be http(s): "${baseURL}"` }, { status: 400 })
    }
  }

  const client = new OpenAI({ apiKey, baseURL })
  const advisorId = body.advisorId
  const advisorName = body.advisorName
  const profile = body.profile

  // 客户端断开时要把上游请求一起掐掉，否则模型会继续计费生成到结束
  let activeAbort: AbortController | null = null
  let clientAborted = false

  const reqId = Math.random().toString(36).slice(2, 8)
  const startedAt = Date.now()
  console.log(`[advisor ${reqId}] start advisor=${advisorId} model=${model} baseURL=${baseURL ?? '(env default)'}`)

  const responseStream = new ReadableStream({
    async start(controller) {
      const { send, close } = createSSEHelpers(controller)

      try {
        // 构建 system prompt
        let systemPrompt: string
        if (body.mode === 'debate' && body.allJudgments) {
          systemPrompt = buildDebateSystemPrompt(profile, body.allJudgments, advisorId)
        } else {
          systemPrompt = buildAdvisorSystemPrompt(profile)
          if (body.previousJudgments && body.previousJudgments.length > 0) {
            systemPrompt += buildOthersAddendum(
              body.previousJudgments, advisorId as AdvisorId, body.isFollowUp === true,
            )
          }
        }

        // 上一轮还原成真实的 user/assistant 对：assistant 轮必须是合法 JSON，
        // 模型对上一条 assistant 的格式模仿远强于 system prompt，喂纯文本摘要会让它这轮也吐纯文本。
        const priorMessages = body.priorTurn
          ? [
              { role: 'user' as const, content: body.priorTurn.question },
              { role: 'assistant' as const, content: serializeJudgmentTurn(body.priorTurn.judgment) },
            ]
          : []

        // 服务端重试（最多 3 次）
        // 部分网关模型（如 opencode zen 的 kimi-k3）不接受 temperature=0.7，
        // 首次失败且错误含 "temperature" 时去掉该参数重试，不消耗重试次数。
        let temperature: number | undefined = initialTemperature
        let degraded = false
        // 部分网关/推理模型不认 response_format，报错后去掉重试，同样不消耗重试次数
        let jsonMode = true
        let jsonModeDegraded = false
        // 推理模型的思考段能占掉 97% 的墙钟时间和 3/4 的 chunk，而下面只取 delta.content，
        // 思考内容拿到手就扔——白等一场，还要为解析这些 chunk 付出 CPU，并发时足以把
        // Worker 的 CPU 配额烧穿。认这个参数的网关会跳过思考，不认的静默忽略，
        // 明确报错的走下面的降级分支。
        let noThinking = true
        let noThinkingDegraded = false
        for (let attempt = 0; attempt <= 2; attempt++) {
          if (clientAborted) break
          if (attempt > 0) await sleep(500 + 500 * attempt)  // 1s, 1.5s

          // 每次尝试都重发：前端据此清掉上一次尝试已经显示出来的半截输出
          send({ event: 'advisor_start', advisorId })

          const perCallAbort = new AbortController()
          activeAbort = perCallAbort
          const timeoutId = setTimeout(() => perCallAbort.abort('per-advisor-timeout'), timeoutMs)
          let accumulated = ''
          // 逐 token 下发会让几百个字变成几百次 enqueue，按 50ms 攒批后降一个数量级
          let pending = ''
          let lastFlushAt = Date.now()
          const flushTokens = () => {
            if (!pending) return
            send({ event: 'advisor_token', advisorId, token: pending })
            pending = ''
            lastFlushAt = Date.now()
          }

          try {
            const stream = await client.chat.completions.create(
              {
                model,
                ...(temperature !== undefined ? { temperature } : {}),
                ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
                ...(noThinking ? { thinking: { type: 'disabled' as const } } : {}),
                max_tokens: maxTokens, stream: true,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...priorMessages,
                  { role: 'user', content: task },
                ],
              },
              { signal: perCallAbort.signal }
            )

            let finishReason = ''
            for await (const chunk of stream) {
              const choice = chunk.choices[0]
              const token = choice?.delta?.content ?? ''
              if (token) {
                accumulated += token
                pending += token
                if (Date.now() - lastFlushAt >= TOKEN_FLUSH_MS) flushTokens()
              }
              if (choice?.finish_reason) finishReason = choice.finish_reason
            }
            flushTokens()

            clearTimeout(timeoutId)
            const judgment = parseJSON<AdvisorJudgment>(accumulated)
              ?? extractPartialAdvisorJudgment(accumulated, advisorName)
            if (judgment) {
              console.log(`[advisor ${reqId}] done advisor=${advisorId} model=${model} attempt=${attempt} elapsedMs=${Date.now() - startedAt} finish=${finishReason}`)
              send({ event: 'advisor_complete', advisorId, judgment })
              break
            }

            // 调用本身成功，但内容解析不出判断（模型吐空白、格式跑偏、被截断）。
            // 这类失败同样值得重试——之前无条件 break，等于把剩下两次机会白扔了。
            const preview = accumulated.slice(0, 300).replace(/\n/g, ' ')
            let errorMsg: string
            if (accumulated.length === 0) {
              errorMsg = finishReason === 'content_filter'
                ? '内容被安全过滤器拦截（content_filter）'
                : `模型返回空内容（finish_reason: ${finishReason || 'unknown'}）`
            } else if (finishReason === 'length') {
              errorMsg = `输出被截断（${accumulated.length}字符，max_tokens 不够）：${preview.slice(0, 100)}…`
            } else {
              errorMsg = `JSON 解析失败（${accumulated.length}字符，finish: ${finishReason}）：${preview}…`
            }
            console.error(`[advisor ${reqId}] parse_fail advisor=${advisorId} model=${model} attempt=${attempt} elapsedMs=${Date.now() - startedAt} finish=${finishReason} accumulatedLen=${accumulated.length} error=${errorMsg}`)
            if (attempt < 2) continue
            send({ event: 'advisor_complete', advisorId, judgment: null, error: errorMsg })
            break
          } catch (err: unknown) {
            clearTimeout(timeoutId)
            flushTokens()
            if (clientAborted) break
            const isTimeout = perCallAbort.signal.aborted
            const isLastAttempt = attempt === 2

            // 检测限速错误——等更久再重试
            const errMsg = err instanceof Error ? err.message : String(err)
            const statusCode = (err as { status?: number })?.status
            const isRateLimit = statusCode === 429 || /rate.?limit|too many|quota/i.test(errMsg)

            // 模型不支持当前 temperature（如 kimi-k3 仅允许 1）：去掉后重试，只降级一次
            if (!isTimeout && !isRateLimit && !degraded && temperature !== undefined && /temperature/i.test(errMsg)) {
              degraded = true
              temperature = undefined
              console.warn(`[advisor ${reqId}] degrade temperature advisor=${advisorId} model=${model} err=${errMsg}`)
              attempt--   // 参数降级不算一次重试
              continue
            }

            // 模型不支持 JSON 模式：去掉 response_format 后重试，只降级一次
            if (!isTimeout && !isRateLimit && !jsonModeDegraded && jsonMode
                && /response_format|json_object|json mode/i.test(errMsg)) {
              jsonModeDegraded = true
              jsonMode = false
              console.warn(`[advisor ${reqId}] degrade json_mode advisor=${advisorId} model=${model} err=${errMsg}`)
              attempt--
              continue
            }

            // 网关不认 thinking 参数（OpenAI 官方这类会直接 400）：去掉后重试，只降级一次
            if (!isTimeout && !isRateLimit && !noThinkingDegraded && noThinking
                && /thinking/i.test(errMsg)) {
              noThinkingDegraded = true
              noThinking = false
              console.warn(`[advisor ${reqId}] degrade thinking advisor=${advisorId} model=${model} err=${errMsg}`)
              attempt--
              continue
            }

            if (isRateLimit && !isLastAttempt) {
              console.warn(`[advisor ${reqId}] rate_limit advisor=${advisorId} model=${model} attempt=${attempt} status=${statusCode ?? ''} elapsedMs=${Date.now() - startedAt}`)
              // 限速：等 3-6 秒再重试
              await sleep(3000 + 3000 * attempt)
              continue
            }

            if (isTimeout || isLastAttempt) {
              const salvaged = parseJSON<AdvisorJudgment>(accumulated)
                ?? extractPartialAdvisorJudgment(accumulated, advisorName)
              const detail = isTimeout
                ? `超时（已累积 ${accumulated.length} 字符）`
                : isRateLimit
                  ? `API 限速（${statusCode ?? '429'}），请稍后再试`
                  : `${statusCode ? `HTTP ${statusCode}: ` : ''}${errMsg}`
              console.error(`[advisor ${reqId}] fail advisor=${advisorId} model=${model} attempt=${attempt} isTimeout=${isTimeout} isRateLimit=${isRateLimit} status=${statusCode ?? ''} elapsedMs=${Date.now() - startedAt} accumulatedLen=${accumulated.length} salvaged=${!!salvaged} detail=${detail}`)
              send({
                event: 'advisor_complete', advisorId, judgment: salvaged,
                error: detail,
              })
              break
            }
            // 否则继续重试
            console.warn(`[advisor ${reqId}] retry advisor=${advisorId} model=${model} attempt=${attempt} err=${errMsg}`)
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[advisor ${reqId}] fatal advisor=${advisorId} model=${model} elapsedMs=${Date.now() - startedAt} error=${errMsg}`)
        send({ event: 'error', error: errMsg })
      } finally {
        close()
      }
    },
    cancel() {
      clientAborted = true
      activeAbort?.abort('client-disconnect')
      console.warn(`[advisor ${reqId}] client_disconnect advisor=${advisorId} model=${model} elapsedMs=${Date.now() - startedAt}`)
    },
  })

  return makeSSEResponse(responseStream)
}
