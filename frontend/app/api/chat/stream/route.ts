import OpenAI from 'openai'
import { ADVISORS, getAllAdvisors } from '@/lib/advisors'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorId, AdvisorJudgment, CrossAnalysis, HistoryMessage, PreviousJudgment, CustomAdvisor } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Prompt 构建 ───────────────────────────────────────────────────────────────

function buildAdvisorSystemPrompt(profile: string): string {
  return `你是一个人物思维模拟系统。你的任务是深度还原以下人物面对一个具体问题时的判断方式。

你不是在"给建议"，你是在模拟这个人——用他的优先级、他的偏好、他的批评习惯、他的盲点来思考这个问题。

=== 人物档案 ===
${profile}
=== 档案结束 ===

要求：
1. 你的判断必须有明确立场：支持、反对、或有条件支持。不允许"既有机会也有风险"式的骑墙。
2. 你的语言风格必须匹配档案中描述的表达方式。
3. 你的批评必须从这个人物独特的思维角度出发，不能是通用商业建议。
4. 使用"以 XX 的思维方式，他大概率会……"这样的表述框架。不要写成"XX 说过……"或"XX 一定会……"。
5. 所有输出内容必须使用简体中文，包括 JSON 字段的值。
6. "stance" 字段必须从以下四个值中精确选一个，不得修改：支持、反对、有条件支持、需要更多信息
7. 输出必须是纯 JSON，不要在 JSON 前后加任何文字或 markdown 标记。

输出 JSON 格式（所有字段必须存在）：
{
  "advisor": "人物名",
  "stance": "支持 | 反对 | 有条件支持 | 需要更多信息",
  "core_judgment": "一句话核心判断，用这个人物的口吻",
  "reasoning": "3-5句话展开判断逻辑，要体现此人的思维优先级",
  "focus": "他会立刻抓住的关键问题是什么",
  "criticism": "他最尖锐的批评，用他本人的风格表达",
  "demand": "他会要求立刻做什么改变",
  "approach": "如果他亲自处理这件事，会怎么切入",
  "blind_spot": "他自己在这个问题上可能忽略或低估的东西"
}`
}

function buildFollowUpPrefix(previousJudgments: PreviousJudgment[], targetId: AdvisorId): string {
  const others = previousJudgments.filter(p => p.advisorId !== targetId)
  if (others.length === 0) return ''
  const lines = others.map(({ judgment }) =>
    `- ${judgment.advisor || targetId}（${judgment.stance}）：${judgment.core_judgment}`
  ).join('\n')
  return `[参考背景：上一轮其他顾问的立场]\n${lines}\n[以上仅供参考，请优先完整回答用户的新问题]\n---`
}

function buildCrossAnalysisPrompt(judgmentsText: string): string {
  return `你是一个主持人，负责分析一组人物顾问对同一个问题的判断。

以下是每个人物的判断结果：

=== 人物判断 ===
${judgmentsText}
=== 判断结束 ===

你的任务：
1. 找出人物之间最关键的分歧。不要罗列表面差异，要找到真正的判断冲突——两个人看同一个问题得出相反结论的地方。找 2-3 个最有意义的分歧。
2. 给出你作为主持人的最终判断。你不是在调和分歧，而是在判断：在这个具体问题上，谁的思维方式更适用。
3. 输出纯 JSON，不要有任何多余文字或 markdown。

输出 JSON 格式：
{
  "question_restate": "一句话复述用户的问题",
  "disputes": [
    {
      "between": ["人物A名字", "人物B名字"],
      "topic": "冲突点的一句话描述",
      "a_position": "人物A的立场（简述）",
      "b_position": "人物B的立场（简述）",
      "why_they_clash": "为什么这两个人会在这里冲突——各自的什么核心信念导致了分歧",
      "who_to_trust": "在当前这个具体问题上，谁的判断更值得采纳",
      "trust_reason": "为什么"
    }
  ],
  "conclusion": {
    "core_tension": "这个问题最核心的矛盾是什么",
    "top_voices": ["最值得听的2个人物名字"],
    "top_voices_reason": "为什么这几个人的判断在当前问题上最相关",
    "reference_only": ["判断只适合参考的人物名字"],
    "reference_only_reason": "为什么这几个人的判断在当前问题上不够适用",
    "biggest_blind_spot": "所有人物集体忽略的最危险盲点",
    "worth_continuing": true,
    "verdict": "2-3句话的最终判断",
    "next_steps": ["具体行动1", "具体行动2", "具体行动3"]
  }
}`
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T | null {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(stripped) as T } catch {}
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(stripped.slice(first, last + 1)) as T } catch {}
  }
  return null
}

