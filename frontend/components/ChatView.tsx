'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorId, Message } from '@/lib/types'
import { getOrderedActiveAdvisors } from '@/lib/discussionPresentation'
import AgentResponseSection from './AgentResponseSection'

interface Props {
  messages: Message[]
  advisors: AdvisorMeta[]
  onFollowUp: (advisorId: AdvisorId) => void
  onRegenerate: () => void
  onRetryAdvisor: (advisorId: AdvisorId) => void
  onStartDiscussion: () => void
  onContinueDiscussion: () => void
  onDebate: () => void
  isStreaming: boolean
}

export default function ChatView({
  messages,
  advisors,
  onFollowUp,
  onRegenerate,
  onRetryAdvisor,
  onStartDiscussion,
  onContinueDiscussion,
  onDebate,
  isStreaming,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const [hasNewContent, setHasNewContent] = useState(false)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    isNearBottomRef.current = true
    setHasNewContent(false)
  }, [])

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
      setHasNewContent(false)
    } else {
      setHasNewContent(true)
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 160
    isNearBottomRef.current = nearBottom
    if (nearBottom) setHasNewContent(false)
  }, [])

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[680px] flex-1 flex-col justify-center px-5 max-[360px]:px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          开始一个讨论
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-[var(--text-muted)]">
          提出一个问题，多个 Agent 会按顺序给出完整判断。
        </p>
        <button
          onClick={onStartDiscussion}
          className="mt-8 min-h-11 w-fit text-sm font-medium text-[var(--action)] underline underline-offset-4"
        >
          提出问题
        </button>
      </div>
    )
  }

  const panelMessages = messages.filter(message => message.role === 'panel')

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-[680px] px-5 pb-24 pt-7 max-[360px]:px-4">
          {messages.map(message => {
            if (message.role === 'user') {
              return (
                <p
                  key={message.id}
                  className="mb-10 whitespace-pre-wrap text-[19px] font-medium leading-[1.65] tracking-[-0.01em] text-[var(--text)]"
                >
                  {message.content}
                </p>
              )
            }

            if (message.role !== 'panel' || !message.panel) return null

            const panel = message.panel
            const orderedAdvisors = getOrderedActiveAdvisors(advisors, panel.advisorStatus)
            const isLastPanel = message === panelMessages.at(-1)
            const isFollowUp = Boolean(message.followUpMeta)
            const isDebateRound = Boolean(message.isDebateRound)
            const allDone = orderedAdvisors.length > 0 && orderedAdvisors.every(meta => {
              const status = panel.advisorStatus[meta.id]
              return status === 'done' || status === 'error'
            })

            return (
              <article key={message.id} className="mb-12">
                {(isFollowUp || isDebateRound) && (
                  <p className="mb-3 border-t border-[var(--line)] pt-8 text-xs text-[var(--text-muted)]">
                    {isDebateRound
                      ? `第 ${panelMessages.indexOf(message) + 1} 轮讨论`
                      : '定向追问'}
                  </p>
                )}

                {orderedAdvisors.map((meta, index) => {
                  const status = panel.advisorStatus[meta.id]
                  const canAct = isLastPanel && !isStreaming
                  return (
                    <AgentResponseSection
                      key={meta.id}
                      index={index}
                      meta={meta}
                      status={status}
                      judgment={panel.judgments[meta.id]}
                      streamingText={panel.streamingTexts?.[meta.id]}
                      errorDetail={panel.advisorErrors?.[meta.id]}
                      onFollowUp={canAct && status === 'done'
                        ? () => onFollowUp(meta.id)
                        : undefined}
                      onRetry={canAct && status === 'error' && !panel.judgments[meta.id]
                        ? () => onRetryAdvisor(meta.id)
                        : undefined}
                    />
                  )
                })}

                {isLastPanel && allDone && !isStreaming && (
                  <div className="flex flex-wrap gap-x-6 border-t border-[var(--line)] py-10 text-sm">
                    <button
                      onClick={onContinueDiscussion}
                      className="min-h-11 font-medium text-[var(--action)]"
                    >
                      继续讨论
                    </button>
                    <button
                      onClick={onRegenerate}
                      className="min-h-11 text-[var(--text-muted)]"
                    >
                      重新生成本轮
                    </button>
                    {orderedAdvisors.length > 1 && !isFollowUp && !isDebateRound && (
                      <button
                        onClick={onDebate}
                        className="min-h-11 font-medium text-[var(--action)]"
                      >
                        发起下一轮讨论
                      </button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {hasNewContent && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-5 min-h-11 border border-[var(--line)] bg-[var(--page)] px-3 text-sm text-[var(--action)]"
        >
          查看新内容
        </button>
      )}
    </div>
  )
}
