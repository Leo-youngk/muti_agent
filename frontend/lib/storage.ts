import { get, set } from 'idb-keyval'
import type { Thread, AppSettings, PanelResult } from './types'

const THREADS_KEY = 'advisor_threads_v3'
const SETTINGS_KEY = 'advisor_settings_v2'

// ─── IndexedDB 存储（容量远大于 localStorage 的 5MB）─────────────────────────

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

/** 加载后清理卡死的 thinking 状态（PWA 被杀时残留） */
function healStaleStatus(threads: Thread[]): Thread[] {
  return threads.map(t => ({
    ...t,
    messages: t.messages.map(m => {
      if (!m.panel) return m
      const p = m.panel
      if (!Object.values(p.advisorStatus).some(s => s === 'thinking')) return m
      const staleIds = Object.entries(p.advisorStatus)
        .filter(([, s]) => s === 'thinking')
        .map(([id]) => id)
      return {
        ...m,
        panel: {
          ...p,
          advisorStatus: Object.fromEntries(
            Object.entries(p.advisorStatus).map(([id, s]) =>
              [id, s === 'thinking' ? 'error' : s]
            )
          ) as Record<string, import('./types').AdvisorStatus>,
          advisorErrors: {
            ...p.advisorErrors,
            ...Object.fromEntries(staleIds.map(id => [id, '应用被关闭，回答中断'])),
          },
        },
      }
    }),
  }))
}

/** 存入 localStorage 前清除 streaming 冗余数据，减少存储体积 */
function stripStreamingData(threads: Thread[]): Thread[] {
  return threads.map(t => ({
    ...t,
    messages: t.messages.map(m => {
      if (!m.panel) return m
      const cleaned: PanelResult = {
        ...m.panel,
        streamingTexts: {},   // 不保存原始 token 流
      }
      return { ...m, panel: cleaned }
    }),
  }))
}

// ─── Threads ──────────────────────────────────────────────────────────────────

/** 从 IndexedDB 加载，自动兼容旧 localStorage 数据 */
export async function loadThreads(): Promise<Thread[]> {
  try {
    // 先尝试 IndexedDB
    const data = await get<Thread[]>(THREADS_KEY)
    if (data && data.length > 0) return healStaleStatus(data)

    // 回退：从旧 localStorage 迁移
    const raw = localStorage.getItem('advisor_threads_v2')
    if (raw) {
      const threads = JSON.parse(raw) as Thread[]
      if (threads.length > 0) {
        const migrated = threads
        await set(THREADS_KEY, stripStreamingData(migrated))
        localStorage.removeItem('advisor_threads_v2')
        return healStaleStatus(migrated)
      }
    }
    return []
  } catch {
    return safe(() => {
      const raw = localStorage.getItem('advisor_threads_v2') || localStorage.getItem(THREADS_KEY)
      return raw ? healStaleStatus(JSON.parse(raw) as Thread[]) : []
    }, [])
  }
}

export async function saveThreads(threads: Thread[]): Promise<void> {
  const cleaned = stripStreamingData(threads)
  try {
    await set(THREADS_KEY, cleaned)
  } catch {
    // 回退到 localStorage
    safe(() => localStorage.setItem(THREADS_KEY, JSON.stringify(cleaned)), undefined)
  }
}

// ─── 同步版本（仅用于初始化，避免异步阻塞渲染）────────────────────────────────

export function loadThreadsSync(): Thread[] {
  return safe(() => {
    const raw = localStorage.getItem('advisor_threads_v2') || localStorage.getItem(THREADS_KEY)
    return raw ? healStaleStatus(JSON.parse(raw) as Thread[]) : []
  }, [])
}

// ─── Settings（体积小，继续用 localStorage 同步读写）─────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  apiKey: '',
  baseUrl: '',
  defaultModel: 'deepseek-v4-flash',
  customProfiles: {},
  customAdvisors: [],
  hiddenAdvisors: [],
  // 高级参数：temperature 取 'auto'（由服务端决定是否传，兼容 kimi 等限制模型），
  // maxTokensCap 16384（推理模型需要更大预算），timeoutMs 120s（慢模型足够）
  temperature: 'auto',
  maxTokensCap: 16384,
  timeoutMs: 120_000,
  theme: 'sage',
}

const LEGACY_PRESET_MODELS = [
  'deepseek-v4-flash', 'qwen3.7-plus',
]

export function loadSettings(): AppSettings {
  return safe(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const s: AppSettings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
    if (!s.providers) s.providers = []

    // 迁移：旧版单 apiKey/baseUrl → provider
    if (s.providers.length === 0 && (s.apiKey || s.baseUrl)) {
      const models = new Set<string>()
      if (s.defaultModel) models.add(s.defaultModel)
      LEGACY_PRESET_MODELS.forEach(m => models.add(m))
      try {
        const custom: string[] = JSON.parse(localStorage.getItem('advisor_custom_models') ?? '[]')
        custom.forEach(m => models.add(m))
        localStorage.removeItem('advisor_custom_models')
      } catch {}
      s.providers = [{
        id: 'migrated_default',
        name: '默认',
        baseUrl: s.baseUrl,
        apiKey: s.apiKey,
        models: Array.from(models),
      }]
    }

    // 确保预设模型始终存在于第一个 provider 中
    if (s.providers.length > 0) {
      const allModels = new Set(s.providers.flatMap(p => p.models))
      const missing = LEGACY_PRESET_MODELS.filter(m => !allModels.has(m))
      if (missing.length > 0) {
        s.providers[0] = {
          ...s.providers[0],
          models: [...s.providers[0].models, ...missing],
        }
        // 写回，避免每次加载都触发
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
      }
    }

    return s
  }, DEFAULT_SETTINGS)
}

export function resolveProvider(settings: AppSettings, model: string): { apiKey: string; baseUrl: string } | null {
  for (const p of settings.providers) {
    if (p.models.includes(model)) {
      return { apiKey: p.apiKey, baseUrl: p.baseUrl }
    }
  }
  return null
}

export function saveSettings(s: AppSettings): void {
  safe(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)), undefined)
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function threadToMarkdown(thread: Thread): string {
  const lines: string[] = []
  lines.push(`# 讨论室 · ${thread.title}`)
  lines.push(`> Thread: \`${thread.id}\` · 导出于 ${new Date().toLocaleString('zh-CN')}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const msg of thread.messages) {
    if (msg.role === 'user') {
      lines.push('## 问题')
      lines.push('')
      lines.push(msg.content)
      lines.push('')
    } else if (msg.role === 'panel' && msg.panel) {
      const { judgments } = msg.panel

      for (const [, j] of Object.entries(judgments)) {
        if (!j) continue
        lines.push(`### ${j.advisor}（${j.stance}）`)
        lines.push('')
        lines.push(`**核心判断**：${j.core_judgment}`)
        lines.push('')
        lines.push(`**推理**：${j.reasoning}`)
        lines.push('')
        lines.push(`**核心批评**：${j.criticism ?? ''}`)
        lines.push('')
        if (j.focus) lines.push(`关注焦点：${j.focus}`)
        if (j.demand) lines.push(`要求改变：${j.demand}`)
        if (j.approach) lines.push(`如何切入：${j.approach}`)
        lines.push(`盲点：${j.blind_spot ?? ''}`)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
