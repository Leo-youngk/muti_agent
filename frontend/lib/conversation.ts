import type { AdvisorJudgment, ConversationContext, Message, PreviousJudgment } from './types'

const clip = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit)}\n[原文过长，已截断]` : text

/** 保留原始用户背景，不把自动推断或模型建议写成已确认事实。 */
export function buildConversationContext(messages: Message[], advisorId: string): ConversationContext {
  const turns: ConversationContext['turns'] = []
  for (const message of messages) {
    if (message.role === 'user') turns.push({ question: clip(message.content, 3000) })
    if (message.role === 'panel' && turns.length > 0) {
      const judgment = message.panel?.judgments[advisorId]
      if (judgment && message.panel?.advisorStatus[advisorId] === 'done') {
        turns[turns.length - 1].judgment = {
          ...judgment,
          core_judgment: clip(judgment.core_judgment, 1200),
          reasoning: clip(judgment.reasoning, 3500),
        }
      }
    }
  }
  const recent = turns.slice(-6)
  // 保留最早的问题与最近的较早背景，截断明确可见，不创建未经确认的摘要。
  const earlier = turns.slice(0, Math.max(0, turns.length - recent.length))
  const selected = earlier.length > 5 ? [earlier[0], ...earlier.slice(-4)] : earlier
  return {
    background: selected.map((t, index) => `较早用户原文 ${index + 1}：${clip(t.question, 1000)}`),
    turns: recent,
    omittedTurns: Math.max(0, earlier.length - selected.length),
  }
}

/** 仅收集最近一次完整讨论及其后追问，避免把别的话题的各人“最新意见”拼在一起。 */
export function buildPreviousJudgments(messages: Message[]): PreviousJudgment[] {
  let start = 0
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'panel' && !messages[i].followUpMeta && !messages[i].isDebateRound) start = i
  }
  const merged = new Map<string, { judgment: AdvisorJudgment; question: string }>()
  let question = [...messages.slice(0, start)].reverse().find(m => m.role === 'user')?.content ?? ''
  for (const message of messages.slice(start)) {
    if (message.role === 'user') question = message.content
    if (message.panel) {
      for (const [id, judgment] of Object.entries(message.panel.judgments)) {
        if (judgment && message.panel.advisorStatus[id] === 'done') merged.set(id, { judgment, question })
      }
    }
  }
  return [...merged].map(([advisorId, item]) => ({ advisorId, ...item }))
}
