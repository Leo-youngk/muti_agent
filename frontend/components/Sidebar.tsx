'use client'

import type { Thread } from '@/lib/types'

const AGENTS = [
  { name: 'Researcher',  color: '#2563EB', icon: '🔍' },
  { name: 'Critic',      color: '#D97706', icon: '🧐' },
  { name: 'Synthesizer', color: '#16A34A', icon: '✨' },
]

interface Props {
  threads: Thread[]
  activeId: string
  onSelectThread: (id: string) => void
  onNewThread: () => void
}

export default function Sidebar({ threads, activeId, onSelectThread, onNewThread }: Props) {
  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-[#F7F7F8] border-r border-[#EBEBEB]">
      <div className="px-5 h-14 flex items-center border-b border-[#EBEBEB]">
        <span className="text-base font-semibold tracking-tight text-[#0D0D0D]">Multi-Agent</span>
      </div>

      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onNewThread}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-[#0D0D0D] hover:bg-[#E8E8E8] transition-colors duration-150"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#999] px-1 mb-1">
          Conversations
        </p>
        {threads.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectThread(t.id)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm truncate transition-colors duration-150 ${
              t.id === activeId
                ? 'bg-white text-[#0D0D0D] font-medium shadow-sm'
                : 'text-[#555] hover:bg-[#E8E8E8] hover:text-[#0D0D0D]'
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 border-t border-[#EBEBEB]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#999] mb-2">Agents</p>
        <div className="space-y-1.5">
          {AGENTS.map(a => (
            <div key={a.name} className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
              <span className="text-xs text-[#555]">{a.icon} {a.name}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
