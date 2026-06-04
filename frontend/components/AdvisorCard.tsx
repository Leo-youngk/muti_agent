'use client'

import { useState } from 'react'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import { ADVISOR_MAP } from '@/lib/advisors'
import type { AdvisorId } from '@/lib/types'

interface Props {
  advisorId: AdvisorId
  status: AdvisorStatus
  judgment?: AdvisorJudgment
  /** advisor_token 流累积的原始文本，用于在 thinking 阶段实时展示 */
  streamingText?: string
}

const STANCE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  '支持':         { label: '支持',       color: '#16A34A', bg: '#F0FDF4' },
  '反对':         { label: '反对',       color: '#DC2626', bg: '#FEF2F2' },
  '有条件支持':   { label: '有条件支持', color: '#D97706', bg: '#FFFBEB' },
  '需要更多信息': { label: '待定',       color: '#6B7280', bg: '#F9FAFB' },
}

export default function AdvisorCard({ advisorId, status, judgment, streamingText }: Props) {
  const [expanded, setExpanded] = useState(false)
  const meta = ADVISOR_MAP[advisorId]
  const stance = judgment ? (STANCE_STYLE[judgment.stance] ?? STANCE_STYLE['需要更多信息']) : null

  return (
    <div
      className="rounded-2xl border bg-white overflow-hidden transition-all duration-300"
      style={{ borderColor: `${meta.color}22`, borderLeftWidth: 3, borderLeftColor: meta.color }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold" style={{ color: meta.color }}>{meta.icon}</span>
            <div>
              <span className="text-sm font-semibold text-[#0D0D0D]">{meta.name}</span>
              <span className="ml-2 text-xs text-[#999]">{meta.nameEn}</span>
            </div>
          </div>
          {stance && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: stance.color, background: stance.bg }}
            >
              {stance.label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#BBB]">{meta.tagline}</p>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">

        {/* ── 思考中：展示 token 流 ── */}
        {status === 'thinking' && (
          <div>
            {streamingText ? (
              <StreamingBlock text={streamingText} color={meta.color} />
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: meta.color, animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-[#999]">正在思考…</span>
              </div>
            )}
          </div>
        )}

        {/* ── 完成：结构化展示 ── */}
        {(status === 'done' || status === 'error') && judgment && (
          <div className="space-y-3">
            {/* 核心判断 */}
            <p className="text-[15px] font-medium text-[#0D0D0D] leading-relaxed">
              {judgment.core_judgment}
            </p>

            {/* 推理 */}
            <p className="text-sm text-[#444] leading-relaxed">
              {judgment.reasoning}
            </p>

            {/* 批评 */}
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: `${meta.color}0D`, borderLeft: `3px solid ${meta.color}` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: meta.color }}>
                核心批评
              </p>
              <p className="text-sm text-[#0D0D0D] leading-relaxed">{judgment.criticism}</p>
            </div>

            {/* 展开/收起 */}
            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs font-medium transition-colors"
                style={{ color: meta.color }}
              >
                展开完整判断 ▾
              </button>
            ) : (
              <div className="space-y-3 pt-1">
                <DetailRow label="关注焦点" value={judgment.focus} />
                <DetailRow label="要求改变" value={judgment.demand} />
                <DetailRow label="如何切入" value={judgment.approach} />
                <DetailRow label="他的盲点" value={judgment.blind_spot} color="#999" italic />
                <button
                  onClick={() => setExpanded(false)}
                  className="text-xs font-medium text-[#BBB]"
                >
                  收起 ▴
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 错误且无 judgment ── */}
        {status === 'error' && !judgment && (
          <p className="text-sm text-[#DC2626]">判断获取失败，已跳过</p>
        )}
      </div>
    </div>
  )
}

// ── 流式文本展示块 ────────────────────────────────────────────────────────────

function StreamingBlock({ text, color }: { text: string; color: string }) {
  // 只展示最近 400 字符，避免卡片高度无限增长
  const visible = text.length > 400 ? '…' + text.slice(-400) : text

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: `${color}08`, border: `1px solid ${color}22` }}
    >
      <div
        className="px-3 py-1.5 flex items-center gap-1.5"
        style={{ background: `${color}10`, borderBottom: `1px solid ${color}22` }}
      >
        {/* 动态圆点 */}
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: color }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
          生成中
        </span>
      </div>
      <pre
        className="px-3 py-2.5 text-[11px] text-[#555] font-mono leading-relaxed whitespace-pre-wrap break-words"
        style={{ maxHeight: '9rem', overflow: 'hidden' }}
      >
        {visible}
      </pre>
    </div>
  )
}

function DetailRow({ label, value, color, italic }: {
  label: string; value: string; color?: string; italic?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-1">{label}</p>
      <p className={`text-sm leading-relaxed ${italic ? 'italic' : ''}`} style={{ color: color ?? '#333' }}>
        {value}
      </p>
    </div>
  )
}
