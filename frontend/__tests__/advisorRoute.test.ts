import { beforeEach, describe, expect, it, vi } from 'vitest'
const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('openai', () => ({ default: class { chat = { completions: { create } } } }))
vi.mock('@/app/api/chat/shared', async importOriginal => ({ ...await importOriginal<typeof import('@/app/api/chat/shared')>(), sleep: async () => {} }))
import { POST } from '@/app/api/chat/advisor/route'

const output = { advisor: 'A', stance: '支持', core_judgment: '先验证', reasoning: '根据用户约束先验证需求。' }
const request = (extra = {}) => new Request('http://localhost/api/chat/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: '问题', model: 'test-model', clientApiKey: 'test-only-not-real', advisorId: 'a', advisorName: 'A', profile: '测试用人物档案', ...extra }) })
function stream(text: string, finish = 'stop', fail = false) {
  return (async function* () {
    yield { choices: [{ delta: { content: text }, finish_reason: null }] }
    if (fail) throw new Error('transport interrupted')
    yield { choices: [{ delta: {}, finish_reason: finish }] }
  })()
}
async function events(input: Request) {
  const response = await POST(input)
  const text = await response.text()
  return text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
}
beforeEach(() => { create.mockReset(); create.mockImplementation(async () => stream(JSON.stringify(output))) })

describe('真实路由的结果完整性', () => {
  it('仅经过字段校验的完整结果标记 done，维持已验证的 thinking 默认', async () => {
    const result = await events(request({ context: { background: ['预算只有两千'], turns: [{ question: '最新修正', judgment: { ...output, criticism: '', blind_spot: '' } }], omittedTurns: 0 } }))
    expect(result.at(-1)).toMatchObject({ event: 'advisor_complete', status: 'done', judgment: output })
    const payload = create.mock.calls[0][0]
    expect(payload.thinking).toEqual({ type: 'disabled' })
    expect(payload.messages[0].content).toContain('预算只有两千')
    expect(payload.messages.some((m: { content: string }) => m.content === '最新修正')).toBe(true)
  })
  it('即使 JSON 完整，finish_reason=length 也不能标记成功', async () => {
    create.mockImplementation(async () => stream(JSON.stringify(output), 'length'))
    expect((await events(request())).at(-1)).toMatchObject({ status: 'partial', error: expect.stringContaining('上限') })
  })
  it('无效立场或缺字段降级为部分回答，不被类型断言掩盖', async () => {
    create.mockImplementation(async () => stream(JSON.stringify({ ...output, stance: '其它', reasoning: '' })))
    expect((await events(request())).at(-1)?.status).toBe('partial')
    create.mockImplementation(async () => stream('[]'))
    expect((await events(request())).at(-1)).toMatchObject({ status: 'error', judgment: null })
  })
  it('网络错误后保留已显示内容，并明确中断', async () => {
    create.mockImplementation(async () => stream('{"advisor":"A","stance":"支持","core_judgment":"可保留的判断","reasoning":"正在继续', 'stop', true))
    const last = (await events(request())).at(-1)
    expect(last).toMatchObject({ status: 'partial', judgment: { core_judgment: '可保留的判断' } })
    expect(create).toHaveBeenCalledTimes(1)
  })
})
