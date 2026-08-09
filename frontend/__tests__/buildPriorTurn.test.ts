import { describe, it, expect } from 'vitest'
import type { Message, AdvisorJudgment, PanelResult, AdvisorId } from '@/lib/types'
import { buildPriorTurn } from '@/lib/useStreaming'
import { serializeJudgmentTurn } from '@/app/api/chat/shared'

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

describe('buildPriorTurn', () => {
  it('pairs the advisor own judgment with the question that produced it', () => {
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
    expect(buildPriorTurn(messages, 'jobs')).toEqual({
      question: '问题',
      judgment: mockJudgment('乔布斯', '支持', '好产品'),
    })
  })

  it('takes the most recent round', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题一' },
      { id: '2', role: 'panel', content: '', panel: mockPanel({ jobs: mockJudgment('乔布斯', '支持', '旧') }) },
      { id: '3', role: 'user', content: '问题二' },
      { id: '4', role: 'panel', content: '', panel: mockPanel({ jobs: mockJudgment('乔布斯', '反对', '新') }) },
    ]
    expect(buildPriorTurn(messages, 'jobs')?.question).toBe('问题二')
    expect(buildPriorTurn(messages, 'jobs')?.judgment.core_judgment).toBe('新')
  })

  it('falls back to an earlier round when the latest one failed for this advisor', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题一' },
      { id: '2', role: 'panel', content: '', panel: mockPanel({ jobs: mockJudgment('乔布斯', '支持', '旧') }) },
      { id: '3', role: 'user', content: '问题二' },
      { id: '4', role: 'panel', content: '', panel: mockPanel({ musk: mockJudgment('马斯克', '反对', '新') }) },
    ]
    expect(buildPriorTurn(messages, 'jobs')?.question).toBe('问题一')
  })

  it('returns null when the advisor has never answered', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '问题' },
      { id: '2', role: 'panel', content: '', panel: mockPanel({}) },
    ]
    expect(buildPriorTurn(messages, 'jobs')).toBeNull()
    expect(buildPriorTurn([], 'jobs')).toBeNull()
  })
})

describe('serializeJudgmentTurn', () => {
  it('emits valid JSON limited to the declared schema fields', () => {
    const j: AdvisorJudgment = {
      ...mockJudgment('乔布斯', '支持', '好产品'),
      focus: '旧字段', demand: '旧字段', approach: '旧字段',
    }
    const parsed = JSON.parse(serializeJudgmentTurn(j))
    expect(Object.keys(parsed)).toEqual([
      'advisor', 'stance', 'core_judgment', 'reasoning', 'criticism', 'blind_spot',
    ])
  })
})
