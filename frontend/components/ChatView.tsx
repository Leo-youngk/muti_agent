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
  onRetryAdvisor: (advisorId: AdvisorId) => void
  isStreaming: boolean
}

export default function ChatView({
  messages,
  advisors,
  onFollowUp,
  onRetryAdvisor,
  isStreaming,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const scrollRafRef = useRef<number | null>(null)
  const [hasNewContent, setHasNewContent] = useState(false)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    isNearBottomRef.current = true
    setHasNewContent(false)
  }, [])

  useEffect(() => {
    if (!isNearBottomRef.current) {
      setHasNewContent(true)
      return
    }
    setHasNewContent(false)
    // 流式期间每帧都会重渲染：合并到一帧，且用 auto——smooth 每帧重启动画在 iOS 上会卡住
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      bottomRef.current?.scrollIntoView?.({ behavior: isStreaming ? 'auto' : 'smooth' })
    })
  }, [messages, isStreaming])

  useEffect(() => () => {
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current)
  }, [])

  const handleScroll = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 160
    isNearBottomRef.current = nearBottom
    if (nearBottom) setHasNewContent(false)
  }, [])

  if (messages.length === 0) {
    return (
      <div className="flex-1" />
    )
  }

  const panelMessages = messages.filter(message => message.role === 'panel')
  const lastPanelMessage = panelMessages.at(-1)

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-[680px] px-5 pb-8 pt-6 max-[360px]:px-4">
          {messages.map(message => {
            if (message.role === 'user') {
              return (
                <div key={message.id} className="mb-2 flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--bubble)] px-3.5 py-2.5 text-[15px] leading-[1.6] text-[var(--text)]">
                    {message.content}
                  </p>
                </div>
              )
            }

            if (message.role !== 'panel' || !message.panel) return null

            const panel = message.panel
            const orderedAdvisors = getOrderedActiveAdvisors(advisors, panel.advisorStatus)
            const isFollowUp = Boolean(message.followUpMeta)
            const isDebateRound = Boolean(message.isDebateRound)

            return (
              <article key={message.id} className="mb-8">
                {(isFollowUp || isDebateRound) && (
                  <p className="mb-2 pt-2 text-xs text-[var(--text-muted)]">
                    {isDebateRound
                      ? `第 ${panelMessages.indexOf(message) + 1} 轮讨论`
                      : '定向追问'}
                  </p>
                )}

                {orderedAdvisors.map((meta, index) => {
                  const status = panel.advisorStatus[meta.id]
                  const canAct = !isStreaming && message === lastPanelMessage
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
                      onRetry={canAct && (status === 'error' || status === 'idle')
                        ? () => onRetryAdvisor(meta.id)
                        : undefined}
                    />
                  )
                })}

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
