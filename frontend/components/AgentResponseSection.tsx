'use client'

import { memo, useMemo } from 'react'
import { Streamdown } from 'streamdown'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import { useCopy } from '@/lib/hooks'
import { extractStreamingFields } from '@/lib/parseStreaming'
import {
  formatAgentIndex,
  getVisibleJudgmentSections,
  type JudgmentSection,
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

function Field({ section, streaming }: { section: JudgmentSection; streaming: boolean }) {
  return (
    <section>
      {!section.hideLabel && (
        <h3 className="mb-1 text-xs font-semibold text-[var(--text-muted)]">
          {section.label}
        </h3>
      )}
      <Streamdown
        mode={streaming ? 'streaming' : 'static'}
        isAnimating={streaming}
        animated={{ animation: 'fadeIn', sep: 'word', duration: 260 }}
        controls={{ table: { copy: true, download: false, fullscreen: false }, code: false }}
        lineNumbers={false}
        className={[
          // space-y-2 让 tailwind-merge 顶掉 Streamdown 默认的 space-y-4，把块间距收到 8px
          'zen-prose space-y-2 text-[var(--text)]',
          section.prominent
            ? 'text-xl font-semibold leading-[1.5] tracking-[-0.01em]'
            : 'text-base font-normal leading-[26px]',
        ].join(' ')}
      >
        {section.value}
      </Streamdown>
    </section>
  )
}

function AgentResponseSection({
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
      className="py-6 first:pt-2"
      aria-labelledby={`agent-${index}`}
    >
      <header className="mb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px] tabular-nums text-[var(--text-faint)]">
            {formatAgentIndex(index)}
          </span>
          <h2
            id={`agent-${index}`}
            className="text-[17px] font-semibold text-[var(--text)]"
          >
            {meta.name}
          </h2>
          {data?.stance && (
            <p className="text-[13px] text-[var(--text-muted)]">{data.stance}</p>
          )}
        </div>
        {status === 'thinking' && sections.length === 0 && (
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">正在思考…</p>
        )}
      </header>

      {sections.length > 0 && (
        <div className="space-y-4">
          {sections.map(section => (
            <Field key={section.key} section={section} streaming={isStreaming} />
          ))}
        </div>
      )}

      {isStreaming && (
        <p className="mt-4 text-[13px] text-[var(--text-muted)]">正在生成…</p>
      )}

      {status === 'error' && (
        <p className="text-sm leading-6 text-[var(--error)]">
          {judgment ? '生成中断' : '请求失败'}{errorDetail ? `：${errorDetail}` : ''}。
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

      {status === 'idle' && !judgment && sections.length === 0 && onRetry && (
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          已停止。
          <button
            onClick={onRetry}
            className="ml-2 min-h-11 text-[var(--action)] underline underline-offset-4"
          >
            生成本节
          </button>
        </p>
      )}

      {(onFollowUp || judgment) && (
        <div className="-mb-2 mt-2 flex flex-wrap gap-x-6 text-[13px]">
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

export default memo(AgentResponseSection)
