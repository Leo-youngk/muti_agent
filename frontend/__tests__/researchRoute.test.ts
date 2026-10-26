import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/chat/research/route'
import type { ResearchResult } from '@/lib/types'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const request = (body: unknown) => new Request('http://localhost/api/chat/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
describe('联网资料的真实状态与降级', () => {
  it('线上缺少用户 Key 时不会消耗服务端凭据', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const response = await POST(request({ query: '测试' }))
    expect(response.status).toBe(400)
    expect((await response.json() as ResearchResult).status).toBe('unavailable')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('仅把实际取得的网页摘录和安全来源返回', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ grounding: { generic: [
      { url: 'https://example.org/doc', title: '文档', snippets: ['实际取得的网页摘录'] },
      { url: 'javascript:alert(1)', title: '不安全链接', snippets: ['不应显示'] },
    ] } }))
    vi.stubGlobal('fetch', fetch)
    const data = await (await POST(request({ query: '问题', clientSearchApiKey: 'test-only' }))).json() as ResearchResult
    expect(data.status).toBe('ready')
    expect(data.sources).toHaveLength(1)
    expect(data.sources[0]).toMatchObject({ kind: 'page_excerpt', excerpt: '实际取得的网页摘录' })
  })
  it('旧订阅只返回搜索摘要时明确标记，不声称已读取正文', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 403 })).mockResolvedValueOnce(Response.json({ web: { results: [{ url: 'https://example.org', title: '摘要', description: '只有搜索摘要' }] } }))
    vi.stubGlobal('fetch', fetch)
    const data = await (await POST(request({ query: '问题', clientSearchApiKey: 'test-only' }))).json() as ResearchResult
    expect(data).toMatchObject({ status: 'partial', sources: [{ kind: 'search_excerpt' }] })
  })
  it('失效凭据不继续尝试或返回伪造资料', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { code: 'SUBSCRIPTION_TOKEN_INVALID' } }, { status: 422 }))
    vi.stubGlobal('fetch', fetch)
    const data = await (await POST(request({ query: '问题', clientSearchApiKey: 'test-only' }))).json() as ResearchResult
    expect(data).toMatchObject({ status: 'unavailable', sources: [], error: expect.stringContaining('密钥无效') })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
