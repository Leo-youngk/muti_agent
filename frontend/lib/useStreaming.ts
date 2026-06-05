'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type {
  Message, Thread, PanelResult, StreamEvent, AdvisorId,
  AdvisorJudgment, CrossAnalysis, HistoryMessage, PreviousJudgment,
  FollowUpMeta, AppSettings,
} from './types'
import type { AdvisorMeta } from './advisors'
import { makeInitialPanel } from './useThreads'

// ─── 历史构建 ─────────────────────────────────────────────────────────────────

function buildHistory(messages: Message[]): HistoryMessage[] {
  const result: HistoryMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'panel' && msg.panel) {
      const { judgments, analysis } = msg.panel
      const parts: string[] = []
      const advisorLines = Object.values(judgments)
        .filter((j): j is AdvisorJudgment => j != null)
        .map(j => `• ${j.advisor}（${j.stance}）：${j.core_judgment}`)
      if (advisorLines.length > 0) {
        parts.push(`[上一轮顾问立场]\n${advisorLines.join('\n')}`)
      }
      if (analysis) {
        parts.push(`[主持人结论] ${analysis.conclusion.verdict}`)
      }
      if (parts.length > 0) {
        result.push({ role: 'assistant', content: parts.join('\n\n') })
      }
    }
  }
  return result.slice(-6)
}

export function buildPreviousJudgments(messages: Message[]): PreviousJudgment[] {
  const recentPanel = [...messages].reverse().find(m => m.role === 'panel' && m.panel)
  if (!recentPanel?.panel) return []
  return Object.entries(recentPanel.panel.judgments)
    .filter(([, j]) => j != null)
    .map(([id, j]) => ({ advisorId: id as AdvisorId, judgment: j! }))
}

// ─── Token 批量刷新（减少 React re-render）─────────────────────────────────────

