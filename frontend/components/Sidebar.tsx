'use client'

import { useState, useRef, useEffect } from 'react'
import type { Thread } from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'

interface Props {
  threads: Thread[]
  activeId: string
  onSelectThread: (id: string) => void
  onNewThread: () => void
  onDeleteThread: (id: string) => void
  onRenameThread: (id: string, title: string) => void
  onClose: () => void
}

export default function Sidebar({
  threads, activeId, onSelectThread, onNewThread,
  onDeleteThread, onRenameThread, onClose,
}: Props) {
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
    if (editingId && editingTitle.trim()) {
      onRenameThread(editingId, editingTitle.trim())
    }
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  return (
    <aside className="w-64 flex flex-col h-full bg-[#F7F7F8] border-r border-[#EBEBEB]">
      {/* Header */}
      <div className="px-4 h-14 flex items-center justify-between border-b border-[#EBEBEB]">
        <span className="text-base font-semibold tracking-tight text-[#0D0D0D]">顾问团</span>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-[#888] hover:bg-[#E8E8E8] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* New thread button */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onNewThread}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-[#0D0D0D] hover:bg-[#E8E8E8] transition-colors duration-150"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新问题
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {threads.length > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#999] px-1 mb-1">历史</p>
        )}
        {threads.map(t => (
          <div
            key={t.id}
            className="relative group"
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {editingId === t.id ? (
              // ── 编辑状态 ──
              <input
                ref={editRef}
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                  if (e.key === 'Escape') cancelEdit()
                }}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white border border-[#0D0D0D]
                           outline-none text-[#0D0D0D]"
              />
            ) : (
              // ── 普通状态 ──
              <button
                onClick={() => onSelectThread(t.id)}
                onDoubleClick={() => startEdit(t.id, t.title)}
                className={`w-full text-left px-3 py-2 pr-8 rounded-xl text-sm truncate transition-colors duration-150 ${
                  t.id === activeId
                    ? 'bg-white text-[#0D0D0D] font-medium shadow-sm'
                    : 'text-[#555] hover:bg-[#E8E8E8] hover:text-[#0D0D0D]'
                }`}
                title={t.title + '\n（双击重命名）'}
              >
                {t.title}
              </button>
            )}

            {/* 操作按钮 - hover 时显示 */}
            {editingId !== t.id && hoveredId === t.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {/* 编辑 */}
                <button
                  onClick={e => { e.stopPropagation(); startEdit(t.id, t.title) }}
                  className="p-1 rounded-md text-[#AAA] hover:text-[#555] hover:bg-[#E0E0E0] transition-colors"
                  title="重命名"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {/* 删除 */}
                <button
                  onClick={e => { e.stopPropagation(); onDeleteThread(t.id) }}
                  className="p-1 rounded-md text-[#AAA] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                  title="删除"
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

      {/* Advisors */}
      <div className="px-4 py-4 border-t border-[#EBEBEB]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#999] mb-2.5">顾问</p>
        <div className="space-y-2">
          {ADVISORS.map(a => (
            <div key={a.id} className="flex items-center gap-2.5">
              <span className="text-sm font-bold shrink-0" style={{ color: a.color }}>{a.icon}</span>
              <div>
                <p className="text-xs font-medium text-[#333]">{a.name}</p>
                <p className="text-[10px] text-[#BBB] leading-tight">{a.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
