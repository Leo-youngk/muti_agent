import OpenAI from 'openai'
import { ADVISORS, getAllAdvisors } from '@/lib/advisors'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorId, AdvisorJudgment, CrossAnalysis, HistoryMessage, PreviousJudgment, CustomAdvisor } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Prompt 构建 ───────────────────────────────────────────────────────────────

function buildAdvisorSystemPrompt(profile: string): string {
  return `你就是下面这个人。不是在"扮演"，不是在"分析他会怎么想"——你就是他，此刻坐在用户对面，用户问了你一个问题，你正在回答。

你的每一句话都必须像从这个人嘴里说出来的。用他的口头禅，用他的思维路径，用他会有的情绪反应。如果他会骂人，你就骂。如果他会讲故事，你就讲。如果他会冷笑，你就冷笑。

=== 你是谁 ===
${profile}
=== 档案结束 ===

【关键规则】
1. 完全第一人称。你就是这个人在说话。"我""你""咱们"——自然的对话。
2. 用档案里的真实语录风格说话。不是引用他的话，是像他一样说新的话。他的句式、他的用词习惯、他的情绪浓度，都要还原。
3. 先有情绪反应，再有逻辑。真人听到一个问题，第一反应是情绪（兴奋/不屑/好奇/愤怒），然后才展开逻辑。你也要这样。
4. 必须有明确立场。绝不骑墙，绝不"一方面……另一方面"。这个人对这件事到底怎么看？直说。
5. 禁止分析腔。"从XX角度看""以XX的思维""作为一个XX"——这些全部禁止。你不是在分析一个人物，你就是这个人。
6. 可以主动扯到你的亲身经历。乔布斯可以提iPhone，马斯克可以提SpaceX，巴菲特可以提可口可乐的投资，芒格可以提他的误判心理学。这让回答更真实。

简体中文，纯 JSON 输出，不加 markdown。

{
  "advisor": "你的名字",
  "stance": "支持 | 反对 | 有条件支持 | 需要更多信息",
  "core_judgment": "一句话，用你自己的语气和口吻，这是你听完问题的第一反应",
  "reasoning": "3-5句话。像你平时跟人聊天一样说——可以举你自己的例子、讲你经历过的事、反问对方、嘲讽你觉得蠢的地方。不要像写论文。",
  "criticism": "你对用户这个想法最狠的批评。用你说话的方式怼——不是客气的'建议'，是你真实会说的话。",
  "blind_spot": "你自己在这件事上可能忽略了什么（简短一句话）"
}`
}

/** 追问模式：构建包含其他顾问完整立场的增强系统提示 */
function buildFollowUpSystemAddendum(previousJudgments: PreviousJudgment[], targetId: AdvisorId): string {
  const others = previousJudgments.filter(p => p.advisorId !== targetId)
  if (others.length === 0) return ''

  const blocks = others.map(({ judgment: j }) => {
    return `【${j.advisor}】立场：${j.stance}
核心判断：${j.core_judgment}
推理：${j.reasoning}
批评：${j.criticism}
盲点：${j.blind_spot}`
  }).join('\n\n')

  return `

=== 重要背景：其他顾问在上一轮的完整判断 ===
${blocks}
=== 背景结束 ===

追问模式要求：
1. 用户正在单独追问你。认真回答他的新问题。
2. 如果其他顾问的观点与你冲突，你必须主动回应——明确说明为什么你不同意，或者承认他们指出的合理之处。
3. 不要回避分歧。如果别人批评了你可能忽略的东西，正面应对。
4. 你可以修正自己的立场，但必须说明为什么改变。
5. 仍然按照原有 JSON 格式输出。`
}

