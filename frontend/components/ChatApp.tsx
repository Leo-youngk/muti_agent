'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import IOSInstallBanner from '@/components/IOSInstallBanner'
import ChatView from '@/components/ChatView'
import InputBar, { type InputBarHandle } from '@/components/InputBar'
import SettingsModal from '@/components/SettingsModal'
import type { AppSettings, AdvisorId } from '@/lib/types'
import { loadSettings, saveSettings, threadToMarkdown, downloadMarkdown } from '@/lib/storage'
import { getAllAdvisors, getAdvisorMap } from '@/lib/advisors'
import { AdvisorProvider } from '@/lib/AdvisorContext'
import { useThreads } from '@/lib/useThreads'
import { useStreaming } from '@/lib/useStreaming'

export default function ChatApp() {

  // ── Threads ─────────────────────────────────────────────────────────────────
  const {
    threads, activeId, setActiveId, activeThread,
    updateThread, updatePanel, newThread, deleteThread, renameThread,
    isStreamingRef, booted,
  } = useThreads()

  // ── Settings ────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const s = loadSettings()
    return localStorage.getItem('advisor_model') || s.defaultModel
  })

  const activeAdvisors = useMemo(() => getAllAdvisors(settings), [settings])
  const advisorMap     = useMemo(() => getAdvisorMap(settings), [settings])

  // 主题色同步到浏览器地址栏/状态栏（metadata 静态值无法跟随本地主题）
  useEffect(() => {
    const pageColor: Record<string, string> = {
      sage: '#fafaf8', ocean: '#f4f8fb', midnight: '#17191d',
      rose: '#fff8f7', amber: '#fffbf2',
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', pageColor[settings.theme ?? 'sage'])
  }, [settings.theme])

  // ── Streaming ───────────────────────────────────────────────────────────────
  const {
    isStreaming, error, setError,
    targetAdvisor, setTargetAdvisor,
    handleStop, handleFollowUp,
    handleSubmit: rawSubmit,
    handleRetryAdvisor,
  } = useStreaming(updateThread, updatePanel, isStreamingRef)

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inputRef = useRef<InputBarHandle>(null)

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleModelChange = useCallback((m: string) => {
    setSelectedModel(m)
    localStorage.setItem('advisor_model', m)
  }, [])

  const handleSaveSettings = useCallback((s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
    // 校验选中模型仍有效：优先保留用户上次选择，其次 defaultModel，最后第一个可用模型
    const allModels = s.providers.flatMap(p => p.models ?? [])
    const stored = localStorage.getItem('advisor_model')
    const next = stored && allModels.includes(stored)
      ? stored
      : allModels.includes(s.defaultModel)
        ? s.defaultModel
        : allModels[0] ?? ''
    setSelectedModel(next)
    localStorage.setItem('advisor_model', next)
  }, [])

  const handleSubmit = useCallback((task: string) => {
    rawSubmit(task, activeId, threads, selectedModel, settings, activeAdvisors)
  }, [rawSubmit, activeId, threads, selectedModel, settings, activeAdvisors])

  const openFollowUp = useCallback((advisorId: AdvisorId) => {
    handleFollowUp(advisorId)
    inputRef.current?.focus()
  }, [handleFollowUp])

  const handleSelectThread = useCallback((id: string) => {
    setActiveId(id)
    setTargetAdvisor(null)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [setActiveId, setTargetAdvisor])

  const handleNewThread = useCallback(() => {
    newThread()
    setTargetAdvisor(null)
  }, [newThread, setTargetAdvisor])

  const handleRetry = useCallback((advisorId: AdvisorId) => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    const lastPanel = [...thread.messages].reverse().find(m => m.role === 'panel')
    const lastUser  = [...thread.messages].reverse().find(m => m.role === 'user')
    if (!lastPanel || !lastUser) return
    handleRetryAdvisor(activeId, lastPanel.id, advisorId, lastUser.content, settings, selectedModel, thread.messages, activeAdvisors)
  }, [threads, activeId, handleRetryAdvisor, settings, selectedModel, activeAdvisors])

  const handleExport = useCallback(() => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    downloadMarkdown(`讨论室_${thread.title.slice(0, 20)}.md`, threadToMarkdown(thread))
  }, [threads, activeId])

  // 移动端标题：截短显示当前对话
  const headerTitle = activeThread?.title
    ? (activeThread.title.length > 14 ? activeThread.title.slice(0, 14) + '…' : activeThread.title)
    : '讨论室'

  // 历史未加载完之前渲染空白占位，避免"新问题"首屏闪烁
  if (!booted) {
    return <div className="fixed inset-0 bg-[var(--page)]" />
  }

  return (
    <AdvisorProvider value={advisorMap}>
      <div className="fixed inset-0 flex overflow-hidden bg-[var(--page)]" data-theme={settings.theme ?? 'sage'}>

        {/* ── 遮罩 ── */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-30 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── 侧边栏 ── */}
        <aside className={[
          'fixed top-0 left-0 h-full z-40 md:relative md:z-auto flex flex-col',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          sidebarOpen ? 'shadow-2xl md:shadow-none' : '',
        ].join(' ')}>
          <Sidebar
            threads={threads}
            activeId={activeId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={deleteThread}
            onRenameThread={renameThread}
            onClose={() => setSidebarOpen(false)}
            onSettingsOpen={() => setSettingsOpen(true)}
          />
        </aside>

        {/* ── 主区域 ── */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Header ── */}
          <header
            className="shrink-0 flex items-center justify-between bg-[var(--page)] px-3 sm:px-4"
            style={{ minHeight: '3.25rem', paddingTop: 'env(safe-area-inset-top)' }}
          >
            {/* 左：历史菜单 */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--bubble)]"
              title="历史记录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 8h16M4 16h16" />
              </svg>
            </button>

            {/* 中：轻量标题 */}
            <span className="mx-2 flex-1 truncate text-center text-sm font-medium text-[var(--text-muted)]">
              {headerTitle}
            </span>

            {/* 右：新建 + 导出 */}
            <div className="flex items-center gap-0.5">
              {(activeThread?.messages.length ?? 0) > 0 && (
                <button
                  onClick={handleExport}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bubble)]"
                  title="导出对话"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleNewThread}
                disabled={isStreaming}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--bubble)] disabled:opacity-30"
                title="新建对话"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </header>

          {/* ── 错误提示 ── */}
          {error && (
            <div className="mx-auto mt-3 flex w-[calc(100%-2.5rem)] max-w-[680px] items-start gap-2 border-y border-[var(--line)] py-3 text-sm text-[var(--error)]">
              <span className="shrink-0">⚠</span>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="min-h-11 min-w-11 shrink-0 text-[var(--error)]">关闭</button>
            </div>
          )}

          {/* ── 对话区 ── */}
          <ChatView
            messages={activeThread?.messages ?? []}
            advisors={activeAdvisors}
            onFollowUp={openFollowUp}
            onRetryAdvisor={handleRetry}
            isStreaming={isStreaming}
          />

          {/* ── 安装提示 ── */}
          <IOSInstallBanner />

          {/* ── 输入栏（常驻） ── */}
          <InputBar
            ref={inputRef}
            key={activeId}
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            onStop={handleStop}
            targetAdvisor={targetAdvisor}
            onClearTarget={() => setTargetAdvisor(null)}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            providers={settings.providers ?? []}
          />
        </main>

        {/* ── 设置弹窗 ── */}
        {settingsOpen && (
          <SettingsModal
            settings={settings}
            onSave={handleSaveSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </AdvisorProvider>
  )
}
