import { get, set } from 'idb-keyval'
import type { Thread, AppSettings, PanelResult } from './types'

const THREADS_KEY = 'advisor_threads_v3'
const SETTINGS_KEY = 'advisor_settings_v2'

// ─── IndexedDB 存储（容量远大于 localStorage 的 5MB）─────────────────────────

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

/** 迁移旧版 CrossAnalysis（conclusion.verdict → verdict）和 Dispute 格式 */
function migrateAnalysis(threads: Thread[]): Thread[] {
  return threads.map(t => ({
    ...t,
    messages: t.messages.map(m => {
      if (!m.panel?.analysis) return m
      const a = m.panel.analysis as any
      // 已经是新格式
      if (a.verdict && !a.conclusion) return m
      // 旧格式：从 conclusion 中提取
      const c = a.conclusion
      if (!c) return m
      const migrated = {
        disputes: (a.disputes || []).map((d: any) => ({
          between: d.between,
          clash: d.clash || d.topic || '',
          a_says: d.a_says || d.a_position || '',
          b_says: d.b_says || d.b_position || '',
          trust: d.trust || d.who_to_trust || '',
          why: d.why || d.trust_reason || '',
        })),
        verdict: c.verdict || '',
        listen_to: c.top_voices || [],
        blind_spot: c.biggest_blind_spot || '',
        do_next: c.next_steps || [],
      }
      return { ...m, panel: { ...m.panel, analysis: migrated } }
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
        analysisStream: '',   // 不保存分析的原始流
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
    if (data && data.length > 0) return migrateAnalysis(data)

    // 回退：从旧 localStorage 迁移
    const raw = localStorage.getItem('advisor_threads_v2')
    if (raw) {
      const threads = JSON.parse(raw) as Thread[]
      if (threads.length > 0) {
        const migrated = migrateAnalysis(threads)
        await set(THREADS_KEY, stripStreamingData(migrated))
        localStorage.removeItem('advisor_threads_v2')
        return migrated
      }
    }
    return []
  } catch {
    return safe(() => {
      const raw = localStorage.getItem('advisor_threads_v2') || localStorage.getItem(THREADS_KEY)
      return raw ? migrateAnalysis(JSON.parse(raw) as Thread[]) : []
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
    return raw ? migrateAnalysis(JSON.parse(raw) as Thread[]) : []
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
  lines.push(`# 顾问团 · ${thread.title}`)
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
      const { judgments, analysis } = msg.panel

      for (const [, j] of Object.entries(judgments)) {
        if (!j) continue
        lines.push(`### ${j.advisor}（${j.stance}）`)
        lines.push('')
        lines.push(`**核心判断**：${j.core_judgment}`)
        lines.push('')
        lines.push(`**推理**：${j.reasoning}`)
        lines.push('')
        lines.push(`**核心批评**：${j.criticism}`)
        lines.push('')
        if (j.focus) lines.push(`关注焦点：${j.focus}`)
        if (j.demand) lines.push(`要求改变：${j.demand}`)
        if (j.approach) lines.push(`如何切入：${j.approach}`)
        lines.push(`盲点：${j.blind_spot}`)
        lines.push('')
      }

      if (analysis) {
        lines.push('### 主持人')
        lines.push('')
        if (analysis.disputes?.length > 0) {
          lines.push('**核心分歧**')
          for (const d of analysis.disputes) {
            lines.push(`- **${d.between[0]} vs ${d.between[1]}**：${d.clash}`)
            lines.push(`  - ${d.between[0]}：${d.a_says}`)
            lines.push(`  - ${d.between[1]}：${d.b_says}`)
            lines.push(`  - 听 ${d.trust}（${d.why}）`)
          }
          lines.push('')
        }
        lines.push(`**判断**：${analysis.verdict || ''}`)
        lines.push(`**最值得听**：${(analysis.listen_to || []).join('、')}`)
        lines.push(`**集体盲点**：${analysis.blind_spot || ''}`)
        lines.push('')
        lines.push('**马上该做**')
        ;(analysis.do_next || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`))
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
