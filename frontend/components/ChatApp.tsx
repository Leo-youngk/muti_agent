'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from '@/components/Sidebar'
import ChatView from '@/components/ChatView'
import InputBar from '@/components/InputBar'
import ModelSelector from '@/components/ModelSelector'
import SettingsModal from '@/components/SettingsModal'
import type {
  Message, Thread, PanelResult, StreamEvent, AdvisorId,
  AdvisorJudgment, CrossAnalysis, HistoryMessage, PreviousJudgment,
  FollowUpMeta, AppSettings,
} from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'
import { loadThreads, saveThreads, loadSettings, saveSettings, threadToMarkdown, downloadMarkdown } from '@/lib/storage'

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

function makeThread(): Thread {
  return { id: uuidv4().slice(0, 8), title: '新问题', messages: [], createdAt: Date.now() }
}

function makeInitialPanel(): PanelResult {
  const advisorStatus = Object.fromEntries(
    ADVISORS.map(a => [a.id, 'idle' as const])
  ) as Record<AdvisorId, 'idle'>
  return { judgments: {}, advisorStatus, streamingTexts: {}, analysisStatus: 'idle', analysisStream: '' }
}

// ─── 历史构建（包含所有顾问上轮立场，保证跨轮记忆）─────────────────────────

function buildHistory(messages: Message[]): HistoryMessage[] {
  const result: HistoryMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'panel' && msg.panel) {
      const { judgments, analysis } = msg.panel
      const parts: string[] = []

      // 把所有顾问的核心立场放进历史，让每个顾问下轮知道上轮大家都怎么说的
      const advisorLines = Object.values(judgments)
        .filter((j): j is AdvisorJudgment => j != null)
        .map(j => `• ${j.advisor}（${j.stance}）：${j.core_judgment}`)
      if (advisorLines.length > 0) {
        parts.push(`[上一轮顾问立场]\n${advisorLines.join('\n')}`)
      }
      if (analysis) {
        parts.push(`[主持人结论] ${analysis.conclusion.verdict}`)
      }
      if (parts.length > 0) {
        result.push({ role: 'assistant', content: parts.join('\n\n') })
      }
    }
  }
  return result.slice(-6) // 最近 3 轮
}

