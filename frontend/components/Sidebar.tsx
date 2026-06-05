'use client'

import { useState, useRef, useEffect } from 'react'
import type { Thread, Provider } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'

interface Props {
  threads: Thread[]
  activeId: string
  onSelectThread: (id: string) => void
  onNewThread: () => void
  onDeleteThread: (id: string) => void
  onRenameThread: (id: string, title: string) => void
  onClose: () => void
  /** 桌面端底部操作 */
  selectedModel: string
  onModelChange: (m: string) => void
  onSettingsOpen: () => void
  isStreaming: boolean
  providers: Provider[]
}

export default function Sidebar({
  threads, activeId, onSelectThread, onNewThread,
  onDeleteThread, onRenameThread, onClose,
  selectedModel, onModelChange, onSettingsOpen, isStreaming, providers,
}: Props) {
  const advisorMap = useAdvisorMap()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) editRef.current?.focus()
  }, [editingId])

  const startEdit = (id: string, current: string) => {
    setEditingId(id)
    setEditingTitle(current)
  }

  const commitEdit = () => {
    if (editingId && editingTitle.trim()) onRenameThread(editingId, editingTitle.trim())
    setEditingId(null)
  }

  return (
    <aside
      className="w-72 sm:w-64 flex flex-col h-full bg-[#F7F7F8] border-r border-[#EBEBEB]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── 顶部 ── */}
      <div className="px-4 flex items-center justify-between border-b border-[#EBEBEB]"
        style={{ minHeight: '3.5rem' }}>
        <span className="text-base font-semibold tracking-tight text-[#0D0D0D]">顾问团</span>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-[#888] hover:bg-[#E8E8E8] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── 新建按钮 ── */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => { onNewThread(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-[#0D0D0D] hover:bg-[#E8E8E8] transition-colors duration-150"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新问题
        </button>
      </div>

      {/* ── 历史对话 ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {threads.length > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#999] px-1 mb-1.5 mt-1">历史</p>
        )}
        {threads.map(t => (
          <div
            key={t.id}
            className="relative group"
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {editingId === t.id ? (
              <input
                ref={editRef}
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-white border border-[#0D0D0D] outline-none text-[#0D0D0D]"
              />
            ) : (
              <button
                onClick={() => { onSelectThread(t.id); onClose() }}
                onDoubleClick={() => startEdit(t.id, t.title)}
                className={`w-full text-left px-3 py-2.5 pr-16 rounded-xl text-sm truncate transition-colors duration-150 ${
                  t.id === activeId
                    ? 'bg-white text-[#0D0D0D] font-medium shadow-sm'
                    : 'text-[#555] hover:bg-[#E8E8E8] hover:text-[#0D0D0D]'
                }`}
                title={t.title}
              >
                {t.title}
              </button>
            )}

            {editingId !== t.id && hoveredId === t.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  onClick={e => { e.stopPropagation(); startEdit(t.id, t.title) }}
                  className="p-1.5 rounded-lg text-[#AAA] hover:text-[#555] hover:bg-[#E0E0E0] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteThread(t.id) }}
                  className="p-1.5 rounded-lg text-[#AAA] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── 顾问列表 ── */}
      <div className="px-4 py-3 border-t border-[#EBEBEB]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#999] mb-2">顾问</p>
        <div className="flex flex-wrap gap-2">
          {Object.values(advisorMap).map(a => (
            <div key={a.id} className="flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: a.color }}
              >
                {a.icon}
              </span>
              <span className="text-xs text-[#555]">{a.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 底部：模型 + 设置 ── */}
      <div className="px-3 py-3 border-t border-[#EBEBEB] space-y-1">
        {/* 模型选择（内联版） */}
        <ModelPickerInline
          value={selectedModel}
          onChange={onModelChange}
          disabled={isStreaming}
          providers={providers}
        />
        {/* 设置 */}
        <button
          onClick={() => { onSettingsOpen(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#555] hover:bg-[#E8E8E8] hover:text-[#0D0D0D] transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          设置
        </button>
      </div>
    </aside>
  )
}

// ── 内联模型选择器（侧边栏专用）──────────────────────────────────────────────

import ModelSelector from './ModelSelector'

function ModelPickerInline({ value, onChange, disabled, providers }: {
  value: string; onChange: (m: string) => void; disabled?: boolean; providers: import('@/lib/types').Provider[]
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#E8E8E8] transition-colors">
      <svg className="w-4 h-4 text-[#888] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.8" />
        <rect x="9" y="9" width="6" height="6" rx="0.5" strokeWidth="1.8" />
        <path strokeWidth="1.8" d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
      </svg>
      <div className="flex-1 min-w-0">
        <ModelSelector value={value} onChange={onChange} disabled={disabled} providers={providers} />
      </div>
    </div>
  )
}
