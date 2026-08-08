import type { AdvisorJudgment, Stance } from './types'

/**
 * 预清理：去掉推理块，并剥掉包裹整个 JSON 的 markdown 围栏。
 * 只处理最外层围栏——全局删除会把字段值里的代码块一起吃掉。
 */
export function stripThinkAndFence(raw: string): string {
  const s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const fence = /^(?:`{3,}|~{3,})[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)\r?\n?(?:`{3,}|~{3,})[ \t]*$/
  const closed = s.match(fence)
  if (closed) return closed[1]
  // 流式中途：只有开头围栏，尚未闭合
  const open = s.match(/^(?:`{3,}|~{3,})[a-zA-Z]*[ \t]*\r?\n?([\s\S]*)$/)
  if (open) return open[1]
  return s
}

/**
 * 从正在流式生成的 JSON 文本中，实时提取已完成的字段。
 * 返回 Partial<AdvisorJudgment>，每个已检测到的字段都可以立即渲染。
 */
export function extractStreamingFields(text: string): Partial<AdvisorJudgment> | null {
  const cleaned = stripThinkAndFence(text)
  const result: Partial<AdvisorJudgment> = {}
  let hasAny = false

  const get = (key: string): string | undefined => {
    const m = cleaned.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"\\s*[,}\\n]`, 's'))
    if (!m) return undefined
    return m[1].replace(/\r?\n/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, ' ')
      .replace(/\\\\/g, '\\')
  }

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

  if (!result.core_judgment) {
    const partial = getPartialValue(cleaned, 'core_judgment')
    if (partial) { result.core_judgment = partial + '…'; hasAny = true }
  }
  if (result.core_judgment && !result.reasoning) {
    const partial = getPartialValue(cleaned, 'reasoning')
    if (partial) { result.reasoning = partial + '…'; hasAny = true }
  }

  return hasAny ? result : null
}

function getPartialValue(text: string, key: string): string | undefined {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)$`, 's')
  const m = text.match(pattern)
  if (!m || m[1].length < 4) return undefined
  return m[1]
    .replace(/\r?\n/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
}
