import type { ResearchResult, ResearchSource } from '@/lib/types'

export const runtime = 'nodejs'

type SearchItem = { title?: unknown; url?: unknown; snippets?: unknown; description?: unknown; extra_snippets?: unknown }

function toSources(items: unknown[], kind: ResearchSource['kind']): ResearchSource[] {
  const sources: ResearchSource[] = []
  const seen = new Set<string>()
  for (const candidate of items) {
    if (!candidate || typeof candidate !== 'object') continue
    const item = candidate as SearchItem
    if (typeof item.url !== 'string') continue
    let url: URL
    try { url = new URL(item.url) } catch { continue }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) continue
    const raw = kind === 'page_excerpt' ? item.snippets : [item.description, ...(Array.isArray(item.extra_snippets) ? item.extra_snippets : [])]
    const excerpt = (Array.isArray(raw) ? raw : []).filter((s): s is string => typeof s === 'string').join('\n').replace(/<[^>]*>/g, '').slice(0, 3000).trim()
    if (!excerpt) continue
    seen.add(url.href)
    sources.push({ id: sources.length + 1, title: typeof item.title === 'string' ? item.title.slice(0, 180) : url.hostname, url: url.href, excerpt, kind })
    if (sources.length >= 4) break
  }
  return sources
}

export async function POST(request: Request) {
  let body: { query?: string; clientSearchApiKey?: string }
  try { body = await request.json() } catch { return Response.json({ error: '查证请求格式无效' }, { status: 400 }) }
  const query = typeof body?.query === 'string' ? body.query.trim().split(/\s+/).slice(0, 75).join(' ').slice(0, 600) : ''
  if (!query) return Response.json({ error: '查证问题不能为空' }, { status: 422 })
  // 线上只接受用户自己的检索 Key，公开接口不消耗托管凭据。开发机可安全复用已有配置。
  const key = typeof body?.clientSearchApiKey === 'string' && body.clientSearchApiKey.trim()
    || (process.env.NODE_ENV !== 'production' ? process.env.BRAVE_API_KEY : '')
  if (!key) return Response.json({ status: 'unavailable', sources: [], error: '请在设置中配置 Brave Search API Key，再开启联网查证。' } satisfies ResearchResult, { status: 400 })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18_000)
  const onAbort = () => controller.abort()
  request.signal.addEventListener('abort', onAbort, { once: true })
  try {
    const url = new URL('https://api.search.brave.com/res/v1/llm/context')
    url.search = new URLSearchParams({ q: query, maximum_number_of_tokens: '4096', maximum_number_of_urls: '4', context_threshold_mode: 'strict' }).toString()
    const headers = { Accept: 'application/json', 'X-Subscription-Token': key }
    const response = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' })
    if (response.ok) {
      const data = await response.json() as { grounding?: { generic?: unknown[] } }
      const sources = toSources(Array.isArray(data.grounding?.generic) ? data.grounding.generic : [], 'page_excerpt')
      if (sources.length) return Response.json({ status: 'ready', sources, retrievedAt: new Date().toISOString() } satisfies ResearchResult)
    } else if (![403, 404, 422].includes(response.status)) {
      throw new Error(response.status === 401 ? '检索密钥无效' : response.status === 429 ? '检索服务限速，请稍后再试' : `检索服务返回 HTTP ${response.status}`)
    } else {
      const failure = await response.json().catch(() => null)
      if (/SUBSCRIPTION_TOKEN_INVALID/.test(JSON.stringify(failure))) throw new Error('检索密钥无效或已失效，请在设置中更换。')
    }

    // 旧订阅可能只有 Web Search；明确降级成“搜索摘要”，不假称读过原文。
    const fallback = new URL('https://api.search.brave.com/res/v1/web/search')
    fallback.search = new URLSearchParams({ q: query, count: '4', extra_snippets: 'true', text_decorations: 'false' }).toString()
    const result = await fetch(fallback, { headers, signal: controller.signal, cache: 'no-store' })
    if (!result.ok) throw new Error(`检索服务返回 HTTP ${result.status}`)
    const data = await result.json() as { web?: { results?: unknown[] } }
    const sources = toSources(Array.isArray(data.web?.results) ? data.web.results : [], 'search_excerpt')
    return Response.json({ status: sources.length ? 'partial' : 'unavailable', sources, retrievedAt: new Date().toISOString(), error: sources.length ? '仅取得搜索摘要，尚未核实原文' : '未找到可用资料，回答将注明尚未查证' } satisfies ResearchResult)
  } catch (error) {
    return Response.json({ status: 'unavailable', sources: [], error: controller.signal.aborted ? '联网查证已中断或超时' : error instanceof Error ? error.message : '联网查证失败' } satisfies ResearchResult, { status: 502 })
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', onAbort)
  }
}
