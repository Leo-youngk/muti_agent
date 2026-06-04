import { describe, it, expect } from 'vitest'
import { extractStreamingFields } from '@/lib/parseStreaming'

describe('extractStreamingFields', () => {
  it('returns null for very short text', () => {
    expect(extractStreamingFields('{"a')).toBeNull()
  })

  it('extracts completed core_judgment', () => {
    const text = `{"advisor": "乔布斯", "stance": "反对", "core_judgment": "这个产品缺乏灵魂",`
    const result = extractStreamingFields(text)
    expect(result).not.toBeNull()
    expect(result!.advisor).toBe('乔布斯')
    expect(result!.stance).toBe('反对')
    expect(result!.core_judgment).toBe('这个产品缺乏灵魂')
  })

  it('extracts partial (in-progress) core_judgment', () => {
    const text = `{"advisor": "马斯克", "stance": "支持", "core_judgment": "从第一性原理来看这完全可行`
    const result = extractStreamingFields(text)
    expect(result).not.toBeNull()
    expect(result!.core_judgment).toContain('从第一性原理来看')
    expect(result!.core_judgment).toContain('…') // 标记为未完成
  })

  it('extracts multiple completed fields', () => {
    const text = `{"advisor": "巴菲特", "stance": "有条件支持", "core_judgment": "有护城河潜力", "reasoning": "十年后测试通过", "criticism": "定价权不明确",`
    const result = extractStreamingFields(text)
    expect(result!.core_judgment).toBe('有护城河潜力')
    expect(result!.reasoning).toBe('十年后测试通过')
    expect(result!.criticism).toBe('定价权不明确')
  })

  it('handles escaped characters', () => {
    const text = `{"advisor": "芒格", "core_judgment": "这是\\"最蠢的\\"假设",`
    const result = extractStreamingFields(text)
    expect(result!.core_judgment).toBe('这是"最蠢的"假设')
  })

  it('defaults invalid stance to 需要更多信息', () => {
    const text = `{"advisor": "test", "stance": "观望", "core_judgment": "观察中",`
    const result = extractStreamingFields(text)
    expect(result!.stance).toBe('需要更多信息')
  })

  it('extracts all 9 fields from complete JSON', () => {
    const text = `{"advisor": "乔布斯", "stance": "支持", "core_judgment": "A", "reasoning": "B", "focus": "C", "criticism": "D", "demand": "E", "approach": "F", "blind_spot": "G"}`
    const result = extractStreamingFields(text)
    expect(result!.advisor).toBe('乔布斯')
    expect(result!.stance).toBe('支持')
    expect(result!.core_judgment).toBe('A')
    expect(result!.reasoning).toBe('B')
    expect(result!.focus).toBe('C')
    expect(result!.criticism).toBe('D')
    expect(result!.demand).toBe('E')
    expect(result!.approach).toBe('F')
    expect(result!.blind_spot).toBe('G')
  })

  it('handles newlines in values', () => {
    const text = `{"advisor": "马斯克", "core_judgment": "第一行\\n第二行",`
    const result = extractStreamingFields(text)
    expect(result!.core_judgment).toBe('第一行\n第二行')
  })
})
