'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Message } from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'
import type { AdvisorId } from '@/lib/types'
import AdvisorCard from './AdvisorCard'
import ConclusionSection from './ConclusionSection'

const EXAMPLE_PROMPTS = [
  '我有个创业想法，请帮我判断一下可行性',
  'AI时代个人应该如何把握机会？',
  '如何判断一个商业模式是否有护城河？',
]

interface Props {
  messages: Message[]
  onFollowUp: (advisorId: AdvisorId) => void
  onRegenerate: () => void
  onExamplePrompt: (prompt: string) => void
  isStreaming: boolean
}

export default function ChatView({ messages, onFollowUp, onRegenerate, onExamplePrompt, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // 新消息自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 检测是否距底部超过 200px，显示回到底部按钮
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
  }, [])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // ── 空状态 ──────────────────────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 select-none">
        <div className="w-14 h-14 rounded-2xl bg-[#F0F0F0] flex items-center justify-center mb-5 text-2xl">
          🎯
        </div>
        <h2 className="text-xl font-semibold text-[#0D0D0D] mb-3 tracking-tight">顾问团</h2>
        <p className="text-sm text-[#999] max-w-sm leading-relaxed mb-5">
          输入一个问题，让四位顾问各自判断，再由主持人分析分歧。
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {ADVISORS.map(a => (
            <span key={a.id} className="text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ borderColor: `${a.color}44`, color: a.color, background: `${a.color}0D` }}>
              {a.icon} {a.name}
            </span>
          ))}
        </div>
        {/* 示例问题 */}
        <div className="w-full max-w-sm space-y-2">
          <p className="text-[11px] text-[#CCC] uppercase tracking-widest mb-3">试试这些问题</p>
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => onExamplePrompt(p)}
              className="w-full text-left text-sm px-4 py-3 rounded-xl border border-[#EBEBEB]
                         text-[#444] hover:bg-[#F7F7F8] hover:border-[#DDD] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── 消息列表 ─────────────────────────────────────────────────────────────────
  const panelMessages = messages.filter(m => m.role === 'panel')

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
      >
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
              const { judgments, advisorStatus, analysis, analysisStatus, streamingTexts, analysisStream } = msg.panel
              const activeAdvisors = ADVISORS.filter(a => advisorStatus[a.id as AdvisorId] !== 'idle')
              const isLastPanel = msg === panelMessages.at(-1)
              const isThisFollowUp = !!msg.followUpMeta

              return (
                <div key={msg.id} className="space-y-4">
                  {/* 追问标签 */}
                  {isThisFollowUp && msg.followUpMeta && (
                    <div className="flex items-center gap-2 text-xs text-[#BBB]">
                      <span className="w-4 h-px bg-[#E0E0E0]" />
                      追问模式
                      <span className="flex-1 h-px bg-[#E0E0E0]" />
                    </div>
                  )}

                  {/* 顾问卡片 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {activeAdvisors.map(a => {
                      const aid = a.id as AdvisorId
                      const isDone = advisorStatus[aid] === 'done' || advisorStatus[aid] === 'error'
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
                  <ConclusionSection analysis={analysis} status={analysisStatus} streamingText={analysisStream} />

                  {/* 重新生成按钮（最后一条完整 panel）*/}
                  {isLastPanel && !isStreaming && analysisStatus !== 'thinking' && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={onRegenerate}
                        className="flex items-center gap-1.5 text-xs text-[#999] hover:text-[#555] transition-colors px-3 py-1.5 rounded-full hover:bg-[#F5F5F5]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重新生成
                      </button>
                    </div>
                  )}
                </div>
              )
            }

            return null
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 回到底部浮动按钮 */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-9 h-9 bg-white border border-[#EBEBEB] rounded-full shadow-md
                     flex items-center justify-center text-[#555] hover:bg-[#F5F5F5] transition-all z-10"
          title="回到底部"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}
