'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import { useCopy } from '@/lib/hooks'
import { extractStreamingFields } from '@/lib/parseStreaming'
import {
  formatAgentIndex,
  getVisibleJudgmentSections,
} from '@/lib/discussionPresentation'

interface Props {
  index: number
  meta: AdvisorMeta
  status: AdvisorStatus
  judgment?: AdvisorJudgment
  streamingText?: string
  errorDetail?: string
  onFollowUp?: () => void
  onRetry?: () => void
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: content }) => <p className="mb-3 last:mb-0">{content}</p>,
        ul: ({ children: content }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{content}</ul>
        ),
        ol: ({ children: content }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{content}</ol>
        ),
        li: ({ children: content }) => <li>{content}</li>,
        strong: ({ children: content }) => (
          <strong className="font-semibold">{content}</strong>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export default function AgentResponseSection({
  index,
  meta,
  status,
  judgment,
  streamingText,
  errorDetail,
  onFollowUp,
  onRetry,
}: Props) {
  const { copied, copy } = useCopy()
  const streamData = useMemo(() => {
    if (status !== 'thinking' || !streamingText || streamingText.length < 20) return null
    return extractStreamingFields(streamingText)
  }, [status, streamingText])

  const data = judgment ?? streamData ?? undefined
  const sections = getVisibleJudgmentSections(data)
  const isStreaming = status === 'thinking' && sections.length > 0

  const copyText = () => {
    const content = [
      meta.name,
      data?.stance,
      ...sections.flatMap(section => [section.label, section.value]),
    ].filter(Boolean).join('\n\n')
    copy(content)
  }

  return (
    <section
      className="border-t border-[var(--line)] py-10 first:border-t-0"
      aria-labelledby={`agent-${index}`}
    >
      <header className="mb-8">
        <div className="flex items-baseline gap-4">
          <span className="text-[15px] tabular-nums text-[var(--text-faint)]">
            {formatAgentIndex(index)}
          </span>
          <h2
            id={`agent-${index}`}
            className="text-[17px] font-semibold text-[var(--text)]"
          >
            {meta.name}
          </h2>
        </div>
        {data?.stance && (
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">{data.stance}</p>
        )}
        {status === 'thinking' && sections.length === 0 && (
          <p className="mt-4 text-[13px] text-[var(--text-muted)]">正在思考…</p>
        )}
      </header>

      {sections.length > 0 && (
        <div className="space-y-7">
          {sections.map(section => (
            <section key={section.key}>
              <h3 className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                {section.label}
              </h3>
              <div
                className={section.prominent
                  ? 'text-xl font-semibold leading-[1.55] text-[var(--text)]'
                  : 'text-base font-normal leading-7 text-[var(--text)]'}
              >
                <Markdown>{section.value}</Markdown>
              </div>
            </section>
          ))}
        </div>
      )}

      {isStreaming && (
        <p className="mt-7 text-[13px] text-[var(--text-muted)]">正在生成…</p>
      )}

      {status === 'error' && !judgment && (
        <p className="text-sm leading-6 text-[var(--error)]">
          请求失败{errorDetail ? `：${errorDetail}` : ''}。
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-2 min-h-11 underline underline-offset-4"
            >
              重试
            </button>
          )}
        </p>
      )}

      {(onFollowUp || judgment) && (
        <div className="mt-7 flex flex-wrap gap-x-6 text-sm">
          {onFollowUp && (
            <button
              onClick={onFollowUp}
              className="min-h-11 font-medium text-[var(--action)] underline decoration-transparent underline-offset-4 hover:decoration-current"
            >
              追问此 Agent
            </button>
          )}
          {judgment && (
            <button
              onClick={copyText}
              className="min-h-11 text-[var(--text-muted)] underline decoration-transparent underline-offset-4 hover:decoration-current"
            >
              {copied ? '已复制' : '复制回答'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
