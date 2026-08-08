'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Thread } from '@/lib/types'

interface Props {
  threads: Thread[]
  activeId: string
  onSelectThread: (id: string) => void
  onNewThread: () => void
  onDeleteThread: (id: string) => void
  onRenameThread: (id: string, title: string) => void
  onClose: () => void
  onSettingsOpen: () => void
}

export default function Sidebar({
  threads,
  activeId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  onClose,
  onSettingsOpen,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [query, setQuery] = useState('')
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

  // 按时间分组
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return threads
      .filter(t => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [threads, query])

  const groups = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterday = today - 24 * 60 * 60 * 1000
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000

    const g: Record<string, Thread[]> = {
      '今天': [],
      '昨天': [],
      '近 7 天': [],
      '更早': [],
    }
    filtered.forEach(t => {
      if (t.createdAt >= today) g['今天'].push(t)
      else if (t.createdAt >= yesterday) g['昨天'].push(t)
      else if (t.createdAt >= weekAgo) g['近 7 天'].push(t)
      else g['更早'].push(t)
    })
    return Object.entries(g).filter(([, list]) => list.length > 0)
  }, [filtered])

  return (
    <aside
      className="flex h-full w-[min(85vw,320px)] flex-col border-r border-[var(--line)] bg-[var(--surface)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <span className="text-base font-semibold text-[var(--text)]">历史记录</span>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bubble)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 新建讨论 */}
      <div className="px-4 pb-3">
        <button
          onClick={() => {
            onNewThread()
            onClose()
          }}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--action)] text-sm font-medium text-[var(--surface)] transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新建讨论
        </button>
      </div>

      {/* 搜索 */}
      <div className="px-4 pb-2">
        <div className="flex h-9 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--page)] px-3">
          <svg className="h-3.5 w-3.5 text-[var(--text-faint)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索对话标题…"
            className="flex-1 bg-transparent text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[var(--text-faint)] hover:text-[var(--text-muted)]">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {groups.length === 0 && (
          <p className="mt-8 text-center text-xs text-[var(--text-faint)]">
            {query ? '没有匹配的历史记录' : '还没有历史讨论'}
          </p>
        )}

        {groups.map(([label, list]) => (
          <div key={label} className="mt-3">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {label}
            </p>
            <div className="space-y-0.5">
              {list.map(thread => {
                const isActive = thread.id === activeId
                return (
                  <div
                    key={thread.id}
                    className={`group rounded-xl transition-colors ${
                      isActive ? 'bg-[var(--bubble)]' : 'hover:bg-[var(--bubble)]'
                    }`}
                  >
                    {editingId === thread.id ? (
                      <input
                        ref={editRef}
                        value={editingTitle}
                        onChange={event => setEditingTitle(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitEdit()
                          }
                          if (event.key === 'Escape') setEditingId(null)
                        }}
                        className="my-2 min-h-9 w-full rounded-lg border border-[var(--action)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          onSelectThread(thread.id)
                          onClose()
                        }}
                        onDoubleClick={() => startEdit(thread.id, thread.title)}
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                      >
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className={`flex-1 truncate text-sm ${isActive ? 'font-medium text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                          {thread.title}
                        </span>
                      </button>
                    )}

                    {isActive && editingId !== thread.id && (
                      <div className="flex items-center gap-1 px-3 pb-2.5 pt-0">
                        <button
                          onClick={() => startEdit(thread.id, thread.title)}
                          className="rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--line)]"
                        >
                          重命名
                        </button>
                        <button
                          onClick={() => onDeleteThread(thread.id)}
                          className="rounded-md px-2 py-1 text-[10px] text-[var(--error)] transition-colors hover:bg-[var(--bubble)]"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--line)] p-4">
        <button
          onClick={onSettingsOpen}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bubble)] hover:text-[var(--text)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-.33-1.82V9a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          设置
        </button>
      </div>
    </aside>
  )
}
