import { describe, it, expect } from 'vitest'
import type { AdvisorJudgment } from '@/lib/types'

// Re-implement for testing (same logic as route.ts)
function extractPartialAdvisorJudgment(
  text: string,
  fallbackName: string
): AdvisorJudgment | null {
  const get = (key: string): string => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
    if (!m) return ''
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, ' ')
  }

  const core = get('core_judgment')
  if (!core) return null

  const rawStance = get('stance')
  const validStances = ['支持', '反对', '有条件支持', '需要更多信息'] as const
  const stance = (validStances as readonly string[]).includes(rawStance)
    ? rawStance as AdvisorJudgment['stance']
    : '需要更多信息'

  return {
    advisor:       get('advisor') || fallbackName,
    stance,
    core_judgment: core,
    reasoning:     get('reasoning') || '（输出被中断，无法获取完整推理）',
    focus:         get('focus')     || '—',
    criticism:     get('criticism') || '（未能完整生成）',
    demand:        get('demand')    || '—',
    approach:      get('approach')  || '—',
    blind_spot:    get('blind_spot')|| '—',
  }
}

describe('extractPartialAdvisorJudgment', () => {
  it('extracts from complete JSON text', () => {
    const text = `{"advisor": "乔布斯", "stance": "反对", "core_judgment": "这个产品缺乏灵魂", "reasoning": "理由", "focus": "焦点", "criticism": "批评", "demand": "要求", "approach": "切入", "blind_spot": "盲点"}`
    const result = extractPartialAdvisorJudgment(text, '乔布斯')
    expect(result).not.toBeNull()
    expect(result!.advisor).toBe('乔布斯')
    expect(result!.stance).toBe('反对')
    expect(result!.core_judgment).toBe('这个产品缺乏灵魂')
  })

  it('extracts from truncated JSON', () => {
    const text = `{"advisor": "马斯克", "stance": "支持", "core_judgment": "物理上可行", "reasoning": "从第一性原理`
    const result = extractPartialAdvisorJudgment(text, '马斯克')
    expect(result).not.toBeNull()
    expect(result!.core_judgment).toBe('物理上可行')
    expect(result!.reasoning).toBe('从第一性原理')
    expect(result!.criticism).toBe('（未能完整生成）')
  })

  it('returns null when no core_judgment', () => {
    const text = `{"advisor": "巴菲特", "stance": "反对"`
    const result = extractPartialAdvisorJudgment(text, '巴菲特')
    expect(result).toBeNull()
  })

  it('uses fallback name when advisor field missing', () => {
    const text = `{"core_judgment": "有潜力", "stance": "支持"}`
    const result = extractPartialAdvisorJudgment(text, '芒格')
    expect(result!.advisor).toBe('芒格')
  })

  it('defaults invalid stance to 需要更多信息', () => {
    const text = `{"core_judgment": "需要思考", "stance": "观望"}`
    const result = extractPartialAdvisorJudgment(text, 'test')
    expect(result!.stance).toBe('需要更多信息')
  })

  it('handles escaped characters in values', () => {
    const text = `{"core_judgment": "这是\\"引用\\"内容", "stance": "支持"}`
    const result = extractPartialAdvisorJudgment(text, 'test')
    expect(result!.core_judgment).toBe('这是"引用"内容')
  })
})