function extractPartialAdvisorJudgment(
  text: string,
  fallbackName: string
): AdvisorJudgment | null {
  const get = (key: string): string => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
    if (!m) return ''
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, ' ')
  }

  const core = get('core_judgment')
  if (!core) return null

  const rawStance = get('stance')
  const validStances = ['支持', '反对', '有条件支持', '需要更多信息'] as const
  const stance = (validStances as readonly string[]).includes(rawStance)
    ? rawStance as AdvisorJudgment['stance']
    : '需要更多信息'

  return {
    advisor:       get('advisor') || fallbackName,
    stance,
    core_judgment: core,
    reasoning:     get('reasoning') || '（输出被中断，无法获取完整推理）',
    focus:         get('focus')     || '—',
    criticism:     get('criticism') || '（未能完整生成）',
    demand:        get('demand')    || '—',
    approach:      get('approach')  || '—',
    blind_spot:    get('blind_spot')|| '—',
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: {
    task?: string
    history?: HistoryMessage[]
    model?: string
    clientApiKey?: string
    clientBaseUrl?: string
    customProfiles?: Partial<Record<string, string>>
    targetAdvisor?: AdvisorId
    previousJudgments?: PreviousJudgment[]
    followUpAnalysis?: boolean
    /** 用户新增的自定义顾问 */
    customAdvisors?: CustomAdvisor[]
    /** 隐藏的顾问 ID */
    hiddenAdvisors?: string[]
  }
  try { body = await request.json() } catch { body = {} }

  const apiKey = body.clientApiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return Response.json({ error: 'API Key 未配置。请在设置中填写或配置环境变量 OPENAI_API_KEY。' }, { status: 400 })

  const rawBase = body.clientBaseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim()
  const baseURL = rawBase || undefined
  const model = body.model?.trim() || process.env.AI_MODEL?.trim() || 'gpt-4o'

  if (baseURL) {
    try { new URL(baseURL) } catch {
      return Response.json({ error: `Invalid Base URL: "${baseURL}"` }, { status: 500 })
    }
  }

  const task: string = (body.task ?? '').trim()
  if (!task) return Response.json({ error: 'Task cannot be empty.' }, { status: 422 })

  const history: HistoryMessage[] = (body.history ?? []).slice(-6)
  const targetAdvisor = body.targetAdvisor ?? null
  const previousJudgments: PreviousJudgment[] = body.previousJudgments ?? []
  const customProfiles: Partial<Record<string, string>> = body.customProfiles ?? {}
  const followUpAnalysis = body.followUpAnalysis ?? false

  // ── 构建本次请求的顾问列表（内置 + 自定义，去除隐藏）──
  const activeAdvisors: AdvisorMeta[] = getAllAdvisors({
    customAdvisors: body.customAdvisors ?? [],
    hiddenAdvisors: body.hiddenAdvisors ?? [],
  })

  const client = new OpenAI({ apiKey, baseURL })
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      let closed = false

      function send(data: object) {
        if (closed) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }

      // ── SSE 心跳：每 15s 发送注释行防止中间层断连 ──
      const heartbeat = setInterval(() => {
        if (closed) return
        try { controller.enqueue(encoder.encode(': keepalive\n\n')) } catch {}
      }, 15_000)

      async function runAdvisor(
        advisor: typeof ADVISORS[0],
        userMsgPrefix?: string
      ): Promise<AdvisorJudgment | null> {
        const advisorId = advisor.id as AdvisorId
        send({ event: 'advisor_start', advisorId })

        const profile = customProfiles[advisorId] || advisor.profile
        const userContent = userMsgPrefix ? `${userMsgPrefix}\n${task}` : task

        for (let attempt = 0; attempt <= 2; attempt++) {
          if (attempt > 0) await sleep(600 * attempt)

          const perCallAbort = new AbortController()
          const timeoutId = setTimeout(() => perCallAbort.abort('per-advisor-timeout'), 30_000)
          let accumulated = ''

          try {
            const stream = await client.chat.completions.create(
              {
                model, temperature: 0.85, stream: true,
                messages: [
                  { role: 'system', content: buildAdvisorSystemPrompt(profile) },
                  ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
                  { role: 'user', content: userContent },
                ],
              },
              { signal: perCallAbort.signal }
            )

            for await (const chunk of stream) {
              const token = chunk.choices[0]?.delta?.content ?? ''
              if (token) { accumulated += token; send({ event: 'advisor_token', advisorId, token }) }
            }

            clearTimeout(timeoutId)
            const judgment = parseJSON<AdvisorJudgment>(accumulated)
              ?? extractPartialAdvisorJudgment(accumulated, advisor.name)
            send({ event: 'advisor_complete', advisorId, judgment })
            return judgment
          } catch (err: unknown) {
            clearTimeout(timeoutId)
            const isTimeout = perCallAbort.signal.aborted
            const isLastAttempt = attempt === 2

            if (isTimeout || isLastAttempt) {
              const salvaged = parseJSON<AdvisorJudgment>(accumulated)
                ?? extractPartialAdvisorJudgment(accumulated, advisor.name)
              send({ event: 'advisor_complete', advisorId, judgment: salvaged,
                error: isTimeout ? `超时（已累积 ${accumulated.length} 字符）` : String(err) })
              return salvaged
            }
          }
        }
        return null
      }

      async function runCrossAnalysis(
        completedJudgments: Record<string, AdvisorJudgment>
      ) {
        const validEntries = Object.entries(completedJudgments).filter(([, j]) => j != null)
        if (validEntries.length === 0) return

        const judgmentsText = validEntries
          .map(([id, j]) => `【${id}】\n${JSON.stringify(j, null, 2)}`).join('\n\n')
        send({ event: 'analysis_start' })

        for (let attempt = 0; attempt <= 2; attempt++) {
          if (attempt > 0) await sleep(600 * attempt)
          try {
            const analysisStream = await client.chat.completions.create({
              model, temperature: 0.7, stream: true,
              messages: [
                { role: 'system', content: buildCrossAnalysisPrompt(judgmentsText) },
                { role: 'user', content: `用户问题：${task}` },
              ],
            })
            let accumulated = ''
            for await (const chunk of analysisStream) {
              const token = chunk.choices[0]?.delta?.content ?? ''
              if (token) { accumulated += token; send({ event: 'analysis_token', token }) }
            }
            send({ event: 'analysis_complete', analysis: parseJSON<CrossAnalysis>(accumulated) })
            break
          } catch (err) {
            if (attempt === 2) send({ event: 'analysis_complete', analysis: null, error: String(err) })
          }
        }
      }

      try {
        // ── 追问模式 ──────────────────────────────────────────────────────
        if (targetAdvisor) {
          const advisor = activeAdvisors.find(a => a.id === targetAdvisor)
          if (advisor) {
            const prefix = buildFollowUpPrefix(previousJudgments, targetAdvisor)
            const judgment = await runAdvisor(advisor, prefix || undefined)

            if (followUpAnalysis && judgment) {
              const allJudgments: Record<string, AdvisorJudgment> = {}
              for (const pj of previousJudgments) {
                allJudgments[pj.advisorId] = pj.judgment
              }
              allJudgments[targetAdvisor] = judgment
              await runCrossAnalysis(allJudgments)
            }
          }
          send({ event: 'complete' })
          return
        }

        // ── 全团模式（并行调用 + 交叉分析不等最慢顾问）──────────────────
        const completedJudgments: Record<string, AdvisorJudgment> = {}
        let doneCount = 0
        const total = activeAdvisors.length
        const FAST_THRESHOLD = Math.max(1, total - 1)
        const STRAGGLER_TIMEOUT = 8_000

        let analysisResolve: (() => void) | null = null
        const analysisGate = new Promise<void>(r => { analysisResolve = r })

        // 并行发起所有顾问调用
        const advisorPromises = activeAdvisors.map(async (advisor) => {
          const judgment = await runAdvisor(advisor)
          if (judgment) completedJudgments[advisor.id] = judgment
          doneCount++

          if (doneCount >= total) {
            analysisResolve?.()
          } else if (doneCount >= FAST_THRESHOLD) {
            setTimeout(() => analysisResolve?.(), STRAGGLER_TIMEOUT)
          }

          return { advisorId: advisor.id, judgment }
        })

        // 等待分析门打开（全部完成 or 3/4完成+8s超时）
        await analysisGate

        // ── 交叉分析（可能有 1 个顾问还在跑，但不等了）─────────────────
        // 分析和最后一个顾问并行执行
        const analysisPromise = runCrossAnalysis(completedJudgments)

        // 等分析完 + 所有顾问完（如果最后一个还在跑，前端已经收到分析结果了）
        await Promise.all([analysisPromise, ...advisorPromises])

        send({ event: 'complete' })
      } catch (err: unknown) {
        send({ event: 'error', error: err instanceof Error ? err.message : String(err) })
      } finally {
        clearInterval(heartbeat)
        closed = true
        controller.close()
      }
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