interface TokenBuffer {
  advisorTokens: Partial<Record<AdvisorId, string>>
  analysisTokens: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStreaming(
  updateThread: (id: string, fn: (t: Thread) => Thread) => void,
  updatePanel: (threadId: string, msgId: string, fn: (p: PanelResult) => PanelResult) => void,
  isStreamingRef: React.MutableRefObject<boolean>,
) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetAdvisor, setTargetAdvisor] = useState<AdvisorId | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Token 批量缓冲区
  const tokenBuffer = useRef<TokenBuffer>({ advisorTokens: {}, analysisTokens: '' })
  const currentPanelRef = useRef<{ tid: string; msgId: string } | null>(null)
  const rafRef = useRef<number | null>(null)

  // 同步 isStreaming 到 ref（供其他 hooks 读取）
  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming, isStreamingRef])

  // RAF flush：将缓冲的 token 批量 flush 到 React state
  const flushTokens = useCallback(() => {
    rafRef.current = null
    const buf = tokenBuffer.current
    const panel = currentPanelRef.current
    if (!panel) return

    const { tid, msgId } = panel
    const advisorChunks = { ...buf.advisorTokens }
    const analysisChunk = buf.analysisTokens

    // 清空缓冲
    buf.advisorTokens = {}
    buf.analysisTokens = ''

    const hasAdvisor = Object.keys(advisorChunks).length > 0
    const hasAnalysis = analysisChunk.length > 0
    if (!hasAdvisor && !hasAnalysis) return

    updatePanel(tid, msgId, p => {
      let next = p
      if (hasAdvisor) {
        const newTexts = { ...next.streamingTexts }
        for (const [id, chunk] of Object.entries(advisorChunks)) {
          newTexts[id as AdvisorId] = (newTexts[id as AdvisorId] ?? '') + chunk
        }
        next = { ...next, streamingTexts: newTexts }
      }
      if (hasAnalysis) {
        next = { ...next, analysisStream: next.analysisStream + analysisChunk }
      }
      return next
    })
  }, [updatePanel])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushTokens)
    }
  }, [flushTokens])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const handleFollowUp = useCallback((advisorId: AdvisorId) => {
    setTargetAdvisor(advisorId)
  }, [])

  /** 重试单个失败的顾问 */
  const handleRetryAdvisor = useCallback(async (
    threadId: string,
    panelMsgId: string,
    advisorId: AdvisorId,
    task: string,
    settings: AppSettings,
    selectedModel: string,
    messages: Message[],
  ) => {
    const history = buildHistory(messages)

    // 标记为 thinking
    updatePanel(threadId, panelMsgId, p => ({
      ...p,
      advisorStatus: { ...p.advisorStatus, [advisorId]: 'thinking' },
      streamingTexts: { ...p.streamingTexts, [advisorId]: '' },
    }))

    currentPanelRef.current = { tid: threadId, msgId: panelMsgId }

    try {
      const controller = new AbortController()
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          task,
          history,
          model: selectedModel,
          clientApiKey: settings.apiKey || undefined,
          clientBaseUrl: settings.baseUrl || undefined,
          customProfiles: Object.keys(settings.customProfiles).length > 0
            ? settings.customProfiles : undefined,
          targetAdvisor: advisorId,
          customAdvisors: settings.customAdvisors?.length ? settings.customAdvisors : undefined,
          hiddenAdvisors: settings.hiddenAdvisors?.length ? settings.hiddenAdvisors : undefined,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6).trim()
          if (!data) continue
          let evt: StreamEvent
          try { evt = JSON.parse(data) } catch { continue }

          if (evt.event === 'advisor_token' && evt.advisorId && evt.token) {
            tokenBuffer.current.advisorTokens[evt.advisorId] =
              (tokenBuffer.current.advisorTokens[evt.advisorId] ?? '') + evt.token
            scheduleFlush()
          } else if (evt.event === 'advisor_complete' && evt.advisorId) {
            // flush remaining tokens
            flushTokens()
            updatePanel(threadId, panelMsgId, p => ({
              ...p,
              advisorStatus: { ...p.advisorStatus, [evt.advisorId!]: evt.judgment ? 'done' : 'error' },
              judgments: evt.judgment
                ? { ...p.judgments, [evt.advisorId!]: evt.judgment as AdvisorJudgment }
                : p.judgments,
            }))
          }
        }
      }
    } catch {
      updatePanel(threadId, panelMsgId, p => ({
        ...p,
        advisorStatus: { ...p.advisorStatus, [advisorId]: 'error' },
      }))
    } finally {
      currentPanelRef.current = null
    }
  }, [updatePanel, flushTokens, scheduleFlush])

  const handleSubmit = useCallback(async (
    task: string,
    activeId: string,
    threads: Thread[],
    selectedModel: string,
    settings: AppSettings,
    activeAdvisors: AdvisorMeta[],
  ) => {
    if (!task.trim() || isStreaming) return
    setError(null)
    setIsStreaming(true)
    const tid = activeId
    const isFollowUp = targetAdvisor !== null

    const currentMessages = threads.find(t => t.id === tid)?.messages ?? []
    const history = buildHistory(currentMessages)
    const previousJudgments = isFollowUp ? buildPreviousJudgments(currentMessages) : []

    const userMsg: Message = { id: uuidv4(), role: 'user', content: task }
    const panelMsgId = uuidv4()
    const followUpMeta: FollowUpMeta | undefined = isFollowUp && targetAdvisor
      ? { targetAdvisorId: targetAdvisor, isFollowUp: true }
      : undefined
    const panelMsg: Message = {
      id: panelMsgId, role: 'panel', content: '',
      panel: makeInitialPanel(activeAdvisors), followUpMeta,
    }

    updateThread(tid, t => ({
      ...t,
      title: t.messages.length === 0 ? task.slice(0, 40).trim() : t.title,
      messages: [...t.messages, userMsg, panelMsg],
    }))

    currentPanelRef.current = { tid, msgId: panelMsgId }

    const capturedTarget = targetAdvisor
    setTargetAdvisor(null)

    try {
      const controller = new AbortController()
      abortControllerRef.current = controller

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          task,
          thread_id: tid,
          history,
          model: selectedModel,
          clientApiKey: settings.apiKey || undefined,
          clientBaseUrl: settings.baseUrl || undefined,
          customProfiles: Object.keys(settings.customProfiles).length > 0
            ? settings.customProfiles : undefined,
          targetAdvisor: capturedTarget ?? undefined,
          previousJudgments: previousJudgments.length > 0 ? previousJudgments : undefined,
          followUpAnalysis: isFollowUp,
          customAdvisors: settings.customAdvisors?.length ? settings.customAdvisors : undefined,
          hiddenAdvisors: settings.hiddenAdvisors?.length ? settings.hiddenAdvisors : undefined,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        let detail = text
        try { detail = JSON.parse(text).error ?? text } catch {}
        throw new Error(detail)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          // 心跳和注释行：跳过
          if (trimmed.startsWith(':') || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6).trim()
          if (!data) continue
          let evt: StreamEvent
          try { evt = JSON.parse(data) } catch { continue }

          if (evt.event === 'advisor_start' && evt.advisorId) {
            updatePanel(tid, panelMsgId, p => ({
              ...p, advisorStatus: { ...p.advisorStatus, [evt.advisorId!]: 'thinking' },
            }))
          } else if (evt.event === 'advisor_token' && evt.advisorId && evt.token) {
            // 缓冲 token，由 RAF 批量 flush
            tokenBuffer.current.advisorTokens[evt.advisorId] =
              (tokenBuffer.current.advisorTokens[evt.advisorId] ?? '') + evt.token
            scheduleFlush()
          } else if (evt.event === 'advisor_complete' && evt.advisorId) {
            // 先 flush 剩余 token
            flushTokens()
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              advisorStatus: {
                ...p.advisorStatus,
                [evt.advisorId!]: evt.judgment ? 'done' : 'error',
              },
              judgments: evt.judgment
                ? { ...p.judgments, [evt.advisorId!]: evt.judgment as AdvisorJudgment }
                : p.judgments,
            }))
          } else if (evt.event === 'analysis_start') {
            updatePanel(tid, panelMsgId, p => ({ ...p, analysisStatus: 'thinking' }))
          } else if (evt.event === 'analysis_token' && evt.token) {
            tokenBuffer.current.analysisTokens += evt.token
            scheduleFlush()
          } else if (evt.event === 'analysis_complete') {
            flushTokens()
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              analysisStatus: 'done',
              analysis: evt.analysis as CrossAnalysis ?? undefined,
            }))
          } else if (evt.event === 'error') {
            setError(evt.error ?? 'Unknown error')
            break
          } else if (evt.event === 'complete') {
            break
          }
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      abortControllerRef.current = null
      currentPanelRef.current = null
      setIsStreaming(false)
      // 取消未 flush 的 RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        flushTokens()  // flush 最后一批
      }
    }
  }, [isStreaming, targetAdvisor, updateThread, updatePanel, flushTokens, scheduleFlush])

  return {
    isStreaming,
    error,
    setError,
    targetAdvisor,
    setTargetAdvisor,
    handleStop,
    handleFollowUp,
    handleSubmit,
    handleRetryAdvisor,
  }
}
