import { beforeEach, describe, expect, it } from 'vitest'
import { modelKey, normalizeModelSelection, resolveModelTarget } from '@/lib/modelSelection'
import { getPartialJudgment, interruptAdvisor, normalizeJudgment } from '@/lib/judgment'
import { buildConversationContext, buildPreviousJudgments } from '@/lib/conversation'
import { getPanelAdvisors } from '@/lib/discussionPresentation'
import { loadSettings } from '@/lib/storage'
import type { AdvisorJudgment, Message, PanelResult } from '@/lib/types'

const judgment: AdvisorJudgment = { advisor: '顾问 A', stance: '有条件支持', core_judgment: '先验证需求', reasoning: '根据现有约束做小规模验证。', criticism: '', blind_spot: '' }
const providers = [{ id: 'one', name: '第一家', models: ['same-model'], apiKey: 'test-only-one', baseUrl: 'https://one.example/v1' }, { id: 'two', name: '第二家', models: ['same-model'], apiKey: 'test-only-two', baseUrl: 'https://two.example/v1' }]

beforeEach(() => localStorage.clear())

describe('模型身份回归', () => {
  it('同名模型选择第二家时不会调用第一家', () => {
    expect(resolveModelTarget({ providers }, modelKey('two', 'same-model'))?.provider?.baseUrl).toBe('https://two.example/v1')
    expect(resolveModelTarget({ providers }, modelKey('deleted', 'same-model'))).toBeNull()
  })
  it('迁移旧模型名后保存服务商身份，加载不注入未确认模型', () => {
    const settings = { providers, defaultModel: 'same-model' }
    expect(normalizeModelSelection(settings, 'same-model')).toBe(modelKey('one', 'same-model'))
    localStorage.setItem('advisor_settings_v2', JSON.stringify(settings))
    const loaded = loadSettings()
    expect(loaded.providers.map(p => p.models)).toEqual([['same-model'], ['same-model']])
    expect(loaded.defaultModel).toBe(modelKey('one', 'same-model'))
  })
})

describe('回答完整性回归', () => {
  it('拒绝缺少理由、无效立场和仅可解析的任意 JSON', () => {
    for (const input of [[], 1, {}, { ...judgment, reasoning: '' }, { ...judgment, stance: '随便' }]) expect(normalizeJudgment(input, 'A')).toBeNull()
    expect(normalizeJudgment(judgment, 'A')?.advisor).toBe('A')
  })
  it('停止和失败保留可读内容，而不是标记成功或清空', () => {
    const panel: PanelResult = { judgments: {}, advisorStatus: { a: 'thinking' }, streamingTexts: { a: '{"advisor":"A","stance":"支持","core_judgment":"已经生成的判断","reasoning":"还在继续' } }
    const stopped = interruptAdvisor(panel, 'a', '已停止', true)
    expect(stopped.advisorStatus.a).toBe('partial')
    expect(stopped.judgments.a?.core_judgment).toBe('已经生成的判断')
    const failed = interruptAdvisor({ ...stopped, streamingTexts: {} }, 'a', '重试失败')
    expect(failed.judgments.a).toEqual(stopped.judgments.a)
    expect(failed.advisorErrors?.a).toBe('重试失败')
    expect(getPartialJudgment('', 'A')).toBeNull()
  })
})

describe('连续对话与历史回归', () => {
  const round = (index: number, question: string): Message[] => [
    { id: `u${index}`, role: 'user', content: question },
    { id: `p${index}`, role: 'panel', content: '', panel: { judgments: { a: judgment }, advisorStatus: { a: 'done' }, streamingTexts: {} } },
  ]
  it('长对话保留最初约束和最近修正，不把模型输出当作用户事实', () => {
    const messages = [...round(0, '预算一万元，不能离职'), ...Array.from({ length: 8 }, (_, i) => round(i + 1, `补充条件${i}`)).flat(), ...round(10, '更正：预算改成两万元，仍不能离职')]
    const context = buildConversationContext(messages, 'a')
    expect(context.background.join('\n')).toContain('预算一万元，不能离职')
    expect(context.background.join('\n')).not.toContain(judgment.reasoning)
    expect(context.turns.at(-1)?.question).toContain('更正：预算改成两万元')
    expect(context.turns).toHaveLength(6)
  })
  it('新一轮讨论不会拼上旧话题中缺席顾问的观点', () => {
    const messages = [...round(0, '旧话题'), { id: 'u2', role: 'user', content: '新话题' } as Message, { id: 'p2', role: 'panel', content: '', panel: { judgments: { b: { ...judgment, advisor: 'B' } }, advisorStatus: { b: 'done' }, streamingTexts: {} } } as Message]
    expect(buildPreviousJudgments(messages).map(j => [j.advisorId, j.question])).toEqual([['b', '新话题']])
  })
  it('关闭/删除顾问不改变新历史快照，旧无档案历史也仍显示', () => {
    const snapshot = { id: 'deleted', name: '原顾问名', nameEn: '', profile: '原档案', color: '', icon: '', tagline: '' }
    const panel: PanelResult = { judgments: { deleted: judgment }, advisorStatus: { deleted: 'done' }, streamingTexts: {}, participants: [snapshot] }
    expect(getPanelAdvisors(panel, []).map(a => a.name)).toEqual(['原顾问名'])
    expect(getPanelAdvisors({ ...panel, participants: undefined }, [])[0].name).toBe(judgment.advisor)
  })
})
