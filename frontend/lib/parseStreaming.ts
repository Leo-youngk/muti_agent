import type { AdvisorJudgment, Stance } from './types'

/**
 * 从正在流式生成的 JSON 文本中，实时提取已完成的字段。
 * 返回 Partial<AdvisorJudgment>，每个已检测到的字段都可以立即渲染。
 *
 * 这让用户在生成完成前就能看到结构化内容，感知延迟从 ~10s 降到 ~1.5s。
 */
export function extractStreamingFields(text: string): Partial<AdvisorJudgment> | null {
  const result: Partial<AdvisorJudgment> = {}
  let hasAny = false

  const get = (key: string): string | undefined => {
    // 匹配已完成的字段：key 后面有完整的 "value" 闭合引号
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*[,}]`))
    if (!m) return undefined
    return m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, ' ')
      .replace(/\\\\/g, '\\')
  }

  // 按 JSON 中字段出现顺序依次提取
  const advisor = get('advisor')
  if (advisor) { result.advisor = advisor; hasAny = true }

  const rawStance = get('stance')
  if (rawStance) {
    const valid: Stance[] = ['支持', '反对', '有条件支持', '需要更多信息']
    result.stance = valid.includes(rawStance as Stance)
      ? rawStance as Stance
      : '需要更多信息'
    hasAny = true
  }

  const fields = [
    'core_judgment', 'reasoning', 'focus', 'criticism',
    'demand', 'approach', 'blind_spot',
  ] as const

  for (const key of fields) {
    const val = get(key)
    if (val !== undefined) {
      (result as Record<string, string>)[key] = val
      hasAny = true
    }
  }

  // 特殊处理：core_judgment 可能还没闭合但已经有部分内容
  // 提取正在生成中的字段（最后一个打开的字符串值）
  if (!result.core_judgment) {
    const partial = getPartialValue(text, 'core_judgment')
    if (partial) { result.core_judgment = partial + '…'; hasAny = true }
  }
  if (result.core_judgment && !result.reasoning) {
    const partial = getPartialValue(text, 'reasoning')
    if (partial) { result.reasoning = partial + '…'; hasAny = true }
  }

  return hasAny ? result : null
}

/** 提取正在生成中（尚未闭合引号）的字段值 */
function getPartialValue(text: string, key: string): string | undefined {
  // 匹配 "key": "... 但没有闭合引号的情况
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)$`)
  const m = text.match(pattern)
  if (!m || m[1].length < 4) return undefined  // 太短的不值得显示
  return m[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
}
