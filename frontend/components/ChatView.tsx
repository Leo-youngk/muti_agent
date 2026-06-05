'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Message } from '@/lib/types'
import type { AdvisorId } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'
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
  onRetryAdvisor: (advisorId: AdvisorId) => void
  onExamplePrompt: (prompt: string) => void
  onDebate: () => void
  isStreaming: boolean
}

export default function ChatView({ messages, onFollowUp, onRegenerate, onRetryAdvisor, onExamplePrompt, onDebate, isStreaming }: Props) {
  const advisorMap = useAdvisorMap()
  // activeAdvisors: all advisors (from context) — used for the empty state badges
  const allAdvisors = Object.values(advisorMap)

  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
          {allAdvisors.map(a => (
            <span key={a.id} className="text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ borderColor: `${a.color}44`, color: a.color, background: `${a.color}0D` }}>
              {a.icon} {a.name}
            </span>
          ))}
        </div>
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {messages.map(msg => {
            // ── 用户消息 ──────────────────────────────────────────────────────
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] bg-[#0D0D0D] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              )
            }

            // ── 顾问面板 ─────────────────────────────────────────────────────
            if (msg.role === 'panel' && msg.panel) {
              const { judgments, advisorStatus, analysis, analysisStatus, streamingTexts, analysisStream } = msg.panel
              const activeAdvisors = Object.values(advisorMap).filter(
                a => advisorStatus[a.id] !== undefined && advisorStatus[a.id] !== 'idle'
              )
              const isLastPanel = msg === panelMessages.at(-1)
              const isThisFollowUp = !!msg.followUpMeta
              const isDebateRound = !!msg.isDebateRound

              const doneCount = activeAdvisors.filter(a => {
                const s = advisorStatus[a.id as AdvisorId]
                return s === 'done' || s === 'error'
              }).length
              const totalCount = activeAdvisors.length
              const allDone = doneCount === totalCount && totalCount > 0
              const showProgress = isLastPanel && isStreaming && !allDone && totalCount > 1

              return (
                <div key={msg.id} className="space-y-5">

                  {/* ── 场景标签 ── */}
                  {(isThisFollowUp || isDebateRound) && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex-1 h-px" style={{ background: isDebateRound ? '#F59E0B44' : '#E0E0E0' }} />
                      <span className="font-medium flex items-center gap-1"
                        style={{ color: isDebateRound ? '#F59E0B' : '#BBB' }}>
                        {isDebateRound
                          ? <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              辩论轮
                            </>
                          : '追问模式'
                        }
                      </span>
                      <span className="flex-1 h-px" style={{ background: isDebateRound ? '#F59E0B44' : '#E0E0E0' }} />
                    </div>
                  )}

                  {/* ── 进度条 ── */}
                  {showProgress && (
                    <div className="flex items-center gap-3 pl-12">
                      <div className="flex-1 h-0.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#CCCCCC] rounded-full transition-all duration-500"
                          style={{ width: `${(doneCount / totalCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#CCC] shrink-0 tabular-nums">
                        {doneCount}/{totalCount}
                      </span>
                    </div>
                  )}

                  {/* ── 顾问消息流 ── */}
                  <div className="space-y-5">
                    {activeAdvisors.map(a => {
                      const aid = a.id as AdvisorId
                      const status = advisorStatus[aid]
                      const showFollowUp = status === 'done' && isLastPanel && !isStreaming
                      const showRetry = status === 'error' && !judgments[aid] && isLastPanel && !isStreaming
                      return (
                        <AdvisorCard
                          key={a.id}
                          advisorId={aid}
                          status={status}
                          judgment={judgments[aid]}
                          streamingText={streamingTexts?.[aid]}
                          onFollowUp={showFollowUp ? () => onFollowUp(aid) : undefined}
                          onRetry={showRetry ? () => onRetryAdvisor(aid) : undefined}
                        />
                      )
                    })}
                  </div>

                  {/* ── 分歧 + 结论 ── */}
                  <ConclusionSection analysis={analysis} status={analysisStatus} streamingText={analysisStream} />

                  {/* ── 操作按钮 ── */}
                  {isLastPanel && !isStreaming && analysisStatus !== 'thinking' && (
                    <div className="flex justify-center gap-3 pl-12 pt-1">
                      <button
                        onClick={onRegenerate}
                        className="flex items-center gap-1.5 text-xs text-[#CCC] hover:text-[#555] transition-colors px-3 py-1.5 rounded-full hover:bg-[#F5F5F5]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重新生成
                      </button>
                      {!isThisFollowUp && !isDebateRound && allDone && totalCount > 1 && (
                        <button
                          onClick={onDebate}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#F59E0B] hover:text-[#D97706] transition-colors px-3 py-1.5 rounded-full hover:bg-[#FFFBEB] border border-[#F59E0B33]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          深入辩论
                        </button>
                      )}
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
