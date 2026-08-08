import type { AdvisorMeta } from './advisors'
import type { AdvisorJudgment, AdvisorStatus } from './types'

type JudgmentKey = keyof Pick<
  AdvisorJudgment,
  | 'core_judgment'
  | 'reasoning'
>

interface FieldSpec {
  key: JudgmentKey
  label: string
  prominent?: boolean
  /** 版面层级已足够区分，无需再占一行小标题 */
  hideLabel?: boolean
}

const FIELDS: FieldSpec[] = [
  { key: 'core_judgment', label: '核心判断', prominent: true, hideLabel: true },
  { key: 'reasoning', label: '推理', hideLabel: true },
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
      ? [{
          ...field,
          value,
          prominent: field.prominent === true,
          hideLabel: field.hideLabel === true,
        }]
      : []
  })
}

export type JudgmentSection = ReturnType<typeof getVisibleJudgmentSections>[number]
