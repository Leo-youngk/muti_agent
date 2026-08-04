import type { AdvisorMeta } from './advisors'
import type { AdvisorJudgment, AdvisorStatus } from './types'

type JudgmentKey = keyof Pick<
  AdvisorJudgment,
  | 'core_judgment'
  | 'reasoning'
  | 'criticism'
  | 'focus'
  | 'demand'
  | 'approach'
  | 'blind_spot'
>

const FIELDS: Array<{ key: JudgmentKey; label: string; prominent?: boolean }> = [
  { key: 'core_judgment', label: '核心判断', prominent: true },
  { key: 'reasoning', label: '推理' },
  { key: 'criticism', label: '核心批评' },
  { key: 'focus', label: '关注焦点' },
  { key: 'demand', label: '要求改变' },
  { key: 'approach', label: '如何切入' },
  { key: 'blind_spot', label: '盲点' },
]

export function formatAgentIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}

export function getOrderedActiveAdvisors(
  advisors: AdvisorMeta[],
  status: Record<string, AdvisorStatus>,
): AdvisorMeta[] {
  return advisors.filter(({ id }) => status[id] !== undefined)
}

export function getVisibleJudgmentSections(data?: Partial<AdvisorJudgment>) {
  if (!data) return []

  return FIELDS.flatMap(field => {
    const value = data[field.key]?.trim()
    return value
      ? [{ ...field, value, prominent: field.prominent === true }]
      : []
  })
}
