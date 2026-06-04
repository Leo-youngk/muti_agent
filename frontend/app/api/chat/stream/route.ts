import OpenAI from 'openai'
import { ADVISORS } from '@/lib/advisors'
import type { AdvisorId, AdvisorJudgment, CrossAnalysis, HistoryMessage } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Prompt 构建 ───────────────────────────────────────────────────────────────

function buildAdvisorPrompt(profile: string): string {
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
5. 如果这是一个追问或后续问题，请参考之前的对话上下文，保持判断的连贯性。
6. 输出必须是纯 JSON，不要在 JSON 前后加任何文字或 markdown 标记。

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
    "top_voices": ["最值得听的2-3个人物名字"],
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

/** 从可能带有 markdown 代码块的文本中提取 JSON */
function parseJSON<T>(text: string): T | null {
  // 1. 去掉 markdown 代码块
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(stripped) as T } catch {}

  // 2. 找最外层的 { } 提取
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(stripped.slice(first, last + 1)) as T } catch {}
  }

  return null
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 400 })
  }

  const rawBase = process.env.OPENAI_BASE_URL?.trim()
  const baseURL = rawBase || undefined
  const model = process.env.AI_MODEL?.trim() || 'gpt-4o'

  if (baseURL) {
    try { new URL(baseURL) } catch {
      return Response.json({ error: `Invalid OPENAI_BASE_URL: "${baseURL}"` }, { status: 500 })
    }
  }

  let body: { task?: string; history?: HistoryMessage[] }
  try { body = await request.json() } catch { body = {} }

  const task: string = (body.task ?? '').trim()
  if (!task) return Response.json({ error: 'Task cannot be empty.' }, { status: 422 })

  // 最多保留最近 3 轮对话（6 条消息）
  const history: HistoryMessage[] = (body.history ?? []).slice(-6)

  const client = new OpenAI({ apiKey, baseURL })
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // controller 已关闭，忽略
        }
      }

      try {
        const completedJudgments: Partial<Record<AdvisorId, AdvisorJudgment>> = {}

        // ── 串行逐个调用顾问 ──────────────────────────────────────────
        for (const advisor of ADVISORS) {
          const advisorId = advisor.id as AdvisorId
          send({ event: 'advisor_start', advisorId })

          let done = false
          for (let attempt = 0; attempt <= 2 && !done; attempt++) {
            if (attempt > 0) await sleep(600 * attempt)

            try {
              const stream = await client.chat.completions.create({
                model,
                temperature: 0.85,
                stream: true,
                messages: [
                  { role: 'system', content: buildAdvisorPrompt(advisor.profile) },
                  // 注入对话历史，让顾问能感知上下文
                  ...history.map(h => ({
                    role: h.role as 'user' | 'assistant',
                    content: h.content,
                  })),
                  { role: 'user', content: task },
                ],
              })

              let accumulated = ''
              for await (const chunk of stream) {
                const token = chunk.choices[0]?.delta?.content ?? ''
                if (token) {
                  accumulated += token
                  send({ event: 'advisor_token', advisorId, token })
                }
              }

              const judgment = parseJSON<AdvisorJudgment>(accumulated)
              send({ event: 'advisor_complete', advisorId, judgment })
              if (judgment) completedJudgments[advisorId] = judgment
              done = true
            } catch (err) {
              if (attempt === 2) {
                // 三次失败后标记为错误并继续下一个顾问
                send({ event: 'advisor_complete', advisorId, judgment: null, error: String(err) })
                done = true
              }
            }
          }
        }

        // ── 交叉分析 ────────────────────────────────────────────────────
        const validEntries = Object.entries(completedJudgments).filter(([, j]) => j != null)
        if (validEntries.length > 0) {
          const judgmentsText = validEntries
            .map(([id, j]) => `【${id}】\n${JSON.stringify(j, null, 2)}`)
            .join('\n\n')

          send({ event: 'analysis_start' })

          let analysisDone = false
          for (let attempt = 0; attempt <= 2 && !analysisDone; attempt++) {
            if (attempt > 0) await sleep(600 * attempt)

            try {
              const analysisStream = await client.chat.completions.create({
                model,
                temperature: 0.7,
                stream: true,
                messages: [
                  { role: 'system', content: buildCrossAnalysisPrompt(judgmentsText) },
                  { role: 'user', content: `用户问题：${task}` },
                ],
              })

              let accumulated = ''
              for await (const chunk of analysisStream) {
                const token = chunk.choices[0]?.delta?.content ?? ''
                if (token) {
                  accumulated += token
                  send({ event: 'analysis_token', token })
                }
              }

              const analysis = parseJSON<CrossAnalysis>(accumulated)
              send({ event: 'analysis_complete', analysis })
              analysisDone = true
            } catch (err) {
              if (attempt === 2) {
                send({ event: 'analysis_complete', analysis: null, error: String(err) })
                analysisDone = true
              }
            }
          }
        }

        send({ event: 'complete' })
      } catch (err: unknown) {
        send({ event: 'error', error: err instanceof Error ? err.message : String(err) })
      } finally {
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