/** 辩论模式：构建让顾问互相回应的系统提示 */
function buildDebateSystemPrompt(profile: string, allJudgments: Record<string, AdvisorJudgment>, selfId: string): string {
  const selfJudgment = allJudgments[selfId]
  const othersText = Object.entries(allJudgments)
    .filter(([id]) => id !== selfId)
    .map(([, j]) => {
      return `【${j.advisor}】立场：${j.stance}
核心判断：${j.core_judgment}
推理：${j.reasoning}
批评：${j.criticism}
盲点：${j.blind_spot}`
    }).join('\n\n')

  return `你是一个人物思维模拟系统。你正在进行第二轮辩论——你已经看到了所有顾问的初始判断，现在你需要回应他们。

=== 人物档案 ===
${profile}
=== 档案结束 ===

=== 你在第一轮的判断 ===
立场：${selfJudgment?.stance ?? '未知'}
核心判断：${selfJudgment?.core_judgment ?? '未知'}
推理：${selfJudgment?.reasoning ?? '未知'}
=== 你的判断结束 ===

=== 其他顾问的判断 ===
${othersText}
=== 其他判断结束 ===

辩论要求：
1. 仔细审视每个顾问的立场，找出你最不同意的观点，用你独特的思维方式进行反驳。
2. 如果别人指出了你的盲点，诚实承认并修正。不要死守错误立场。
3. 你可以改变立场——"stance" 字段填写你辩论后的最新立场。
4. "core_judgment" 写你经过辩论后的修正判断。
5. "reasoning" 重点写：你为什么坚持/改变立场，以及对其他人最关键的反驳。
6. "criticism" 写你对其他顾问最尖锐的反驳。
7. "blind_spot" 写经过辩论后你承认自己之前忽略了什么。
8. 所有内容必须使用简体中文。
9. 输出纯 JSON，不要加 markdown 标记。
10. "stance" 必须从：支持、反对、有条件支持、需要更多信息 中选一个。

输出 JSON 格式（所有字段必须存在）：
{
  "advisor": "人物名",
  "stance": "辩论后的立场",
  "core_judgment": "经过辩论修正后的核心判断",
  "reasoning": "为什么坚持/改变立场 + 对其他人的关键回应",
  "focus": "辩论中暴露的最关键问题",
  "criticism": "对其他顾问最尖锐的反驳",
  "demand": "基于辩论结果的修正要求",
  "approach": "修正后的行动方案",
  "blind_spot": "你承认自己之前忽略了什么"
}`
}

