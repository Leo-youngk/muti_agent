// 代理服务商的 /models 接口，供设置页在填入 Base URL 后自动加载模型列表。
export const runtime = 'nodejs'

interface ModelsBody {
  clientBaseUrl?: string
  clientApiKey?: string
}

function extractModels(data: unknown): string[] {
  const collect = (list: unknown[]): string[] =>
    list
      .map(m => (typeof m === 'string' ? m : (m as { id?: unknown })?.id))
      .filter((m): m is string => typeof m === 'string' && Boolean(m.trim()))
  if (Array.isArray(data)) return collect(data)
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    if (Array.isArray(o.data)) return collect(o.data)
    if (Array.isArray(o.models)) return collect(o.models)
  }
  return []
}

export async function POST(request: Request) {
  let body: ModelsBody
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const rawBase = body.clientBaseUrl?.trim()
  if (!rawBase) return Response.json({ error: '请先填写 Base URL' }, { status: 400 })

  // 拼出 /models 地址（兼容末尾带 / 的 Base URL），并校验协议
  let modelsUrl: string
  try {
    const url = new URL(rawBase.replace(/\/+$/, '') + '/models')
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol')
    modelsUrl = url.toString()
  } catch {
    return Response.json({ error: 'Base URL 无效' }, { status: 400 })
  }

  const apiKey = body.clientApiKey?.trim()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20_000)

  try {
    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).slice(0, 200)
      const friendly =
        res.status === 401 || res.status === 403
          ? '鉴权失败：API Key 缺失或无效'
          : res.status === 404
            ? '该服务商不支持 /models 接口'
            : res.status === 429
              ? '请求过于频繁，请稍后再试'
              : `加载失败（HTTP ${res.status}）${text ? '：' + text : ''}`
      return Response.json({ error: friendly }, { status: res.status })
    }
    const data: unknown = await res.json()
    const models = Array.from(new Set(extractModels(data)))
    if (models.length === 0) {
      return Response.json({ error: '接口未返回任何模型' }, { status: 502 })
    }
    return Response.json({ models })
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError'
    const msg = aborted
      ? '请求超时（20 秒），请检查 Base URL 是否可达'
      : `加载失败：${(err as Error).message || String(err)}`
    return Response.json({ error: msg }, { status: 502 })
  } finally {
    clearTimeout(timeoutId)
  }
}
