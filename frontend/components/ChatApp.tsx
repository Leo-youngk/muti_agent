'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatView from '@/components/ChatView'
import InputBar from '@/components/InputBar'
import ModelSelector from '@/components/ModelSelector'
import SettingsModal from '@/components/SettingsModal'
import type { AppSettings, AdvisorId } from '@/lib/types'
import { loadSettings, saveSettings, threadToMarkdown, downloadMarkdown } from '@/lib/storage'
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

  // ── Streaming ───────────────────────────────────────────────────────────────
  const {
    isStreaming, error, setError,
    targetAdvisor, setTargetAdvisor,
    handleStop, handleFollowUp,
    handleSubmit: rawSubmit,
    handleRetryAdvisor,
  } = useStreaming(updateThread, updatePanel, isStreamingRef)

  // ── UI 状态 ──────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── Settings handlers ────────────────────────────────────────────────────────
  const handleModelChange = useCallback((m: string) => {
    setSelectedModel(m)
    localStorage.setItem('advisor_model', m)
  }, [])

  const handleSaveSettings = useCallback((s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
    setSelectedModel(localStorage.getItem('advisor_model') || s.defaultModel)
  }, [])

  // ── Submit wrapper（填入当前上下文）────────────────────────────────────────────
  const handleSubmit = useCallback((task: string) => {
    rawSubmit(task, activeId, threads, selectedModel, settings)
  }, [rawSubmit, activeId, threads, selectedModel, settings])

  // ── Regenerate ──────────────────────────────────────────────────────────────
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

  // ── Retry single advisor ────────────────────────────────────────────────────
  const handleRetry = useCallback((advisorId: AdvisorId) => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    // 找最后一个 panel message
    const lastPanel = [...thread.messages].reverse().find(m => m.role === 'panel')
    const lastUser = [...thread.messages].reverse().find(m => m.role === 'user')
    if (!lastPanel || !lastUser) return
    handleRetryAdvisor(activeId, lastPanel.id, advisorId, lastUser.content, settings, selectedModel, thread.messages)
  }, [threads, activeId, handleRetryAdvisor, settings, selectedModel])

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const thread = threads.find(t => t.id === activeId)
    if (!thread) return
    downloadMarkdown(`顾问团_${thread.title.slice(0, 20)}.md`, threadToMarkdown(thread))
  }, [threads, activeId])

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
            <span className="shrink-0">⚠</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[#C62828]">✕</button>
          </div>
        )}

        <ChatView
          messages={activeThread?.messages ?? []}
          onFollowUp={handleFollowUp}
          onRegenerate={handleRegenerate}
          onRetryAdvisor={handleRetry}
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
