'use client'

import { useEffect, useRef, useState } from 'react'
import type { Thread } from '@/lib/types'

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
  threads,
  activeId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  onClose,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
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

  return (
    <aside
      className="flex h-full w-72 flex-col border-r border-[var(--line)] bg-[var(--page)] sm:w-64"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="flex min-h-14 items-center justify-between border-b border-[var(--line)] px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <span className="text-base font-semibold text-[var(--text)]">讨论室</span>
        <button
          onClick={onClose}
          aria-label="关闭线程列表"
          className="min-h-11 min-w-11 text-sm text-[var(--text-muted)]"
        >
          关闭
        </button>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            onNewThread()
            onClose()
          }}
          className="min-h-11 text-sm font-medium text-[var(--action)] underline underline-offset-4"
        >
          新建讨论
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {threads.length > 0 && (
          <p className="mb-2 mt-1 text-xs text-[var(--text-faint)]">历史讨论</p>
        )}

        {threads.map(thread => {
          const isActive = thread.id === activeId
          return (
            <div key={thread.id} className="border-t border-[var(--line)] first:border-t-0">
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
                  className="my-2 min-h-11 w-full border-b border-[var(--action)] bg-transparent px-1 text-sm text-[var(--text)] outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    onSelectThread(thread.id)
                    onClose()
                  }}
                  onDoubleClick={() => startEdit(thread.id, thread.title)}
                  className={`min-h-11 w-full truncate py-3 text-left text-sm ${
                    isActive
                      ? 'font-semibold text-[var(--text)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                  title={thread.title}
                >
                  {thread.title}
                </button>
              )}

              {isActive && editingId !== thread.id && (
                <div className="mb-2 flex gap-5 text-xs text-[var(--text-muted)]">
                  <button
                    onClick={() => startEdit(thread.id, thread.title)}
                    className="min-h-11 underline decoration-transparent underline-offset-4 hover:decoration-current"
                  >
                    重命名
                  </button>
                  <button
                    onClick={() => onDeleteThread(thread.id)}
                    className="min-h-11 text-[var(--error)] underline decoration-transparent underline-offset-4 hover:decoration-current"
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
