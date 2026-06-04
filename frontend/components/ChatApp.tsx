'use client'

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from '@/components/Sidebar'
import ChatView from '@/components/ChatView'
import InputBar from '@/components/InputBar'
import type {
  Message,
  Thread,
  PanelResult,
  StreamEvent,
  AdvisorId,
  AdvisorJudgment,
  CrossAnalysis,
  HistoryMessage,
} from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'

function makeThread(): Thread {
  return { id: uuidv4().slice(0, 8), title: '新问题', messages: [], createdAt: Date.now() }
}

function makeInitialPanel(): PanelResult {
  const advisorStatus = Object.fromEntries(
    ADVISORS.map(a => [a.id, 'idle' as const])
  ) as Record<AdvisorId, 'idle'>
  return {
    judgments: {},
    advisorStatus,
    streamingTexts: {},
    analysisStatus: 'idle',
    analysisStream: '',
  }
}

/** 从历史消息中提取对话上下文，供后端注入到 LLM 上下文 */
function buildHistory(messages: Message[]): HistoryMessage[] {
  const result: HistoryMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'panel' && msg.panel?.analysis) {
      const { verdict, top_voices } = msg.panel.analysis.conclusion
      result.push({
        role: 'assistant',
        content: `[顾问团综合判断] 最值得听：${top_voices.join('、')}。主持人结论：${verdict}`,
      })
    }
  }
  // 最近 3 轮（6 条）
  return result.slice(-6)
}

export default function ChatApp() {
  const [threads, setThreads] = useState<Thread[]>(() => [makeThread()])
  const [activeId, setActiveId] = useState<string>(() => threads[0]?.id ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeThread = threads.find(t => t.id === activeId) ?? threads[0]

  const updateThread = useCallback((id: string, fn: (t: Thread) => Thread) => {
    setThreads(prev => prev.map(t => t.id === id ? fn(t) : t))
  }, [])

  const updatePanel = useCallback((threadId: string, msgId: string, fn: (p: PanelResult) => PanelResult) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t
      return {
        ...t,
        messages: t.messages.map(m =>
          m.id === msgId && m.panel ? { ...m, panel: fn(m.panel) } : m
        ),
      }
    }))
  }, [])

  const newThread = useCallback(() => {
    const t = makeThread()
    setThreads(prev => [t, ...prev])
    setActiveId(t.id)
  }, [])

  const handleSubmit = useCallback(async (task: string) => {
    if (!task.trim() || isStreaming) return
    setError(null)
    setIsStreaming(true)
    const tid = activeId

    // 在更新 state 之前捕获当前消息，用于构建 history
    const currentMessages = threads.find(t => t.id === tid)?.messages ?? []
    const history = buildHistory(currentMessages)

    // 用户消息
    const userMsg: Message = { id: uuidv4(), role: 'user', content: task }
    // 面板消息
    const panelMsgId = uuidv4()
    const panelMsg: Message = { id: panelMsgId, role: 'panel', content: '', panel: makeInitialPanel() }

    updateThread(tid, t => ({
      ...t,
      title: t.messages.length === 0 ? task.slice(0, 40).trim() : t.title,
      messages: [...t.messages, userMsg, panelMsg],
    }))

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, thread_id: tid, history }),
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
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6).trim()
          if (!data) continue
          let evt: StreamEvent
          try { evt = JSON.parse(data) } catch { continue }

          if (evt.event === 'advisor_start' && evt.advisorId) {
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              advisorStatus: { ...p.advisorStatus, [evt.advisorId!]: 'thinking' },
            }))
          } else if (evt.event === 'advisor_token' && evt.advisorId && evt.token) {
            // token 流：追加到对应顾问的 streamingText
            const id = evt.advisorId
            const tok = evt.token
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              streamingTexts: {
                ...p.streamingTexts,
                [id]: (p.streamingTexts[id] ?? '') + tok,
              },
            }))
          } else if (evt.event === 'advisor_complete' && evt.advisorId) {
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
            const tok = evt.token
            updatePanel(tid, panelMsgId, p => ({
              ...p,
              analysisStream: p.analysisStream + tok,
            }))
          } else if (evt.event === 'analysis_complete') {
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
      setError(e instanceof Error ? e.message : String(e))
    }

    setIsStreaming(false)
  }, [activeId, isStreaming, threads, updateThread, updatePanel])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar threads={threads} activeId={activeId} onSelectThread={setActiveId} onNewThread={newThread} />
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 border-b border-[#EBEBEB] flex items-center px-6">
          <span className="text-sm font-medium text-[#555]">
            顾问团 &middot; Thread{' '}
            <code className="bg-[#F0F0F0] rounded px-1.5 py-0.5 text-xs text-[#333]">{activeId}</code>
          </span>
        </header>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-[#FFF5F5] border border-[#FFCDD2] rounded-xl text-sm text-[#C62828] flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[#C62828]">✕</button>
          </div>
        )}

        <ChatView messages={activeThread?.messages ?? []} />
        <InputBar onSubmit={handleSubmit} isStreaming={isStreaming} />
      </main>
    </div>
  )
}
