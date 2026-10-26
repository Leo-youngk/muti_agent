'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type {
  Message, Thread, PanelResult, StreamEvent, AdvisorId,
  AdvisorJudgment, PriorTurn,
  FollowUpMeta, AppSettings, ResearchResult,
} from './types'
import { resolveModelTarget } from './modelSelection'
import { buildConversationContext, buildPreviousJudgments } from './conversation'
import { getPartialJudgment, interruptAdvisor, normalizeJudgment } from './judgment'
import type { AdvisorMeta } from './advisors'
import { makeInitialPanel } from './useThreads'
import { getPanelAdvisors } from './discussionPresentation'
import { PROMPT_VERSION } from './advisorPrompt'

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const HEALTH_TIMEOUT = 50_000        // 放宽：50s 无数据才断开
const CLIENT_RETRY_MAX = 1            // 减少客户端重试：只重试 1 次
const RETRY_BASE_DELAY = 2000         // 重试前等 2s
const ADVISOR_CONCURRENCY = 2         // 降低并发：同时最多 2 个
const ADVISOR_STAGGER_MS = 800        // 每个顾问启动间隔 800ms

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── 并发控制器 ──────────────────────────────────────────────────────────────

/**
 * 带限速保护的并发控制器
 * 策略：顺序启动、并行执行。每隔 staggerMs 启动一个任务，
 * 但已启动的任务并行运行（最多 concurrency 个同时进行）。
 * 这样既保证请求错开，又保持并行加速。
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  staggerMs = 0,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  const running = new Set<Promise<void>>()

  for (let i = 0; i < tasks.length; i++) {
    if (signal?.aborted) break
    // 等待间隔（第一个不等）
    if (staggerMs > 0 && i > 0) await sleep(staggerMs)
    if (signal?.aborted) break

    // 如果达到并发上限，等一个完成
    if (running.size >= concurrency) {
      await Promise.race(running)
    }

    // 启动任务
    const idx = i
    const p = tasks[idx]().then(r => { results[idx] = r }).catch(() => {}).finally(() => running.delete(p))
    running.add(p)
  }

  // 等待所有剩余任务完成
  await Promise.all(running)
  return results
}

// ─── 历史构建 ─────────────────────────────────────────────────────────────────

/**
 * 取该 agent 最近一次成功作答的「提问 + 它自己的判断」。
 * 服务端会把它还原成一对 user/assistant 消息，assistant 轮是合法 JSON——
 * 模型模仿上一条 assistant 的格式，喂纯文本摘要会让它这轮也不输出 JSON。
 */
export function buildPriorTurn(messages: Message[], advisorId: AdvisorId): PriorTurn | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'panel' || !msg.panel) continue
    const judgment = msg.panel.judgments[advisorId]
    if (!judgment) continue
    for (let k = i - 1; k >= 0; k--) {
      if (messages[k].role === 'user') return { question: messages[k].content, judgment }
    }
    return null
  }
  return null
}

// ─── SSE 读取工具 ─────────────────────────────────────────────────────────────

interface SSEReaderCallbacks {
  onAdvisorStart?: () => void
  onAdvisorToken?: (token: string) => void
  onAdvisorComplete?: (judgment: AdvisorJudgment | null, error?: string, status?: StreamEvent['status']) => void
  onError?: (error: string) => void
}

async function readSSEStream(
  res: Response,
  callbacks: SSEReaderCallbacks,
  signal: AbortSignal,
): Promise<boolean> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastDataTime = Date.now()
  let completed = false

  const healthCheck = setInterval(() => {
    if (Date.now() - lastDataTime > HEALTH_TIMEOUT) {
      clearInterval(healthCheck)
      reader.cancel().catch(() => {})
    }
  }, 5000)

  const onAbort = () => { clearInterval(healthCheck); reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      lastDataTime = Date.now()
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith(':') || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()
        if (!data) continue
        let evt: StreamEvent
        try { evt = JSON.parse(data) } catch { continue }

        switch (evt.event) {
          case 'advisor_start':   callbacks.onAdvisorStart?.(); break
          case 'advisor_token':   if (evt.token) callbacks.onAdvisorToken?.(evt.token); break
          case 'advisor_complete':
            callbacks.onAdvisorComplete?.(evt.judgment as AdvisorJudgment | null, evt.error, evt.status)
            completed = true; break
          case 'error':
            callbacks.onError?.(evt.error ?? 'Unknown error')
            completed = true; break
        }
      }
    }
  } catch {
    if (signal.aborted) return false
  } finally {
    clearInterval(healthCheck)
    signal.removeEventListener('abort', onAbort)
  }
  return completed
}

