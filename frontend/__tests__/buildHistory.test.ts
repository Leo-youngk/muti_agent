import { describe, it, expect } from 'vitest'
import type { Message, AdvisorJudgment, HistoryMessage, PanelResult, AdvisorId, CrossAnalysis } from '@/lib/types'

// Re-implement buildHistory for testing
function buildHistory(messages: Message[]): HistoryMessage[] {
  const result: HistoryMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'panel' && msg.panel) {
      const { judgments, analysis } = msg.panel
      const parts: string[] = []
      const advisorLines = Object.values(judgments)
        .filter((j): j is AdvisorJudgment => j != null)
        .map(j => `• ${j.advisor}（${j.stance}）：${j.core_judgment}`)
      if (advisorLines.length > 0) {
        parts.push(`[上一轮顾问立场]\n${advisorLines.join('\n')}`)
      }
      if (analysis) {
        parts.push(`[主持人结论] ${analysis.conclusion.verdict}`)
      }
      if (parts.length > 0) {
        result.push({ role: 'assistant', content: parts.join('\n\n') })
      }
    }
  }
  return result.slice(-6)
}

const mockJudgment = (name: string, stance: string, core: string): AdvisorJudgment => ({
  advisor: name,
  stance: stance as AdvisorJudgment['stance'],
  core_judgment: core,
  reasoning: 'r', focus: 'f', criticism: 'c', demand: 'd', approach: 'a', blind_spot: 'b',
})

const mockPanel = (judgments: Partial<Record<AdvisorId, AdvisorJudgment>>, verdict?: string): PanelResult => ({
  judgments,
  advisorStatus: { jobs: 'done', musk: 'done', buffett: 'done', munger: 'done' },
  streamingTexts: {},
  analysisStatus: 'done',
  analysisStream: '',
  analysis: verdict ? {
    question_restate: 'q',
    disputes: [],
    conclusion: {
      core_tension: 't', top_voices: [], top_voices_reason: '',
      reference_only: [], reference_only_reason: '',
      biggest_blind_spot: '', worth_continuing: true,
      verdict, next_steps: [],
    },
  } as CrossAnalysis : undefined,
})

describe('buildHistory', () => {
  it('includes user messages', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题A' },
    ]
    const result = buildHistory(messages)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ role: 'user', content: '问题A' })
  })

  it('includes advisor stances from panel', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题' },
      {
        id: '2', role: 'panel', content: '',
        panel: mockPanel({
          jobs: mockJudgment('乔布斯', '支持', '好产品'),
          musk: mockJudgment('马斯克', '反对', '成本太高'),
        }),
      },
    ]
    const result = buildHistory(messages)
    expect(result).toHaveLength(2)
    expect(result[1].content).toContain('乔布斯（支持）：好产品')
    expect(result[1].content).toContain('马斯克（反对）：成本太高')
  })

  it('includes verdict from analysis', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题' },
      {
        id: '2', role: 'panel', content: '',
        panel: mockPanel(
          { jobs: mockJudgment('乔布斯', '支持', '好') },
          '总结判断'
        ),
      },
    ]
    const result = buildHistory(messages)
    expect(result[1].content).toContain('[主持人结论] 总结判断')
  })

  it('limits to last 6 entries', () => {
    const messages: Message[] = []
    for (let i = 0; i < 10; i++) {
      messages.push({ id: `u${i}`, role: 'user', content: `问题${i}` })
    }
    const result = buildHistory(messages)
    expect(result).toHaveLength(6)
    expect(result[0].content).toBe('问题4')
  })

  it('handles empty messages', () => {
    expect(buildHistory([])).toEqual([])
  })

  it('skips panel with no judgments and no analysis', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题' },
      { id: '2', role: 'panel', content: '', panel: mockPanel({}) },
    ]
    const result = buildHistory(messages)
    // Only the user message, panel has nothing to contribute
    expect(result).toHaveLength(1)
  })
})
