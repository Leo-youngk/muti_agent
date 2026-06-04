import { get, set } from 'idb-keyval'
import type { Thread, AppSettings, PanelResult } from './types'

const THREADS_KEY = 'advisor_threads_v3'
const SETTINGS_KEY = 'advisor_settings_v2'

// ─── IndexedDB 存储（容量远大于 localStorage 的 5MB）─────────────────────────

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
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
    if (data && data.length > 0) return data

    // 回退：从旧 localStorage 迁移
    const raw = localStorage.getItem('advisor_threads_v2')
    if (raw) {
      const threads = JSON.parse(raw) as Thread[]
      if (threads.length > 0) {
        await set(THREADS_KEY, stripStreamingData(threads))
        localStorage.removeItem('advisor_threads_v2')   // 迁移完成，清理旧数据
        return threads
      }
    }
    return []
  } catch {
    // IndexedDB 不可用时回退到 localStorage
    return safe(() => {
      const raw = localStorage.getItem('advisor_threads_v2') || localStorage.getItem(THREADS_KEY)
      return raw ? (JSON.parse(raw) as Thread[]) : []
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
    return raw ? (JSON.parse(raw) as Thread[]) : []
  }, [])
}

// ─── Settings（体积小，继续用 localStorage 同步读写）─────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  baseUrl: '',
  defaultModel: 'deepseek-v4-flash',
  customProfiles: {},
}

export function loadSettings(): AppSettings {
  return safe(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  }, DEFAULT_SETTINGS)
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
        lines.push(`关注焦点：${j.focus}`)
        lines.push(`要求改变：${j.demand}`)
        lines.push(`如何切入：${j.approach}`)
        lines.push(`盲点：${j.blind_spot}`)
        lines.push('')
      }

      if (analysis) {
        lines.push('### 主持人综合')
        lines.push('')
        if (analysis.disputes?.length > 0) {
          lines.push('**核心分歧**')
          for (const d of analysis.disputes) {
            lines.push(`- **${d.between[0]} vs ${d.between[1]}**：${d.topic}`)
            lines.push(`  - ${d.between[0]}：${d.a_position}`)
            lines.push(`  - ${d.between[1]}：${d.b_position}`)
            lines.push(`  - 更信：${d.who_to_trust} — ${d.trust_reason}`)
          }
          lines.push('')
        }
        const c = analysis.conclusion
        lines.push(`**主持人判断**：${c.verdict}`)
        lines.push(`**核心矛盾**：${c.core_tension}`)
        lines.push(`**最值得听**：${c.top_voices.join('、')} — ${c.top_voices_reason}`)
        if (c.reference_only.length > 0) {
          lines.push(`**仅供参考**：${c.reference_only.join('、')} — ${c.reference_only_reason}`)
        }
        lines.push(`**集体盲点**：${c.biggest_blind_spot}`)
        lines.push('')
        lines.push('**建议行动**')
        c.next_steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
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
