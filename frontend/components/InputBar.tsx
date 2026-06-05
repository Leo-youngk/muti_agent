'use client'

import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import type { AdvisorId } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'

interface Props {
  onSubmit: (task: string) => void
  isStreaming: boolean
  onStop?: () => void
  targetAdvisor?: AdvisorId | null
  onClearTarget?: () => void
}

export default function InputBar({ onSubmit, isStreaming, onStop, targetAdvisor, onClearTarget }: Props) {
  const advisorMap = useAdvisorMap()
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
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const targetMeta = targetAdvisor ? advisorMap[targetAdvisor] : null
  const isFollowUpMode = !!targetMeta

  return (
    <div
      className="bg-white px-3 sm:px-4 pt-2"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto">

        {/* 追问模式 chip */}
        {isFollowUpMode && targetMeta && (
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: `${targetMeta.color}12`, color: targetMeta.color, border: `1px solid ${targetMeta.color}30` }}
            >
              <span>{targetMeta.icon}</span>
              <span>追问 {targetMeta.name}</span>
            </div>
            <button
              onClick={onClearTarget}
              className="text-xs text-[#CCC] hover:text-[#888] transition-colors flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              取消
            </button>
          </div>
        )}

        {/* 输入框容器 */}
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all duration-150"
          style={{
            background: '#F5F5F5',
            border: isFollowUpMode && targetMeta
              ? `1.5px solid ${targetMeta.color}50`
              : '1.5px solid transparent',
          }}
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
                  ? `追问 ${targetMeta.name}…`
                  : '你在考虑什么决定？'
            }
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-[15px] text-[#0D0D0D]
                       placeholder-[#AAAAAA] leading-relaxed disabled:cursor-not-allowed"
            style={{ maxHeight: '160px' }}
          />

          {/* 发送 / 停止按钮 */}
          <button
            onClick={isStreaming ? onStop : submit}
            disabled={isStreaming ? false : !value.trim()}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150
                       text-white disabled:opacity-20 active:scale-95"
            style={{
              background: isFollowUpMode && targetMeta
                ? targetMeta.color
                : (value.trim() || isStreaming) ? '#0D0D0D' : '#CCCCCC',
            }}
          >
            {isStreaming ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
