'use client'

import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import type { AdvisorId } from '@/lib/types'
import { ADVISOR_MAP } from '@/lib/advisors'

interface Props {
  onSubmit: (task: string) => void
  isStreaming: boolean
  /** 当前选中的追问顾问，null 表示全团模式 */
  targetAdvisor?: AdvisorId | null
  onClearTarget?: () => void
}

export default function InputBar({ onSubmit, isStreaming, targetAdvisor, onClearTarget }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSubmit(trimmed)
    setValue('')
    if (ref.current) ref.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  const targetMeta = targetAdvisor ? ADVISOR_MAP[targetAdvisor] : null
  const isFollowUpMode = !!targetMeta

  return (
    <div className="border-t border-[#EBEBEB] bg-white px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-2">

        {/* 追问模式提示 chip */}
        {isFollowUpMode && targetMeta && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: `${targetMeta.color}12`, color: targetMeta.color, border: `1px solid ${targetMeta.color}30` }}
            >
              <span>{targetMeta.icon}</span>
              <span>追问 {targetMeta.name}</span>
              <span className="text-[10px] opacity-60">（仅他能看到本轮所有观点）</span>
            </div>
            <button
              onClick={onClearTarget}
              className="text-xs text-[#BBB] hover:text-[#888] transition-colors"
              title="取消追问，恢复全团模式"
            >
              ✕ 取消
            </button>
          </div>
        )}

        <div className={`flex items-end gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150 ${
          isStreaming
            ? 'border-[#EBEBEB] bg-[#FAFAFA]'
            : isFollowUpMode
              ? 'bg-white focus-within:border-current'
              : 'border-[#DDDDE0] bg-white focus-within:border-[#0D0D0D]'
        }`}
          style={isFollowUpMode && targetMeta ? { borderColor: `${targetMeta.color}50` } : undefined}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? '顾问正在回答…'
                : isFollowUpMode && targetMeta
                  ? `追问 ${targetMeta.name}…  (Enter ↵ 发送)`
                  : 'Message Multi-Agent…  (Enter ↵ to send)'
            }
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm text-[#0D0D0D]
                       placeholder-[#AAA] leading-relaxed max-h-48 disabled:cursor-not-allowed"
          />
          <button
            onClick={submit}
            disabled={!value.trim() || isStreaming}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150
                       text-white disabled:opacity-25 hover:enabled:opacity-80 active:enabled:scale-95"
            style={{ background: isFollowUpMode && targetMeta ? targetMeta.color : '#0D0D0D' }}
          >
            {isStreaming ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-[11px] text-[#BBB] text-center">
          {isFollowUpMode ? 'Shift+Enter 换行 · ✕ 取消追问恢复全团模式' : 'Shift+Enter for new line'}
        </p>
      </div>
    </div>
  )
}
