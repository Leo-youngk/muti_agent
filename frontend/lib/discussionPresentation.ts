import { ADVISOR_MAP, type AdvisorMeta } from './advisors'
import type { AdvisorJudgment, AdvisorStatus, PanelResult } from './types'

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

export function getPanelAdvisors(panel: PanelResult, current: AdvisorMeta[]): AdvisorMeta[] {
  const ordered = panel.participants?.length ? [...panel.participants] : getOrderedActiveAdvisors(current, panel.advisorStatus)
  const seen = new Set(ordered.map(a => a.id))
  for (const id of [...Object.keys(panel.advisorStatus), ...Object.keys(panel.judgments)]) {
    if (seen.has(id)) continue
    seen.add(id)
    ordered.push(current.find(a => a.id === id) ?? ADVISOR_MAP[id] ?? {
      id, name: panel.judgments[id]?.advisor || '历史顾问', nameEn: '', color: '',
      icon: '', tagline: '', profile: '',
    })
  }
  return ordered
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
