'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Thread, PanelResult } from './types'
import type { AdvisorMeta } from './advisors'
import { checkpointThreads, loadThreadsSync, saveThreads } from './storage'
import { PROMPT_VERSION } from './advisorPrompt'

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

export function makeThread(): Thread {
  return { id: uuidv4().slice(0, 8), title: '新问题', messages: [], createdAt: Date.now() }
}

/** activeAdvisors：本次提问的顾问列表（从 settings 计算得出）*/
export function makeInitialPanel(activeAdvisors: AdvisorMeta[]): PanelResult {
  const advisorStatus = Object.fromEntries(
    activeAdvisors.map(a => [a.id, 'queued' as const])
  ) as Record<string, 'queued'>
  return { judgments: {}, advisorStatus, streamingTexts: {}, participants: activeAdvisors.map(a => ({ ...a })), promptVersion: PROMPT_VERSION }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useThreads() {
  // localStorage 兜底数据只解析一次：后两个初始值直接复用首渲染的 threads 快照
  const [threads, setThreads] = useState<Thread[]>(loadThreadsSync)
  const [activeId, setActiveId] = useState<string>(() => threads[0]?.id ?? '')
  // 同步已有历史时立即展示；否则等 IndexedDB 加载完成再定初值，
  // 避免"新问题"首屏闪烁后被历史对话覆盖。
  const [booted, setBooted] = useState(() => threads.length > 0)
  const threadsRef = useRef<Thread[]>(threads)
  const changedAt = useRef(0)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const [storageError, setStorageError] = useState<string | null>(null)
  useEffect(() => { threadsRef.current = threads }, [threads])

  // 异步加载 IndexedDB 数据覆盖同步初始值
  const hasLoadedIDB = useRef(false)
  useEffect(() => {
    if (hasLoadedIDB.current) return
    hasLoadedIDB.current = true
    import('./storage').then(({ loadThreads: loadAsync }) =>
      loadAsync().then(data => {
        if (data.length > 0) {
          setThreads(data)
          setActiveId(prev => data.some(t => t.id === prev) ? prev : data[0].id)
        } else if (threadsRef.current.length === 0) {
          // 无任何历史：创建默认线程
          const t = makeThread()
          setThreads([t])
          setActiveId(t.id)
        }
        setBooted(true)
      })
    )
  }, [])

  // 防抖写入 IndexedDB
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStreamingRef = useRef(false)

  const persistNow = useCallback(() => {
    if (!changedAt.current) return
    const snapshot = threadsRef.current
    const savedAt = changedAt.current
    saveQueue.current = saveQueue.current.then(() => saveThreads(snapshot, savedAt)).then(ok => {
      setStorageError(ok ? null : '历史记录保存失败，请先导出当前对话，检查浏览器存储空间。')
    })
  }, [])

  const scheduleSave = useCallback(() => {
    // 流式使用固定间隔检查点；持续输出不能反复推迟写入。
    if (saveTimer.current && isStreamingRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      persistNow()
    }, isStreamingRef.current ? 1500 : 300)
  }, [persistNow])

  useEffect(() => {
    if (!booted) return
    const flush = () => {
      if (!changedAt.current) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = null
      checkpointThreads(threadsRef.current, changedAt.current)
      persistNow()
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [booted, persistNow])

  // 包装 setThreads 以触发自动保存
  const setThreadsAndSave = useCallback((updater: Thread[] | ((prev: Thread[]) => Thread[])) => {
    setThreads(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      threadsRef.current = next
      changedAt.current = Math.max(Date.now(), changedAt.current + 1)
      scheduleSave()
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
    const remaining = threads.filter(t => t.id !== id)
    if (remaining.length === 0) {
      const newT = makeThread()
      setThreadsAndSave([newT])
      setActiveId(newT.id)
      return
    }
    setThreadsAndSave(remaining)
    if (id === activeId) setActiveId(remaining[0].id)
  }, [threads, activeId, setThreadsAndSave])

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
    booted,
    storageError,
  }
}