function buildPreviousJudgments(messages: Message[]): PreviousJudgment[] {
  const recentPanel = [...messages].reverse().find(m => m.role === 'panel' && m.panel)
  if (!recentPanel?.panel) return []
  return Object.entries(recentPanel.panel.judgments)
    .filter(([, j]) => j != null)
    .map(([id, j]) => ({ advisorId: id as AdvisorId, judgment: j! }))
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ChatApp() {

  // ── 状态初始化（从 localStorage 恢复）───────────────────────────────────────
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = loadThreads()
    return saved.length > 0 ? saved : [makeThread()]
  })
  const [activeId, setActiveId] = useState<string>(() => threads[0]?.id ?? '')
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const s = loadSettings()
    return localStorage.getItem('advisor_model') || s.defaultModel
  })

  // ── threads 变化时防抖写入 localStorage（避免每个 token 都触发序列化）────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // 流式输出时 2s 存一次，空闲时 500ms 存一次
    saveTimer.current = setTimeout(() => saveThreads(threads), isStreaming ? 2000 : 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [threads]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI 状态 ──────────────────────────────────────────────────────────────────
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetAdvisor, setTargetAdvisor] = useState<AdvisorId | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const activeThread = threads.find(t => t.id === activeId) ?? threads[0]

  // ── Thread CRUD ──────────────────────────────────────────────────────────────
  const updateThread = useCallback((id: string, fn: (t: Thread) => Thread) => {
    setThreads(prev => prev.map(t => t.id === id ? fn(t) : t))
  }, [])

  const updatePanel = useCallback((threadId: string, msgId: string, fn: (p: PanelResult) => PanelResult) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t
      return {
        ...t,
        messages: t.messages.map(m =>
          m.id === msgId && m.panel ? { ...m, panel: fn(m.panel) } : m
        ),
      }
    }))
  }, [])

  const newThread = useCallback(() => {
    const t = makeThread()
    setThreads(prev => [t, ...prev])
    setActiveId(t.id)
    setTargetAdvisor(null)
  }, [])

  const deleteThread = useCallback((id: string) => {
    setThreads(prev => {
      const remaining = prev.filter(t => t.id !== id)
      if (remaining.length === 0) {
        const newT = makeThread()
        setActiveId(newT.id)
        return [newT]
      }
      if (id === activeId) setActiveId(remaining[0].id)
      return remaining
    })
  }, [activeId])

  const renameThread = useCallback((id: string, title: string) => {
    updateThread(id, t => ({ ...t, title }))
  }, [updateThread])

  // ── 设置 ─────────────────────────────────────────────────────────────────────
  const handleModelChange = useCallback((m: string) => {
    setSelectedModel(m)
    localStorage.setItem('advisor_model', m)
  }, [])

  const handleSaveSettings = useCallback((s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
    // 设置里改了默认模型，同步更新
    setSelectedModel(localStorage.getItem('advisor_model') || s.defaultModel)
  }, [])

  // ── 停止流式请求 ──────────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // ── 追问 ──────────────────────────────────────────────────────────────────────
  const handleFollowUp = useCallback((advisorId: AdvisorId) => {
    setTargetAdvisor(advisorId)
  }, [])

  // ── 导出 ──────────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    downloadMarkdown(`顾问团_${thread.title.slice(0, 20)}.md`, threadToMarkdown(thread))
  }, [threads, activeId])

  // ── 核心提交逻辑 ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (task: string) => {
    if (!task.trim() || isStreaming) return
    setError(null)
    setIsStreaming(true)
    const tid = activeId
    const isFollowUp = targetAdvisor !== null

    // 提交前捕获当前消息（用于构建历史），保证不受后续 state 变化影响
    const currentMessages = threads.find(t => t.id === tid)?.messages ?? []
    const history = buildHistory(currentMessages)
    const previousJudgments = isFollowUp ? buildPreviousJudgments(currentMessages) : []

    const userMsg: Message = { id: uuidv4(), role: 'user', content: task }
    const panelMsgId = uuidv4()
    const followUpMeta: FollowUpMeta | undefined = isFollowUp && targetAdvisor
      ? { targetAdvisorId: targetAdvisor, isFollowUp: true }
      : undefined
    const panelMsg: Message = {
      id: panelMsgId, role: 'panel', content: '',
      panel: makeInitialPanel(), followUpMeta,
    }

    updateThread(tid, t => ({
      ...t,
      title: t.messages.length === 0 ? task.slice(0, 40).trim() : t.title,
      messages: [...t.messages, userMsg, panelMsg],
    }))

    const capturedTarget = targetAdvisor
    setTargetAdvisor(null)

    try {
      const controller = new AbortController()
      abortControllerRef.current = controller

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          task,
          thread_id: tid,
          history,
          model: selectedModel,
          clientApiKey: settings.apiKey || undefined,
          clientBaseUrl: settings.baseUrl || undefined,
          customProfiles: Object.keys(settings.customProfiles).length > 0
            ? settings.customProfiles : undefined,
          targetAdvisor: capturedTarget ?? undefined,
          previousJudgments: previousJudgments.length > 0 ? previousJudgments : undefined,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        let detail = text
        try { detail = JSON.parse(text).error ?? text } catch {}
        throw new Error(detail)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6).trim()
          if (!data) continue
          let evt: StreamEvent
          try { evt = JSON.parse(data) } catch { continue }

          if (evt.event === 'advisor_start' && evt.advisorId) {
            updatePanel(tid, panelMsgId, p => ({
              ...p, advisorStatus: { ...p.advisorStatus, [evt.advisorId!]: 'thinking' },
            }))
          } else if (evt.event === 'advisor_token' && evt.advisorId && evt.token) {
            const id = evt.advisorId; const tok = evt.token
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              streamingTexts: { ...p.streamingTexts, [id]: (p.streamingTexts[id] ?? '') + tok },
            }))
          } else if (evt.event === 'advisor_complete' && evt.advisorId) {
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              advisorStatus: {
                ...p.advisorStatus,
                [evt.advisorId!]: evt.judgment ? 'done' : 'error',
              },
              judgments: evt.judgment
                ? { ...p.judgments, [evt.advisorId!]: evt.judgment as AdvisorJudgment }
                : p.judgments,
            }))
          } else if (evt.event === 'analysis_start') {
            updatePanel(tid, panelMsgId, p => ({ ...p, analysisStatus: 'thinking' }))
          } else if (evt.event === 'analysis_token' && evt.token) {
            const tok = evt.token
            updatePanel(tid, panelMsgId, p => ({ ...p, analysisStream: p.analysisStream + tok }))
          } else if (evt.event === 'analysis_complete') {
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              analysisStatus: 'done',
              analysis: evt.analysis as CrossAnalysis ?? undefined,
            }))
          } else if (evt.event === 'error') {
            setError(evt.error ?? 'Unknown error')
            break
          } else if (evt.event === 'complete') {
            break
          }
        }
      }
    } catch (e: unknown) {
      // AbortError = 用户主动停止，不显示错误
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [activeId, isStreaming, threads, targetAdvisor, selectedModel, settings, updateThread, updatePanel])

  // ── 重新生成：用 submitRef 持有最新 handleSubmit，避免 regenerate 依赖频繁变化的 handleSubmit
  const submitRef = useRef(handleSubmit)
  useEffect(() => { submitRef.current = handleSubmit }, [handleSubmit])

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    // 找到最后一条用户消息内容
    const lastUserMsg = [...thread.messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    // 直接重提，保留全部历史（供历史参考对比）
    submitRef.current(lastUserMsg.content)
  }, [isStreaming, threads, activeId]) // 不依赖 handleSubmit，通过 ref 读取最新版本

  return (
    <div className="flex h-screen overflow-hidden bg-white relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={[
        'fixed top-0 left-0 h-full z-40 md:relative md:z-auto flex flex-col',
        'transition-all duration-200',
        sidebarOpen
          ? 'w-64 translate-x-0'
          : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden',
      ].join(' ')}>
        <Sidebar
          threads={threads}
          activeId={activeId}
          onSelectThread={id => {
            setActiveId(id)
            if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false)
          }}
          onNewThread={newThread}
          onDeleteThread={deleteThread}
          onRenameThread={renameThread}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 border-b border-[#EBEBEB] flex items-center gap-3 px-4">
          {/* 侧栏开关 */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-2 rounded-lg text-[#888] hover:bg-[#F0F0F0] transition-colors shrink-0"
            title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <span className="text-sm font-medium text-[#555] flex-1 min-w-0 truncate">
            {activeThread?.title ?? '顾问团'}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {/* 导出 */}
            {(activeThread?.messages.length ?? 0) > 0 && (
              <button
                onClick={handleExport}
                className="p-2 rounded-lg text-[#888] hover:bg-[#F0F0F0] transition-colors"
                title="导出对话 (.md)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}

            <ModelSelector value={selectedModel} onChange={handleModelChange} disabled={isStreaming} />

            {/* 设置 */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg text-[#888] hover:bg-[#F0F0F0] transition-colors"
              title="设置"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-[#FFF5F5] border border-[#FFCDD2] rounded-xl text-sm text-[#C62828] flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[#C62828]">✕</button>
          </div>
        )}

        <ChatView
          messages={activeThread?.messages ?? []}
          onFollowUp={handleFollowUp}
          onRegenerate={handleRegenerate}
          onExamplePrompt={handleSubmit}
          isStreaming={isStreaming}
        />
        <InputBar
          key={activeId}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
          onStop={handleStop}
          targetAdvisor={targetAdvisor}
          onClearTarget={() => setTargetAdvisor(null)}
        />
      </main>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
