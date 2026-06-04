'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'
import type { AdvisorId } from '@/lib/types'
import AdvisorCard from './AdvisorCard'
import ConclusionSection from './ConclusionSection'

interface Props {
  messages: Message[]
  onFollowUp: (advisorId: AdvisorId) => void
  isStreaming: boolean
}

export default function ChatView({ messages, onFollowUp, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 select-none">
        <div className="w-14 h-14 rounded-2xl bg-[#F0F0F0] flex items-center justify-center mb-5 text-2xl">
          🎯
        </div>
        <h2 className="text-xl font-semibold text-[#0D0D0D] mb-3 tracking-tight">顾问团</h2>
        <p className="text-sm text-[#999] max-w-sm leading-relaxed mb-5">
          输入一个问题，让六位顾问各自判断，再由主持人分析分歧。
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {ADVISORS.map(a => (
            <span key={a.id} className="text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ borderColor: `${a.color}44`, color: a.color, background: `${a.color}0D` }}>
              {a.icon} {a.name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
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

          if (msg.role === 'panel' && msg.panel) {
            const {
              judgments,
              advisorStatus,
              analysis,
              analysisStatus,
              streamingTexts,
              analysisStream,
            } = msg.panel

            // 只渲染已经开始（非 idle）的顾问卡片，让卡片逐个出现
            const activeAdvisors = ADVISORS.filter(
              a => advisorStatus[a.id as AdvisorId] !== 'idle'
            )

            return (
              <div key={msg.id} className="space-y-4">
                {/* 顾问卡片：逐个出现，串行展示 */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeAdvisors.map(a => {
                    const aid = a.id as AdvisorId
                    const isDone = advisorStatus[aid] === 'done' || advisorStatus[aid] === 'error'
                    // 只在最后一条 panel 消息且未在 streaming 时才显示追问按钮
                    const isLastPanel = msg === messages.filter(m => m.role === 'panel').at(-1)
                    const showFollowUp = isDone && isLastPanel && !isStreaming
                    return (
                      <AdvisorCard
                        key={a.id}
                        advisorId={aid}
                        status={advisorStatus[aid]}
                        judgment={judgments[aid]}
                        streamingText={streamingTexts?.[aid]}
                        onFollowUp={showFollowUp ? () => onFollowUp(aid) : undefined}
                      />
                    )
                  })}
                </div>

                {/* 分歧 + 结论 */}
                <ConclusionSection
                  analysis={analysis}
                  status={analysisStatus}
                  streamingText={analysisStream}
                />
              </div>
            )
          }

          return null
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