// ─── Token 批量刷新 ──────────────────────────────────────────────────────────

interface TokenBuffer {
  advisorTokens: Partial<Record<AdvisorId, string>>
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

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const currentPanelRef = useRef<{ tid: string; msgId: string } | null>(null)
  const tokenBuffer = useRef<TokenBuffer>({ advisorTokens: {} })
  const rafRef = useRef<number | null>(null)

  useEffect(() => () => {
    for (const controller of abortControllersRef.current.values()) controller.abort()
    abortControllersRef.current.clear()
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming, isStreamingRef])

  // ── RAF flush ─────────────────────────────────────────────────────────────

  const flushTokens = useCallback(() => {
    rafRef.current = null
    const buf = tokenBuffer.current
    const panel = currentPanelRef.current
    if (!panel) return

    const { tid, msgId } = panel
    const advisorChunks = { ...buf.advisorTokens }
    buf.advisorTokens = {}

    if (Object.keys(advisorChunks).length === 0) return

    updatePanel(tid, msgId, p => {
      const newTexts = { ...p.streamingTexts }
      for (const [id, chunk] of Object.entries(advisorChunks)) {
        newTexts[id as AdvisorId] = (newTexts[id as AdvisorId] ?? '') + chunk
      }
      return { ...p, streamingTexts: newTexts }
    })
  }, [updatePanel])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushTokens)
    }
  }, [flushTokens])

  // ── 停止所有请求 ──────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    flushTokens()
    for (const [, ctrl] of abortControllersRef.current) ctrl.abort()
    abortControllersRef.current.clear()
    if (currentPanelRef.current) {
      const { tid, msgId } = currentPanelRef.current
      updatePanel(tid, msgId, p => Object.entries(p.advisorStatus).reduce(
        (panel, [id, status]) => status === 'thinking' || status === 'queued' ? interruptAdvisor(panel, id, '已停止生成', true) : panel,
        p,
      ))
    }
  }, [updatePanel, flushTokens])

  const handleFollowUp = useCallback((advisorId: AdvisorId) => {
    setTargetAdvisor(advisorId)
  }, [])

  // ── API 公共参数 ──────────────────────────────────────────────────────────

  function makeApiBase(settings: AppSettings, selectedModel: string) {
    const target = resolveModelTarget(settings, selectedModel)
    if (!target) throw new Error('所选模型已失效，请重新选择服务商和模型。')
    const provider = target.provider
    return {
      model: target.model,
      clientApiKey: provider ? provider.apiKey || undefined : settings.apiKey || undefined,
      clientBaseUrl: provider ? provider.baseUrl || undefined : settings.baseUrl || undefined,
      // 高级参数：传给服务端路由（undefined 时由服务端用默认值处理）
      temperature: settings.temperature ?? 'auto',
      maxTokensCap: settings.maxTokensCap,
      timeoutMs: settings.timeoutMs,
    }
  }

  // ── 单个 advisor 请求（含客户端重试 + 健康超时）──────────────────────────

  const fetchSingleAdvisor = useCallback(async (
    advisor: AdvisorMeta,
    requestPayload: Record<string, unknown>,
    tid: string,
    panelMsgId: string,
    globalAbort: AbortSignal,
  ): Promise<AdvisorJudgment | null> => {
    const advisorId = advisor.id as AdvisorId

    for (let attempt = 0; attempt <= CLIENT_RETRY_MAX; attempt++) {
      if (globalAbort.aborted) return null
      updatePanel(tid, panelMsgId, p => ({ ...p, advisorStatus: { ...p.advisorStatus, [advisorId]: 'thinking' } }))
      if (attempt > 0) {
        updatePanel(tid, panelMsgId, p => ({
          ...p,
          advisorStatus: { ...p.advisorStatus, [advisorId]: 'thinking' },
        }))
        await sleep(RETRY_BASE_DELAY * attempt)
      }
      if (globalAbort.aborted) return null

      const perAbort = new AbortController()
      const onGlobalAbort = () => perAbort.abort()
      globalAbort.addEventListener('abort', onGlobalAbort, { once: true })

      try {
        const res = await fetch('/api/chat/advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: perAbort.signal,
          body: JSON.stringify({
            ...requestPayload,
            advisorId: advisor.id,
            advisorName: advisor.name,
            profile: advisor.profile,
          }),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          globalAbort.removeEventListener('abort', onGlobalAbort)
          if (attempt === CLIENT_RETRY_MAX || (res.status < 500 && res.status !== 429)) {
            let detail = `HTTP ${res.status}`
            try { detail = JSON.parse(errText).error || detail } catch {}
            updatePanel(tid, panelMsgId, p => interruptAdvisor(p, advisorId, detail))
            return null
          }
          continue
        }

        let result: AdvisorJudgment | null = null

        const completed = await readSSEStream(res, {
          onAdvisorStart: () => {
            // 服务端每次重试都会重发 advisor_start。不清掉上一次尝试已经显示出来的
            // 半截输出，两次内容会直接叠在一起。
            flushTokens()
            updatePanel(tid, panelMsgId, p => {
              const previous = getPartialJudgment(p.streamingTexts[advisorId], advisor.name)
              return {
              ...p,
              judgments: previous ? { ...p.judgments, [advisorId]: previous } : p.judgments,
              advisorStatus: { ...p.advisorStatus, [advisorId]: 'thinking' },
              streamingTexts: { ...p.streamingTexts, [advisorId]: '' },
            }})
          },
          onAdvisorToken: (token) => {
            tokenBuffer.current.advisorTokens[advisorId] =
              (tokenBuffer.current.advisorTokens[advisorId] ?? '') + token
            scheduleFlush()
          },
          onAdvisorComplete: (judgment, errMsg, status) => {
            flushTokens()
            if (globalAbort.aborted) return
            const complete = !errMsg && status !== 'partial' && status !== 'error' ? normalizeJudgment(judgment, advisor.name) : null
            result = complete ?? normalizeJudgment(judgment, advisor.name, true)
            updatePanel(tid, panelMsgId, p => result ? {
              ...p,
              advisorStatus: { ...p.advisorStatus, [advisorId]: complete ? 'done' : 'partial' },
              judgments: { ...p.judgments, [advisorId]: result! },
              advisorErrors: { ...p.advisorErrors, [advisorId]: complete ? undefined : errMsg || '回答尚未完整生成' },
            } : interruptAdvisor(p, advisorId, errMsg || '服务端未返回完整判断'))
          },
          onError: (errMsg) => {
            flushTokens()
            if (!globalAbort.aborted) updatePanel(tid, panelMsgId, p => interruptAdvisor(p, advisorId, errMsg))
          },
        }, perAbort.signal)

        globalAbort.removeEventListener('abort', onGlobalAbort)
        if (globalAbort.aborted) return null
        if (completed) return result

        if (attempt === CLIENT_RETRY_MAX) {
          flushTokens()
          updatePanel(tid, panelMsgId, p => interruptAdvisor(p, advisorId, '连接中断，已保留可读内容'))
          return null
        }
      } catch (err) {
        globalAbort.removeEventListener('abort', onGlobalAbort)
        if (globalAbort.aborted) return null
        if (attempt === CLIENT_RETRY_MAX) {
          flushTokens()
          updatePanel(tid, panelMsgId, p => interruptAdvisor(p, advisorId, err instanceof Error ? err.message : '网络错误'))
          return null
        }
      }
    }
    return null
  }, [updatePanel, scheduleFlush, flushTokens])

  // ── 重试单个失败的顾问 ───────────────────────────────────────────────────

  const handleRetryAdvisor = useCallback(async (
    threadId: string,
    panelMsgId: string,
    advisorId: AdvisorId,
    task: string,
    settings: AppSettings,
    selectedModel: string,
    messages: Message[],
    activeAdvisors: AdvisorMeta[],
  ) => {
    // 与主请求/其他重试串行，避免踩踏共享的 currentPanelRef
    if (isStreaming) return
    const targetMessage = messages.find(m => m.id === panelMsgId)
    if (!targetMessage?.panel) return
    const advisor = getPanelAdvisors(targetMessage.panel, activeAdvisors).find(a => a.id === advisorId)
    if (!advisor?.profile) { setError('这位历史顾问没有可用档案，请先在设置中恢复配置。'); return }

    let apiBase: ReturnType<typeof makeApiBase>
    try { apiBase = makeApiBase(settings, selectedModel) } catch (error) { setError((error as Error).message); return }
    const customProfile = !targetMessage?.panel?.participants ? settings.customProfiles[advisorId as keyof typeof settings.customProfiles] : undefined
    const advisorWithProfile = customProfile ? { ...advisor, profile: customProfile } : advisor

    const earlierMessages = messages.slice(0, messages.findIndex(m => m.id === panelMsgId))
    const previousJudgments = buildPreviousJudgments(earlierMessages)
    const isFollowUp = messages.find(m => m.id === panelMsgId)?.followUpMeta?.isFollowUp === true

    updatePanel(threadId, panelMsgId, p => ({
      ...p,
      model: { model: apiBase.model, providerId: resolveModelTarget(settings, selectedModel)?.providerId },
      promptVersion: PROMPT_VERSION,
      advisorStatus: { ...p.advisorStatus, [advisorId]: 'thinking' },
    }))

    // 重试期间纳入流式管控：禁用输入/新提交，并提供停止按钮
    setIsStreaming(true)
    tokenBuffer.current.advisorTokens = {}
    currentPanelRef.current = { tid: threadId, msgId: panelMsgId }
    const globalAbort = new AbortController()
    abortControllersRef.current.set(`retry_${advisorId}`, globalAbort)

    try {
      await fetchSingleAdvisor(
        advisorWithProfile,
        {
          ...apiBase, task, isFollowUp,
          context: buildConversationContext(earlierMessages.filter(m => m.id !== earlierMessages.at(-1)?.id), advisorId),
          ...(isFollowUp && previousJudgments.length > 0 ? { previousJudgments } : {}),
          ...(targetMessage?.panel?.research ? { research: targetMessage.panel.research } : {}),
        },
        threadId, panelMsgId, globalAbort.signal,
      )
    } finally {
      abortControllersRef.current.delete(`retry_${advisorId}`)
      // 只在 currentPanelRef 仍指向本面板时清理，避免踩掉并发的其他请求
      const cur = currentPanelRef.current
      if (cur && cur.tid === threadId && cur.msgId === panelMsgId) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        flushTokens()
        currentPanelRef.current = null
      }
      setIsStreaming(false)
    }
  }, [isStreaming, updatePanel, flushTokens, fetchSingleAdvisor])

  // ── 主提交 ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (
    task: string,
    activeId: string,
    threads: Thread[],
    selectedModel: string,
    settings: AppSettings,
    activeAdvisors: AdvisorMeta[],
  ) => {
    if (!task.trim() || isStreaming) return
    const tid = activeId
    const isFollowUp = targetAdvisor !== null

    const currentMessages = threads.find(t => t.id === tid)?.messages ?? []
    const historicalAdvisor = [...currentMessages].reverse().flatMap(m => m.panel?.participants ?? []).find(a => a.id === targetAdvisor)
    const advisorsToCall = isFollowUp
      ? [historicalAdvisor ?? activeAdvisors.find(a => a.id === targetAdvisor)].filter((a): a is AdvisorMeta => Boolean(a?.profile))
      : activeAdvisors

    if (advisorsToCall.length === 0) {
      setError('当前没有启用的 Agent，请在设置里至少保留一个。')
      return
    }

    const targetModel = resolveModelTarget(settings, selectedModel)
    if (!targetModel) { setError('请先选择可用的服务商和模型。'); return }
    const apiBase = makeApiBase(settings, selectedModel)

    setError(null)
    setIsStreaming(true)
    // 清掉上一次请求可能残留的未 flush token
    tokenBuffer.current.advisorTokens = {}

    const previousJudgments = isFollowUp ? buildPreviousJudgments(currentMessages) : []
    const advisorsWithProfiles = advisorsToCall.map(a => {
      const cp = !isFollowUp ? settings.customProfiles[a.id as keyof typeof settings.customProfiles] : undefined
      return cp ? { ...a, profile: cp } : a
    })

    const userMsg: Message = { id: uuidv4(), role: 'user', content: task }
    const panelMsgId = uuidv4()
    const followUpMeta: FollowUpMeta | undefined = isFollowUp && targetAdvisor
      ? { targetAdvisorId: targetAdvisor, isFollowUp: true }
      : undefined

    const panelMsg: Message = {
      id: panelMsgId, role: 'panel', content: '',
      panel: { ...makeInitialPanel(advisorsWithProfiles), model: { model: targetModel.model, providerId: targetModel.providerId } }, followUpMeta,
    }

    updateThread(tid, t => ({
      ...t,
      title: t.messages.length === 0 ? task.slice(0, 40).trim() : t.title,
      messages: [...t.messages, userMsg, panelMsg],
    }))

    currentPanelRef.current = { tid, msgId: panelMsgId }
    setTargetAdvisor(null)

    const globalAbort = new AbortController()
    abortControllersRef.current.set('main', globalAbort)

    try {
      let research: ResearchResult | undefined
      if (settings.webSearch?.enabled) {
        updatePanel(tid, panelMsgId, p => ({ ...p, research: { status: 'searching', sources: [] } }))
        try {
          const response = await fetch('/api/chat/research', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: globalAbort.signal,
            body: JSON.stringify({ query: isFollowUp ? `${currentMessages.filter(m => m.role === 'user').at(-1)?.content ?? ''}\n${task}` : task, clientSearchApiKey: settings.webSearch.apiKey }),
          })
          const data = await response.json() as ResearchResult
          research = data && Array.isArray(data.sources) && ['ready', 'partial', 'unavailable'].includes(data.status)
            ? data : { status: 'unavailable', sources: [], error: '检索服务返回了无效资料' }
        } catch {
          research = { status: 'unavailable', sources: [], error: globalAbort.signal.aborted ? '查证已停止' : '网络中断，未能查证资料' }
        }
        updatePanel(tid, panelMsgId, p => ({ ...p, research }))
      }

      const basePayload: Record<string, unknown> = {
        ...apiBase, task, isFollowUp,
        ...(research ? { research } : {}),
        ...(previousJudgments.length > 0 ? { previousJudgments } : {}),
      }

      const advisorTasks = advisorsWithProfiles.map(advisor => async () => {
        return fetchSingleAdvisor(
          advisor,
          { ...basePayload, context: buildConversationContext(currentMessages, advisor.id) },
          tid, panelMsgId, globalAbort.signal,
        )
      })

      await runWithConcurrency(advisorTasks, ADVISOR_CONCURRENCY, ADVISOR_STAGGER_MS, globalAbort.signal)
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      abortControllersRef.current.delete('main')
      // 必须先 flush 再清 panel ref —— flushTokens 依赖它定位面板，
      // 顺序反了会丢掉最后一批 token。
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      flushTokens()
      currentPanelRef.current = null
      setIsStreaming(false)
    }
  }, [isStreaming, targetAdvisor, updateThread, updatePanel, flushTokens, fetchSingleAdvisor])

  // ── iOS 可见性恢复检测 ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (!isStreamingRef.current) return
      setTimeout(() => {
        if (!isStreamingRef.current) return
        if (abortControllersRef.current.size === 0) {
          setIsStreaming(false)
        }
      }, 3000)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isStreamingRef])

  return {
    isStreaming, error, setError,
    targetAdvisor, setTargetAdvisor,
    handleStop, handleFollowUp,
    handleSubmit, handleRetryAdvisor,
  }
}
