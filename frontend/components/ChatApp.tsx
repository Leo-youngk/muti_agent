'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Sidebar from '@/components/Sidebar'
import IOSInstallBanner from '@/components/IOSInstallBanner'
import ChatView from '@/components/ChatView'
import InputBar from '@/components/InputBar'
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
    isStreamingRef,
  } = useThreads()

  // ── Settings ────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const s = loadSettings()
    return localStorage.getItem('advisor_model') || s.defaultModel
  })

  const activeAdvisors = useMemo(() => getAllAdvisors(settings), [settings])
  const advisorMap     = useMemo(() => getAdvisorMap(settings), [settings])

  // ── Streaming ───────────────────────────────────────────────────────────────
  const {
    isStreaming, error, setError,
    targetAdvisor, setTargetAdvisor,
    handleStop, handleFollowUp,
    handleSubmit: rawSubmit,
    handleRetryAdvisor,
    handleDebate: rawDebate,
  } = useStreaming(updateThread, updatePanel, isStreamingRef)

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)

  useEffect(() => {
    setComposerOpen((activeThread?.messages.length ?? 0) === 0)
    setTargetAdvisor(null)
  }, [activeId, activeThread?.messages.length, setTargetAdvisor])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleModelChange = useCallback((m: string) => {
    setSelectedModel(m)
    localStorage.setItem('advisor_model', m)
  }, [])

  const handleSaveSettings = useCallback((s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
    setSelectedModel(localStorage.getItem('advisor_model') || s.defaultModel)
  }, [])

  const handleSubmit = useCallback((task: string) => {
    rawSubmit(task, activeId, threads, selectedModel, settings, activeAdvisors)
    setComposerOpen(false)
  }, [rawSubmit, activeId, threads, selectedModel, settings, activeAdvisors])

  const openFollowUp = useCallback((advisorId: AdvisorId) => {
    handleFollowUp(advisorId)
    setComposerOpen(true)
  }, [handleFollowUp])

  const openGeneralComposer = useCallback(() => {
    setTargetAdvisor(null)
    setComposerOpen(true)
  }, [setTargetAdvisor])

  const closeComposer = useCallback(() => {
    setComposerOpen(false)
    setTargetAdvisor(null)
  }, [setTargetAdvisor])

  const submitRef = useRef(handleSubmit)
  useEffect(() => { submitRef.current = handleSubmit }, [handleSubmit])

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    const lastUserMsg = [...thread.messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    submitRef.current(lastUserMsg.content)
  }, [isStreaming, threads, activeId])

  const handleRetry = useCallback((advisorId: AdvisorId) => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    const lastPanel = [...thread.messages].reverse().find(m => m.role === 'panel')
    const lastUser  = [...thread.messages].reverse().find(m => m.role === 'user')
    if (!lastPanel || !lastUser) return
    handleRetryAdvisor(activeId, lastPanel.id, advisorId, lastUser.content, settings, selectedModel, thread.messages, activeAdvisors)
  }, [threads, activeId, handleRetryAdvisor, settings, selectedModel, activeAdvisors])

  const handleDebate = useCallback(() => {
    rawDebate(activeId, threads, selectedModel, settings, activeAdvisors)
  }, [rawDebate, activeId, threads, selectedModel, settings, activeAdvisors])

  const handleExport = useCallback(() => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    downloadMarkdown(`顾问团_${thread.title.slice(0, 20)}.md`, threadToMarkdown(thread))
  }, [threads, activeId])

  // 移动端标题：截短显示当前对话
  const headerTitle = activeThread?.title
    ? (activeThread.title.length > 14 ? activeThread.title.slice(0, 14) + '…' : activeThread.title)
    : '顾问团'

  return (
    <AdvisorProvider value={advisorMap}>
      <div className="fixed inset-0 flex overflow-hidden bg-[var(--page)]">

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
            onSelectThread={id => {
              setActiveId(id)
              if (window.innerWidth < 768) setSidebarOpen(false)
            }}
            onNewThread={newThread}
            onDeleteThread={deleteThread}
            onRenameThread={renameThread}
            onClose={() => setSidebarOpen(false)}
          />
        </aside>

        {/* ── 主区域 ── */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Header ── */}
          <header
            className="shrink-0 flex items-center justify-between border-b border-[var(--line)] bg-[var(--page)] px-3 sm:px-4"
            style={{ minHeight: '3rem', paddingTop: 'env(safe-area-inset-top)' }}
          >
            {/* 左：菜单 */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="-ml-1 min-h-11 min-w-11 p-2 text-[var(--text)] transition-colors hover:bg-black/[0.03]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 8h16M4 16h16" />
              </svg>
            </button>

            {/* 中：标题 */}
            <span className="mx-2 flex-1 truncate text-center text-sm font-semibold text-[var(--text)]">
              {headerTitle}
            </span>

            {/* 右：操作 */}
            <div className="flex items-center gap-1">
              {isStreaming && (
                <button
                  onClick={handleStop}
                  className="min-h-11 px-2 text-sm text-[var(--error)]"
                >
                  停止
                </button>
              )}
              {(activeThread?.messages.length ?? 0) > 0 && (
                <button
                  onClick={handleExport}
                  className="min-h-11 min-w-11 p-2 text-[var(--text)] transition-colors hover:bg-black/[0.03]"
                  title="导出对话"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
              <button
                onClick={newThread}
                disabled={isStreaming}
                className="-mr-1 min-h-11 min-w-11 p-2 text-[var(--text)] transition-colors hover:bg-black/[0.03] disabled:opacity-30"
                title="新建对话"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M12 8v8M8 12h8" />
                </svg>
              </button>
            </div>
          </header>

          {/* ── 错误提示 ── */}
          {error && (
            <div className="mx-auto mt-3 flex w-[calc(100%-2.5rem)] max-w-[680px] items-start gap-2 border-y border-[#A63E3533] py-3 text-sm text-[var(--error)]">
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
            onRegenerate={handleRegenerate}
            onRetryAdvisor={handleRetry}
            onStartDiscussion={openGeneralComposer}
            onContinueDiscussion={openGeneralComposer}
            onDebate={handleDebate}
            isStreaming={isStreaming}
          />

          {/* ── 输入栏 ── */}
          <InputBar
            key={activeId}
            open={composerOpen}
            onClose={closeComposer}
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            onStop={handleStop}
            targetAdvisor={targetAdvisor}
            onClearTarget={() => setTargetAdvisor(null)}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            providers={settings.providers ?? []}
            onSettingsOpen={() => setSettingsOpen(true)}
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

      <IOSInstallBanner />
    </AdvisorProvider>
  )
}
