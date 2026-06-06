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
  }, [rawSubmit, activeId, threads, selectedModel, settings, activeAdvisors])

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
    handleRetryAdvisor(activeId, lastPanel.id, advisorId, lastUser.content, settings, selectedModel, thread.messages)
  }, [threads, activeId, handleRetryAdvisor, settings, selectedModel])

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
      <div className="fixed inset-0 flex overflow-hidden bg-white">

        {/* ── 遮罩 ── */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-30 transition-opacity"
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
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            onSettingsOpen={() => setSettingsOpen(true)}
            isStreaming={isStreaming}
            providers={settings.providers ?? []}
          />
        </aside>

        {/* ── 主区域 ── */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Header ── */}
          <header
            className="shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-[#EBEBEB] bg-white"
            style={{ minHeight: '3.25rem', paddingTop: 'env(safe-area-inset-top)' }}
          >
            {/* 左：菜单 */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-2 rounded-xl text-[#888] hover:bg-[#F0F0F0] active:bg-[#E8E8E8] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* 中：标题 */}
            <span className="text-sm font-semibold text-[#0D0D0D] truncate flex-1 text-center mx-2">
              {headerTitle}
            </span>

            {/* 右：操作 */}
            <div className="flex items-center gap-0.5">
              {(activeThread?.messages.length ?? 0) > 0 && (
                <button
                  onClick={handleExport}
                  className="p-2 rounded-xl text-[#888] hover:bg-[#F0F0F0] transition-colors"
                  title="导出对话"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
              <button
                onClick={newThread}
                disabled={isStreaming}
                className="p-2 rounded-xl text-[#888] hover:bg-[#F0F0F0] active:bg-[#E8E8E8] transition-colors disabled:opacity-30"
                title="新建对话"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </header>

          {/* ── 错误提示 ── */}
          {error && (
            <div className="mx-4 mt-3 px-4 py-3 bg-[#FFF5F5] border border-[#FFCDD2] rounded-2xl text-sm text-[#C62828] flex items-start gap-2">
              <span className="shrink-0">⚠</span>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="shrink-0 text-[#C62828]">✕</button>
            </div>
          )}

          {/* ── 对话区 ── */}
          <ChatView
            messages={activeThread?.messages ?? []}
            onFollowUp={handleFollowUp}
            onRegenerate={handleRegenerate}
            onRetryAdvisor={handleRetry}
            onExamplePrompt={handleSubmit}
            onDebate={handleDebate}
            isStreaming={isStreaming}
          />

          {/* ── 输入栏 ── */}
          <InputBar
            key={activeId}
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            onStop={handleStop}
            targetAdvisor={targetAdvisor}
            onClearTarget={() => setTargetAdvisor(null)}
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