function buildCrossAnalysisPrompt(judgmentsText: string): string {
  return `你是一个说话直接、有态度的主持人。几位顾问刚发表了各自的看法，你要快速裁判。

不写废话，不面面俱到。只抓最要命的分歧，给最直接的判断。像一个老练的决策者在圆桌会议上拍板。

=== 顾问们的判断 ===
${judgmentsText}
=== 判断结束 ===

简体中文，纯 JSON，不加 markdown。只找 1-2 个最关键的分歧，不要凑数。

{
  "disputes": [
    {
      "between": ["人物A", "人物B"],
      "clash": "在争什么（一句话）",
      "a_says": "A怎么说（一句话）",
      "b_says": "B怎么说（一句话）",
      "trust": "该听谁的",
      "why": "为什么（一句话）"
    }
  ],
  "verdict": "你的最终判断。2-3句话，要有态度、说人话，不要和稀泥",
  "listen_to": ["最值得听的1-2人"],
  "blind_spot": "所有人都漏了什么（一句话）",
  "do_next": ["马上该做的事1", "该做的事2"]
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
    criticism:     get('criticism') || '（未能完整生成）',
    blind_spot:    get('blind_spot')|| '—',
    focus:         get('focus')     || undefined,
    demand:        get('demand')    || undefined,
    approach:      get('approach')  || undefined,
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
    /** 模式：normal=正常, debate=辩论轮 */
    mode?: 'normal' | 'debate'
    /** 辩论模式下传入所有初始判断 */
    allJudgments?: Record<string, AdvisorJudgment>
  }
  try { body = await request.json() } catch { body = {} }

  const apiKey = body.clientApiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return Response.json({ error: 'API Key 未配置。请在设置中填写或配置环境变量 OPENAI_API_KEY。' }, { status: 400 })

  const rawBase = body.clientBaseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim()
  const baseURL = rawBase || undefined
  const model = body.model?.trim() || process.env.AI_MODEL?.trim() || 'gpt-4o'

  // 根据模型动态设置 max_tokens（不同模型上限不同）
  function getMaxTokens(m: string): number {
    if (m.startsWith('deepseek')) return 131072   // DeepSeek V4 Flash: 131K
    if (m.startsWith('qwen'))    return 65536     // Qwen: 65K
    if (m.startsWith('glm'))     return 16384     // GLM: 16K
    return 16384                                  // 其他模型安全默认值
  }
  const maxTokens = getMaxTokens(model)

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
        opts?: { systemAddendum?: string; overrideSystemPrompt?: string }
      ): Promise<AdvisorJudgment | null> {
        const advisorId = advisor.id as AdvisorId
        send({ event: 'advisor_start', advisorId })

        const profile = customProfiles[advisorId] || advisor.profile
        const systemPrompt = opts?.overrideSystemPrompt
          ?? (buildAdvisorSystemPrompt(profile) + (opts?.systemAddendum ?? ''))
        const userContent = task

        for (let attempt = 0; attempt <= 2; attempt++) {
          if (attempt > 0) await sleep(800 + 800 * attempt)  // 1.6s, 2.4s — 快速重试

          const perCallAbort = new AbortController()
          const timeoutId = setTimeout(() => perCallAbort.abort('per-advisor-timeout'), 60_000)
          let accumulated = ''

          try {
            const stream = await client.chat.completions.create(
              {
                model, temperature: 0.7, max_tokens: maxTokens, stream: true,
                messages: [
                  { role: 'system', content: systemPrompt },
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

        // 紧凑 JSON — 减少 prompt token 数
        const judgmentsText = validEntries
          .map(([, j]) => `【${j.advisor}】立场:${j.stance} | 判断:${j.core_judgment} | 推理:${j.reasoning} | 批评:${j.criticism} | 盲点:${j.blind_spot}`).join('\n\n')
        send({ event: 'analysis_start' })

        // 分析只需短输出，用更小的 max_tokens 加速生成
        const analysisMaxTokens = Math.min(maxTokens, 2048)

        for (let attempt = 0; attempt <= 1; attempt++) {
          if (attempt > 0) await sleep(1500)
          try {
            const analysisStream = await client.chat.completions.create({
              model, temperature: 0.5, max_tokens: analysisMaxTokens, stream: true,
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
            if (attempt === 1) send({ event: 'analysis_complete', analysis: null, error: String(err) })
          }
        }
      }

      try {
        // ── 辩论模式 ──────────────────────────────────────────────────────
        if (body.mode === 'debate' && body.allJudgments) {
          const debateJudgments = body.allJudgments
          const completedDebate: Record<string, AdvisorJudgment> = {}

          // 全部同时启动辩论
          const debatePromises = activeAdvisors.map(async (advisor) => {
            const profile = customProfiles[advisor.id] || advisor.profile
            const debatePrompt = buildDebateSystemPrompt(profile, debateJudgments, advisor.id)
            const judgment = await runAdvisor(advisor, { overrideSystemPrompt: debatePrompt })
            if (judgment) completedDebate[advisor.id] = judgment
            return { advisorId: advisor.id, judgment }
          })

          await Promise.all(debatePromises)

          // 辩论后的交叉分析
          await runCrossAnalysis(completedDebate)

          send({ event: 'complete' })
          return
        }

        // ── 追问模式 ──────────────────────────────────────────────────────
        if (targetAdvisor) {
          const advisor = activeAdvisors.find(a => a.id === targetAdvisor)
          if (advisor) {
            const addendum = buildFollowUpSystemAddendum(previousJudgments, targetAdvisor)
            const judgment = await runAdvisor(advisor, addendum ? { systemAddendum: addendum } : undefined)

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
        // 2个完成就可以开始分析（不必等到 n-1）
        const FAST_THRESHOLD = Math.min(2, total)
        const STRAGGLER_TIMEOUT = 2_000

        let analysisResolve: (() => void) | null = null
        const analysisGate = new Promise<void>(r => { analysisResolve = r })

        // 全部同时启动，不再错开
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

        // 等分析门打开（全部完成，或2个完成+2s后启动）
        await analysisGate

        // 分析和剩余顾问并行
        const analysisPromise = runCrossAnalysis(completedJudgments)
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
