'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Message, Thread, PanelResult, AppSettings } from './types'
import type { AdvisorMeta } from './advisors'
import { loadThreadsSync, saveThreads } from './storage'

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

export function makeThread(): Thread {
  return { id: uuidv4().slice(0, 8), title: '新问题', messages: [], createdAt: Date.now() }
}

/** activeAdvisors：本次提问的顾问列表（从 settings 计算得出）*/
export function makeInitialPanel(activeAdvisors: AdvisorMeta[]): PanelResult {
  const advisorStatus = Object.fromEntries(
    activeAdvisors.map(a => [a.id, 'idle' as const])
  ) as Record<string, 'idle'>
  return { judgments: {}, advisorStatus, streamingTexts: {}, analysisStatus: 'idle', analysisStream: '' }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = loadThreadsSync()
    return saved.length > 0 ? saved : [makeThread()]
  })
  const [activeId, setActiveId] = useState<string>(() => threads[0]?.id ?? '')

  // 异步加载 IndexedDB 数据覆盖同步初始值
  const hasLoadedIDB = useRef(false)
  useEffect(() => {
    if (hasLoadedIDB.current) return
    hasLoadedIDB.current = true
    import('./storage').then(({ loadThreads: loadAsync }) =>
      loadAsync().then(data => {
        if (data.length > 0) {
          setThreads(data)
          setActiveId(prev => data.find(t => t.id === prev) ? prev : data[0].id)
        }
      })
    )
  }, [])

  // 防抖写入 IndexedDB
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStreamingRef = useRef(false)

  const scheduleSave = useCallback((updatedThreads: Thread[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const delay = isStreamingRef.current ? 2000 : 500
    saveTimer.current = setTimeout(() => { saveThreads(updatedThreads) }, delay)
  }, [])

  // 包装 setThreads 以触发自动保存
  const setThreadsAndSave = useCallback((updater: Thread[] | ((prev: Thread[]) => Thread[])) => {
    setThreads(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const activeThread = threads.find(t => t.id === activeId) ?? threads[0]

  const updateThread = useCallback((id: string, fn: (t: Thread) => Thread) => {
    setThreadsAndSave(prev => prev.map(t => t.id === id ? fn(t) : t))
  }, [setThreadsAndSave])

  const updatePanel = useCallback((threadId: string, msgId: string, fn: (p: PanelResult) => PanelResult) => {
    setThreadsAndSave(prev => prev.map(t => {
      if (t.id !== threadId) return t
      return {
        ...t,
        messages: t.messages.map(m =>
          m.id === msgId && m.panel ? { ...m, panel: fn(m.panel) } : m
        ),
      }
    }))
  }, [setThreadsAndSave])

  const newThread = useCallback(() => {
    const t = makeThread()
    setThreadsAndSave(prev => [t, ...prev])
    setActiveId(t.id)
    return t
  }, [setThreadsAndSave])

  const deleteThread = useCallback((id: string) => {
    setThreadsAndSave(prev => {
      const remaining = prev.filter(t => t.id !== id)
      if (remaining.length === 0) {
        const newT = makeThread()
        setActiveId(newT.id)
        return [newT]
      }
      if (id === activeId) setActiveId(remaining[0].id)
      return remaining
    })
  }, [activeId, setThreadsAndSave])

  const renameThread = useCallback((id: string, title: string) => {
    updateThread(id, t => ({ ...t, title }))
  }, [updateThread])

  return {
    threads,
    activeId,
    setActiveId,
    activeThread,
    updateThread,
    updatePanel,
    newThread,
    deleteThread,
    renameThread,
    isStreamingRef,
  }
}
