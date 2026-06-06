'use client'

import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import type { AdvisorId } from '@/lib/types'
import { useAdvisorMeta } from '@/lib/AdvisorContext'
import { useCopy } from '@/lib/hooks'
import { extractStreamingFields } from '@/lib/parseStreaming'

interface Props {
  advisorId: AdvisorId
  status: AdvisorStatus
  judgment?: AdvisorJudgment
  streamingText?: string
  onFollowUp?: () => void
  onRetry?: () => void
  isFollowUpTarget?: boolean
}

const STANCE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  '支持':         { label: '支持',       color: '#16A34A', bg: '#F0FDF4' },
  '反对':         { label: '反对',       color: '#DC2626', bg: '#FEF2F2' },
  '有条件支持':   { label: '有条件支持', color: '#D97706', bg: '#FFFBEB' },
  '需要更多信息': { label: '待定',       color: '#6B7280', bg: '#F9FAFB' },
}

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => <span>{c}</span>,
        strong: ({ children: c }) => <strong className="font-semibold">{c}</strong>,
        ul: ({ children: c }) => <ul className="list-disc pl-4 space-y-0.5">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal pl-4 space-y-0.5">{c}</ol>,
        li: ({ children: c }) => <li>{c}</li>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export default function AdvisorCard({
  advisorId, status, judgment, streamingText, onFollowUp, onRetry, isFollowUpTarget,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const { copied, copy } = useCopy()
  const meta = useAdvisorMeta(advisorId)

  const streamFields = useMemo(() => {
    if (status !== 'thinking' || !streamingText || streamingText.length < 20) return null
    return extractStreamingFields(streamingText)
  }, [status, streamingText])

  const displayData = judgment ?? streamFields
  const stance = displayData?.stance
    ? (STANCE_STYLE[displayData.stance] ?? STANCE_STYLE['需要更多信息'])
    : null
  const isStreaming = status === 'thinking' && !!streamFields

  const getJudgmentText = () => {
    if (!judgment) return ''
    return [
      `【${judgment.advisor}】${judgment.stance}`,
      `核心判断：${judgment.core_judgment}`,
      `推理：${judgment.reasoning}`,
      `核心批评：${judgment.criticism}`,
      judgment.focus && `关注焦点：${judgment.focus}`,
      judgment.demand && `要求改变：${judgment.demand}`,
      judgment.approach && `如何切入：${judgment.approach}`,
      `盲点：${judgment.blind_spot}`,
    ].filter(Boolean).join('\n')
  }

  return (
    <div className="flex items-start gap-3 group">

      {/* ── 头像 ── */}
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-white mt-0.5 select-none"
        style={{
          background: meta.color,
          boxShadow: isFollowUpTarget ? `0 0 0 3px ${meta.color}44` : undefined,
        }}
      >
        {meta.icon}
      </div>

      {/* ── 消息体 ── */}
      <div className="flex-1 min-w-0">

        {/* 名字行 */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-sm font-semibold text-[#0D0D0D]">{meta.name}</span>
          <span className="text-xs text-[#BBB] hidden sm:inline">{meta.nameEn}</span>
          {isStreaming && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color }} />
          )}
          {stance && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: stance.color, background: stance.bg }}>
              {stance.label}
            </span>
          )}
          {status === 'done' && judgment && (
            <button
              onClick={() => copy(getJudgmentText())}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[#CCC] hover:text-[#888]"
              title="复制"
            >
              {copied ? (
                <svg className="w-3.5 h-3.5 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="1.8" />
                  <path strokeWidth="1.8" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* ── 思考中，无内容 ── */}
        {status === 'thinking' && !streamFields && (
          <div className="flex items-center gap-1.5 py-2">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: meta.color, animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}

        {/* ── 内容区 ── */}
        {displayData && (
          <div className="space-y-2.5">

            {/* 核心判断 */}
            {displayData.core_judgment && (
              <p className="text-[15px] font-medium text-[#0D0D0D] leading-relaxed">
                <Md>{displayData.core_judgment}</Md>
              </p>
            )}

            {/* 推理 */}
            {displayData.reasoning && (
              <div className="text-sm text-[#555] leading-relaxed">
                <Md>{displayData.reasoning}</Md>
              </div>
            )}

            {/* 核心批评 */}
            {displayData.criticism && (
              <div
                className="rounded-xl px-3.5 py-2.5"
                style={{ background: `${meta.color}0D`, borderLeft: `3px solid ${meta.color}` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: meta.color }}>
                  核心批评
                </p>
                <div className="text-sm text-[#0D0D0D] leading-relaxed">
                  <Md>{displayData.criticism}</Md>
                </div>
              </div>
            )}

            {/* 流式进行中 */}
            {isStreaming && !displayData.blind_spot && (
              <div className="flex items-center gap-1.5 text-xs text-[#CCC]">
                <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: meta.color }} />
                正在生成…
              </div>
            )}

            {/* 展开/收起详情 */}
            {!isStreaming && (displayData.focus || displayData.demand || displayData.approach || displayData.blind_spot) && (
              <>
                {!expanded ? (
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-xs font-medium transition-colors"
                    style={{ color: meta.color }}
                  >
                    展开完整判断 ▾
                  </button>
                ) : (
                  <div className="space-y-2.5 pt-2 border-t border-[#F0F0F0]">
                    {displayData.focus     && <Detail label="关注焦点" value={displayData.focus} />}
                    {displayData.demand    && <Detail label="要求改变" value={displayData.demand} />}
                    {displayData.approach  && <Detail label="如何切入" value={displayData.approach} />}
                    {displayData.blind_spot && <Detail label="他的盲点" value={displayData.blind_spot} muted />}
                    <button onClick={() => setExpanded(false)} className="text-xs text-[#CCC]">收起 ▴</button>
                  </div>
                )}
              </>
            )}

            {/* 追问按钮 */}
            {onFollowUp && (
              <button
                onClick={onFollowUp}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:opacity-80 active:scale-95"
                style={{ background: `${meta.color}12`, color: meta.color }}
              >
                <span>↗</span>
                <span>追问{meta.name}</span>
              </button>
            )}
          </div>
        )}

        {/* ── 错误且无判断 ── */}
        {status === 'error' && !judgment && (
          <div className="flex items-center gap-3 py-1">
            <p className="text-sm text-[#DC2626]">判断获取失败</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 text-xs font-medium text-[#555] hover:text-[#0D0D0D] px-2.5 py-1 rounded-full border border-[#DDDDE0] hover:bg-[#F5F5F5] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重试
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-0.5">{label}</p>
      <div className={`text-sm leading-relaxed ${muted ? 'text-[#999] italic' : 'text-[#333]'}`}>
        <Md>{value}</Md>
      </div>
    </div>
  )
}
