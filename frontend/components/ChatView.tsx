'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/lib/types'
import AgentCard from './AgentCard'

interface Props {
  messages: Message[]
}

export default function ChatView({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 select-none">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
          style={{ background: '#F0F0F0' }}
        >
          🤖
        </div>
        <h2 className="text-xl font-semibold text-[#0D0D0D] mb-2 tracking-tight">
          What can I help with?
        </h2>
        <p className="text-sm text-[#999] max-w-sm leading-relaxed">
          Describe your task below. Three AI agents — Researcher, Critic, and Synthesizer —
          will collaborate and stream their responses in real time.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {messages.map(msg => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-lg bg-[#F0F0F0] rounded-2xl px-4 py-3 text-sm text-[#0D0D0D] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            )
          }
          if (msg.role === 'agent') {
            return <AgentCard key={msg.id} message={msg} />
          }
          return null
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
