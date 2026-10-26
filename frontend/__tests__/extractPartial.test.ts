import { describe, it, expect } from 'vitest'
import { extractPartialAdvisorJudgment } from '@/app/api/chat/shared'

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
    expect(result!.criticism).toBe('')
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
