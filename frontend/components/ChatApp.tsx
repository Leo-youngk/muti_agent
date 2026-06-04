'use client'

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from '@/components/Sidebar'
import ChatView from '@/components/ChatView'
import InputBar from '@/components/InputBar'
import type { Message, Thread } from '@/lib/types'
import { streamChat } from '@/lib/stream'

const AGENT_ORDER = ['Researcher', 'Critic', 'Synthesizer'] as const

function makeThread(): Thread {
  return { id: uuidv4().slice(0, 8), title: 'New conversation', messages: [], createdAt: Date.now() }
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

    const userMsg: Message = { id: uuidv4(), role: 'user', content: task }
    updateThread(tid, t => ({
      ...t,
      title: t.messages.length === 0 ? task.slice(0, 45).trim() : t.title,
      messages: [...t.messages, userMsg],
    }))

    const agentMsgs: Message[] = AGENT_ORDER.map(agent => ({
      id: uuidv4(), role: 'agent' as const, content: '', agent, status: 'waiting' as const,
    }))
    updateThread(tid, t => ({ ...t, messages: [...t.messages, ...agentMsgs] }))

    try {
      for await (const evt of streamChat(task, tid)) {
        if (evt.event === 'agent_start' && evt.agent) {
          updateThread(tid, t => ({
            ...t, messages: t.messages.map(m => m.agent === evt.agent ? { ...m, status: 'thinking' } : m),
          }))
        } else if (evt.event === 'token' && evt.agent && evt.content) {
          updateThread(tid, t => ({
            ...t, messages: t.messages.map(m =>
              m.agent === evt.agent ? { ...m, content: m.content + evt.content } : m),
          }))
        } else if (evt.event === 'agent_complete' && evt.agent) {
          updateThread(tid, t => ({
            ...t, messages: t.messages.map(m => m.agent === evt.agent ? { ...m, status: 'done' } : m),
          }))
        } else if (evt.event === 'error') {
          setError(evt.error ?? 'Unknown error')
          break
        } else if (evt.event === 'complete') {
          break
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }

    updateThread(tid, t => ({
      ...t, messages: t.messages.map(m =>
        m.role === 'agent' && m.status !== 'done' ? { ...m, status: 'done' } : m),
    }))
    setIsStreaming(false)
  }, [activeId, isStreaming, updateThread])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar threads={threads} activeId={activeId} onSelectThread={setActiveId} onNewThread={newThread} />
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 border-b border-[#EBEBEB] flex items-center px-6">
          <span className="text-sm font-medium text-[#555]">
            Thread{' '}
            <code className="bg-[#F0F0F0] rounded px-1.5 py-0.5 text-xs text-[#333]">{activeId}</code>
          </span>
        </header>
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-[#FFF5F5] border border-[#FFCDD2] rounded-xl text-sm text-[#C62828] flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[#C62828] hover:text-[#B71C1C]">✕</button>
          </div>
        )}
        <ChatView messages={activeThread?.messages ?? []} />
        <InputBar onSubmit={handleSubmit} isStreaming={isStreaming} />
      </main>
    </div>
  )
}
