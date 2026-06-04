'use client'

import type { Message } from '@/lib/types'

const AGENTS: Record<string, { color: string; bg: string; icon: string; initials: string }> = {
  Researcher: { color: '#2563EB', bg: '#DBEAFE', icon: '🔍', initials: 'R' },
  Critic:     { color: '#D97706', bg: '#FEF3C7', icon: '🧐', initials: 'C' },
  Synthesizer:{ color: '#16A34A', bg: '#DCFCE7', icon: '✨', initials: 'S' },
}

export default function AgentCard({ message }: { message: Message }) {
  const cfg = AGENTS[message.agent ?? ''] ?? {
    color: '#888', bg: '#F0F0F0', icon: '🤖', initials: '?',
  }
  const { status, content, agent } = message

  return (
    <div className="flex items-start gap-3 py-1">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.initials}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>
            {cfg.icon} {agent}
          </span>
          {status === 'thinking' && (
            <span className="text-xs text-[#999]">
              <ThinkingDots />
            </span>
          )}
          {status === 'done' && content && (
            <span className="text-[11px] text-[#BBB]">done</span>
          )}
        </div>

        {/* Content */}
        {status === 'waiting' || (!content && status !== 'thinking') ? (
          <ThinkingDots />
        ) : (
          <p className="text-sm text-[#0D0D0D] leading-7 whitespace-pre-wrap break-words">
            {content}
            {status === 'thinking' && (
              <span
                className="inline-block w-[2px] h-4 ml-0.5 rounded-sm align-middle"
                style={{ background: cfg.color, animation: 'cursor-blink 0.9s step-end infinite' }}
              />
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 h-5">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-[#CCC] animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}
