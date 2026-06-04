'use client'

import { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from '@/components/Sidebar'
import ChatView from '@/components/ChatView'
import InputBar from '@/components/InputBar'
import type { Message, Thread } from '@/lib/types'
import { streamChat } from '@/lib/stream'

const AGENT_ORDER = ['Researcher', 'Critic', 'Synthesizer'] as const

function makeThread(): Thread {
  return {
    id: uuidv4().slice(0, 8),
    title: 'New conversation',
    messages: [],
    createdAt: Date.now(),
  }
}

export default function Page() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [engine, setEngine] = useState<'langgraph' | 'autogen'>('langgraph')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = makeThread()
    setThreads([t])
    setActiveId(t.id)
    setMounted(true)
  }, [])

  const activeThread = threads.find(t => t.id === activeId) ?? threads[0]

  if (!mounted) return null

  const updateThread = useCallback((id: string, fn: (t: Thread) => Thread) => {
    setThreads(prev => prev.map(t => (t.id === id ? fn(t) : t)))
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

    // User message
    const userMsg: Message = { id: uuidv4(), role: 'user', content: task }
    updateThread(tid, t => ({
      ...t,
      title: t.messages.length === 0 ? task.slice(0, 45).trim() : t.title,
      messages: [...t.messages, userMsg],
    }))

    // Pre-create agent placeholder cards (waiting state)
    const agentMsgs: Message[] = AGENT_ORDER.map(agent => ({
      id: uuidv4(),
      role: 'agent' as const,
      content: '',
      agent,
      status: 'waiting' as const,
    }))
    updateThread(tid, t => ({ ...t, messages: [...t.messages, ...agentMsgs] }))

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

    try {
      for await (const evt of streamChat(task, engine, tid, backendUrl)) {
        switch (evt.event) {
          case 'agent_start':
            if (evt.agent) {
              updateThread(tid, t => ({
                ...t,
                messages: t.messages.map(m =>
                  m.agent === evt.agent ? { ...m, status: 'thinking' } : m
                ),
              }))
            }
            break

          case 'token':
            if (evt.agent && evt.content) {
              updateThread(tid, t => ({
                ...t,
                messages: t.messages.map(m =>
                  m.agent === evt.agent
                    ? { ...m, content: m.content + evt.content }
                    : m
                ),
              }))
            }
            break

          case 'agent_complete':
            if (evt.agent) {
              updateThread(tid, t => ({
                ...t,
                messages: t.messages.map(m =>
                  m.agent === evt.agent ? { ...m, status: 'done' } : m
                ),
              }))
            }
            break

          case 'error':
            setError(evt.error ?? 'Unknown error')
            // Mark all still-waiting agents as done so UI doesn't hang
            updateThread(tid, t => ({
              ...t,
              messages: t.messages.map(m =>
                m.role === 'agent' && m.status !== 'done' ? { ...m, status: 'done' } : m
              ),
            }))
            break

          case 'complete':
            // Ensure all agent cards show "done"
            updateThread(tid, t => ({
              ...t,
              messages: t.messages.map(m =>
                m.role === 'agent' && m.status !== 'done' ? { ...m, status: 'done' } : m
              ),
            }))
            break
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      updateThread(tid, t => ({
        ...t,
        messages: t.messages.map(m =>
          m.role === 'agent' && m.status !== 'done' ? { ...m, status: 'done' } : m
        ),
      }))
    }

    setIsStreaming(false)
  }, [activeId, engine, isStreaming, updateThread])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        threads={threads}
        activeId={activeId}
        engine={engine}
        onSelectThread={setActiveId}
        onNewThread={newThread}
        onChangeEngine={setEngine}
      />

      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-[#EBEBEB] flex items-center px-6">
          <span className="text-sm font-medium text-[#555]">
            {engine === 'langgraph' ? 'LangGraph' : 'AutoGen'} &middot; Thread{' '}
            <code className="bg-[#F0F0F0] rounded px-1.5 py-0.5 text-xs text-[#333]">
              {activeId}
            </code>
          </span>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-[#FFF5F5] border border-[#FFCDD2] rounded-xl text-sm text-[#C62828] flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto shrink-0 text-[#C62828] hover:text-[#B71C1C]"
            >
              ✕
            </button>
          </div>
        )}

        <ChatView messages={activeThread.messages} />

        <InputBar onSubmit={handleSubmit} isStreaming={isStreaming} engine={engine} />
      </main>
    </div>
  )
}
