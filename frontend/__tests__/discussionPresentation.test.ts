import { describe, expect, it } from 'vitest'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import {
  formatAgentIndex,
  getOrderedActiveAdvisors,
  getVisibleJudgmentSections,
} from '@/lib/discussionPresentation'

const advisor = (id: string): AdvisorMeta => ({
  id,
  name: `Agent ${id}`,
  nameEn: id,
  color: '#000000',
  icon: id,
  tagline: '',
  profile: '',
})

describe('discussion presentation', () => {
  it('preserves configured order for an arbitrary number of agents', () => {
    const advisors = Array.from({ length: 10 }, (_, i) => advisor(`a${i}`))
    const status: Record<string, AdvisorStatus> = {
      a0: 'done', a1: 'thinking', a2: 'idle', a3: 'error', a9: 'done',
    }

    expect(getOrderedActiveAdvisors(advisors, status).map(a => a.id))
      .toEqual(['a0', 'a1', 'a3', 'a9'])
  })

  it('formats stable document section numbers', () => {
    expect(formatAgentIndex(0)).toBe('01')
    expect(formatAgentIndex(8)).toBe('09')
    expect(formatAgentIndex(9)).toBe('10')
    expect(formatAgentIndex(100)).toBe('101')
  })

  it('returns every non-empty structured field in reading order', () => {
    const judgment: AdvisorJudgment = {
      advisor: 'A',
      stance: '支持',
      core_judgment: '核心',
      reasoning: '推理',
      criticism: '批评',
      focus: '焦点',
      demand: '改变',
      approach: '切入',
      blind_spot: '盲点',
    }

    expect(getVisibleJudgmentSections(judgment).map(s => s.label)).toEqual([
      '核心判断', '推理', '核心批评', '关注焦点', '要求改变', '如何切入', '盲点',
    ])
  })

  it('omits headings whose values are empty', () => {
    expect(getVisibleJudgmentSections({ core_judgment: '核心', reasoning: '' }))
      .toEqual([{ key: 'core_judgment', label: '核心判断', value: '核心', prominent: true }])
  })
})
