import type { AdvisorJudgment, PreviousJudgment, AdvisorId } from '@/lib/types'
import { stripThinkAndFence } from '@/lib/parseStreaming'

// ─── Prompt 构建 ───────────────────────────────────────────────────────────────

export function buildAdvisorSystemPrompt(profile: string): string {
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

export function buildFollowUpSystemAddendum(previousJudgments: PreviousJudgment[], targetId: AdvisorId): string {
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

export function buildDebateSystemPrompt(profile: string, allJudgments: Record<string, AdvisorJudgment>, selfId: string): string {
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

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 预处理：去掉模型可能输出的干扰内容 */
function preClean(raw: string): string {
  // 1. <think> 推理块 2. 包裹整个 JSON 的最外层 markdown 围栏
  let s = stripThinkAndFence(raw)
  // 3. 仅把「结构性」全角冒号（紧跟 key 收尾引号）修正为半角，
  //    不动字符串值内部的全角冒号——中文正文大量使用「：」，全局替换会损坏内容。
  //    同理不再全局替换全角引号：它们在字符串值里合法，全局改半角反而会注入未转义引号。
  s = s.replace(/"(\s*)：/g, '"$1:')
  return s.trim()
}

/** Escape literal newlines/tabs inside JSON string values */
function fixBrokenJSON(raw: string): string {
  let out = ''
  let inStr = false
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (ch === '\\' && inStr && i + 1 < raw.length) {
      // escaped char inside string — pass through both chars
      out += ch + raw[i + 1]
      i += 2
      continue
    }
    if (ch === '"') {
      inStr = !inStr
      out += ch
    } else if (inStr && ch === '\n') {
      out += '\\n'
    } else if (inStr && ch === '\r') {
      // skip \r (will be \r\n → \\n from the \n branch)
    } else if (inStr && ch === '\t') {
      out += '\\t'
    } else {
      out += ch
    }
    i++
  }
  return out
}

/** 去掉尾逗号: ,} → } 和 ,] → ] */
function stripTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, '$1')
}

function tryParse<T>(s: string): T | null {
  try { return JSON.parse(s) as T } catch {}
  try { return JSON.parse(fixBrokenJSON(s)) as T } catch {}
  try { return JSON.parse(stripTrailingCommas(fixBrokenJSON(s))) as T } catch {}
  return null
}

export function parseJSON<T>(text: string): T | null {
  // Direct attempt on raw text
  try { return JSON.parse(text.trim()) as T } catch {}

  const cleaned = preClean(text)

  // Try cleaned text directly
  const r1 = tryParse<T>(cleaned)
  if (r1) return r1

  // Extract outermost { ... }
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first !== -1 && last > first) {
    const r2 = tryParse<T>(cleaned.slice(first, last + 1))
    if (r2) return r2
  }

  // Last resort: from original text
  const f2 = text.indexOf('{')
  const l2 = text.lastIndexOf('}')
  if (f2 !== -1 && l2 > f2) {
    const r3 = tryParse<T>(text.slice(f2, l2 + 1))
    if (r3) return r3
  }
  return null
}

export function extractPartialAdvisorJudgment(
  text: string,
  fallbackName: string
): AdvisorJudgment | null {
  const cleaned = preClean(text)
  const get = (key: string): string => {
    // Try to match "key": "value..." — value may span lines
    const m = cleaned.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)(?:"|$)`, 's'))
    if (!m) return ''
    return m[1]
      .replace(/\r?\n/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, ' ')
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

// 硬上限放宽到 1M：部分网关模型（minimax 等）支持百万级上下文。
// 实际发送值由 maxTokensCap 决定（默认 16384），这里仅作为不截断用户设置的上限。
export const MAX_TOKENS_HARD_CAP = 1_000_000

/** 创建 SSE 发送函数和心跳，统一管理连接生命周期 */
export function createSSEHelpers(controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder()
  let closed = false

  function send(data: object) {
    if (closed) return
    try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
  }

  const heartbeat = setInterval(() => {
    if (closed) return
    try { controller.enqueue(encoder.encode(': keepalive\n\n')) } catch {}
  }, 15_000)

  function close() {
    closed = true
    clearInterval(heartbeat)
    try { controller.close() } catch {}
  }

  return { send, close, isClosed: () => closed }
}

export function makeSSEResponse(stream: ReadableStream) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
