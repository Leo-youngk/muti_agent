import { describe, it, expect } from 'vitest'
import type { Message, AdvisorJudgment, PanelResult, AdvisorId } from '@/lib/types'
import { buildHistory } from '@/lib/useStreaming'

const mockJudgment = (name: string, stance: string, core: string): AdvisorJudgment => ({
  advisor: name,
  stance: stance as AdvisorJudgment['stance'],
  core_judgment: core,
  reasoning: 'r', criticism: 'c', blind_spot: 'b',
})

const mockPanel = (judgments: Partial<Record<AdvisorId, AdvisorJudgment>>): PanelResult => ({
  judgments,
  advisorStatus: { jobs: 'done', musk: 'done' },
  streamingTexts: {},
})

describe('buildHistory', () => {
  it('includes user messages', () => {
    const result = buildHistory([{ id: '1', role: 'user', content: '问题A' }])
    expect(result).toEqual([{ role: 'user', content: '问题A' }])
  })

  it('summarizes panels down to stances only', () => {
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
    expect(result[1]).toEqual({ role: 'assistant', content: '[上轮] 乔布斯(支持)、马斯克(反对)' })
  })

  it('carries the target advisor own judgment when following up', () => {
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
    const content = buildHistory(messages, 'jobs')[1].content
    expect(content).toContain('[你的上轮判断] 支持：好产品')
    expect(content).toContain('[其他] 马斯克(反对)：成本太高')
  })

  it('keeps the last 4 entries in normal mode and 6 when following up', () => {
    const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`, role: 'user' as const, content: `问题${i}`,
    }))
    expect(buildHistory(messages).map(m => m.content)).toEqual(['问题6', '问题7', '问题8', '问题9'])
    expect(buildHistory(messages, 'jobs')).toHaveLength(6)
  })

  it('handles empty messages', () => {
    expect(buildHistory([])).toEqual([])
  })

  it('skips panels with no judgments', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题' },
      { id: '2', role: 'panel', content: '', panel: mockPanel({}) },
    ]
    expect(buildHistory(messages)).toHaveLength(1)
  })
})
