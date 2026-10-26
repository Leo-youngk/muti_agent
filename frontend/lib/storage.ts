import { getMany, set, setMany } from 'idb-keyval'
import type { Thread, AppSettings, PanelResult } from './types'
import { DEFAULT_HIDDEN_ADVISOR_IDS, ADVISOR_ROSTER_VERSION } from './advisors'
import { normalizeModelSelection } from './modelSelection'
import { getPartialJudgment } from './judgment'
import { getPanelAdvisors } from './discussionPresentation'

const THREADS_KEY = 'advisor_threads_v3'
const SETTINGS_KEY = 'advisor_settings_v2'
const SAVED_AT_KEY = 'advisor_threads_saved_at'
const CHECKPOINT_KEY = 'advisor_threads_checkpoint_v1'

function readCheckpoint(): { savedAt: number; threads: Thread[] } | null {
  return safe(() => {
    const parsed = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || 'null')
    return parsed && Array.isArray(parsed.threads) && typeof parsed.savedAt === 'number' ? parsed : null
  }, null)
}

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
      if (!Object.values(p.advisorStatus).some(s => s === 'thinking' || s === 'queued')) return m
      const staleIds = Object.entries(p.advisorStatus)
        .filter(([, s]) => s === 'thinking' || s === 'queued')
        .map(([id]) => id)
      return {
        ...m,
        panel: {
          ...p,
          advisorStatus: Object.fromEntries(
            Object.entries(p.advisorStatus).map(([id, s]) =>
              [id, s === 'thinking' ? (p.judgments[id] ? 'partial' : 'error') : s === 'queued' ? 'idle' : s]
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
        judgments: { ...m.panel.judgments },
        streamingTexts: {},   // 不保存原始 token 流
      }
      for (const [id, text] of Object.entries(m.panel.streamingTexts ?? {})) {
        const name = m.panel.participants?.find(a => a.id === id)?.name || m.panel.judgments[id]?.advisor || id
        const partial = getPartialJudgment(text, name)
        if (partial && m.panel.advisorStatus[id] !== 'done') cleaned.judgments[id] = partial
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
    const [data, savedAt] = await getMany([THREADS_KEY, SAVED_AT_KEY]) as [Thread[] | undefined, number | undefined]
    const checkpoint = readCheckpoint()
    if (checkpoint && (!data || checkpoint.savedAt >= (savedAt ?? 0))) return healStaleStatus(checkpoint.threads)
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
      const checkpoint = readCheckpoint()
      if (checkpoint) return healStaleStatus(checkpoint.threads)
      const raw = localStorage.getItem('advisor_threads_v2') || localStorage.getItem(THREADS_KEY)
      return raw ? healStaleStatus(JSON.parse(raw) as Thread[]) : []
    }, [])
  }
}

export function checkpointThreads(threads: Thread[], savedAt = Date.now()): boolean {
  return safe(() => {
    const previous = readCheckpoint()
    if (!previous || previous.savedAt <= savedAt) {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ savedAt, threads: stripStreamingData(threads) }))
    }
    return true
  }, false)
}

export async function saveThreads(threads: Thread[], savedAt = Date.now()): Promise<boolean> {
  const cleaned = stripStreamingData(threads)
  try {
    await setMany([[THREADS_KEY, cleaned], [SAVED_AT_KEY, savedAt]])
    const checkpoint = readCheckpoint()
    if (checkpoint && checkpoint.savedAt <= savedAt) safe(() => localStorage.removeItem(CHECKPOINT_KEY), undefined)
    return true
  } catch {
    // 回退到 localStorage
    return checkpointThreads(cleaned, savedAt)
  }
}

// ─── 同步版本（仅用于初始化，避免异步阻塞渲染）────────────────────────────────

export function loadThreadsSync(): Thread[] {
  return safe(() => {
    const checkpoint = readCheckpoint()
    if (checkpoint) return healStaleStatus(checkpoint.threads)
    const raw = localStorage.getItem('advisor_threads_v2') || localStorage.getItem(THREADS_KEY)
    return raw ? healStaleStatus(JSON.parse(raw) as Thread[]) : []
  }, [])
}

// ─── Settings（体积小，继续用 localStorage 同步读写）─────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  apiKey: '',
  baseUrl: '',
  defaultModel: '',
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

export function loadSettings(): AppSettings {
  return safe(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const s: AppSettings = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) }
    if (!s.providers) s.providers = []

    // 新增的内置 agent 一律默认隐藏：面板每多一位就多一次并发调用，
    // 不能让老用户下一次提问突然扇出到十几个 agent。只在版本落后时执行一次。
    if ((s.advisorRosterVersion ?? 0) < ADVISOR_ROSTER_VERSION) {
      const hidden = new Set(s.hiddenAdvisors ?? [])
      DEFAULT_HIDDEN_ADVISOR_IDS.forEach(id => hidden.add(id))
      s.hiddenAdvisors = Array.from(hidden)
      s.advisorRosterVersion = ADVISOR_ROSTER_VERSION
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
    }

    // 迁移：旧版单 apiKey/baseUrl → provider
    if (s.providers.length === 0 && (s.apiKey || s.baseUrl)) {
      const models = new Set<string>()
      if (s.defaultModel) models.add(s.defaultModel)
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

    const migratedModel = normalizeModelSelection(s, s.defaultModel)
    if (migratedModel !== s.defaultModel) {
      s.defaultModel = migratedModel
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
    }
    return s
  }, DEFAULT_SETTINGS)
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

      for (const meta of getPanelAdvisors(msg.panel, [])) {
        const j = judgments[meta.id]
        if (!j) continue
        lines.push(`### ${j.advisor}（${j.stance}）`)
        if (msg.panel.advisorStatus[meta.id] !== 'done') lines.push('> 部分回答，尚未完整生成')
        lines.push('')
        lines.push(`**核心判断**：${j.core_judgment}`)
        lines.push('')
        lines.push(`**推理**：${j.reasoning}`)
        lines.push('')
      }

      for (const source of msg.panel.research?.sources ?? []) lines.push(`- [${source.title}](${source.url})（${source.kind === 'page_excerpt' ? '网页摘录' : '搜索摘要'}）`)

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
