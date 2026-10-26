import type { AdvisorJudgment, PanelResult, Stance } from './types'
import { extractStreamingFields } from './parseStreaming'

export const STANCES: readonly Stance[] = ['支持', '反对', '有条件支持', '需要更多信息']

/** TypeScript 断言与 JSON 可解析都不能代替运行时字段校验。 */
export function normalizeJudgment(
  value: unknown,
  expectedName: string,
  partial = false,
): AdvisorJudgment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  const text = (key: string) => typeof data[key] === 'string' ? (data[key] as string).trim() : ''
  const core = text('core_judgment')
  const reasoning = text('reasoning')
  const stance = STANCES.find(s => s === data.stance)
  if (partial ? !core && !reasoning : !core || !reasoning || !stance || !text('advisor')) return null
  return {
    advisor: expectedName || text('advisor'),
    stance: stance ?? '需要更多信息',
    core_judgment: core,
    reasoning,
    criticism: text('criticism'),
    blind_spot: text('blind_spot'),
    ...(text('focus') ? { focus: text('focus') } : {}),
    ...(text('demand') ? { demand: text('demand') } : {}),
    ...(text('approach') ? { approach: text('approach') } : {}),
  }
}

export function getPartialJudgment(text: string | undefined, name: string): AdvisorJudgment | null {
  return text ? normalizeJudgment(extractStreamingFields(text), name, true) : null
}

export function interruptAdvisor(panel: PanelResult, id: string, error: string, stopped = false): PanelResult {
  const name = panel.participants?.find(a => a.id === id)?.name || panel.judgments[id]?.advisor || id
  const saved = getPartialJudgment(panel.streamingTexts[id], name) || panel.judgments[id]
  return {
    ...panel,
    judgments: saved ? { ...panel.judgments, [id]: saved } : panel.judgments,
    advisorStatus: { ...panel.advisorStatus, [id]: saved ? 'partial' : stopped ? 'idle' : 'error' },
    advisorErrors: { ...panel.advisorErrors, [id]: error },
  }
}
