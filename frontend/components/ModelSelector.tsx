'use client'

import { useState, useRef, useEffect } from 'react'

const PRESET_MODELS = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v3',       label: 'DeepSeek V3' },
  { value: 'deepseek-r1',       label: 'DeepSeek R1' },
  { value: 'gpt-4o-mini',       label: 'GPT-4o Mini' },
  { value: 'gpt-4o',            label: 'GPT-4o' },
]

interface Props {
  value: string
  onChange: (model: string) => void
  disabled?: boolean
}

export default function ModelSelector({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const displayLabel =
    PRESET_MODELS.find(m => m.value === value)?.label ?? value

  // 点选预设
  const select = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  // 自定义模型名确认
  const confirmCustom = () => {
    const v = draft.trim()
    if (v) { onChange(v); setDraft('') }
    setOpen(false)
  }

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 打开时自动聚焦输入框
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150
          ${disabled
            ? 'text-[#BBB] cursor-not-allowed'
            : 'text-[#555] hover:bg-[#F0F0F0] hover:text-[#0D0D0D]'
          }`}
        title="切换模型"
      >
        {/* CPU / model icon */}
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.8" />
          <rect x="9" y="9" width="6" height="6" rx="0.5" strokeWidth="1.8" />
          <path strokeWidth="1.8" d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
        </svg>
        <span className="max-w-[120px] truncate">{displayLabel}</span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#EBEBEB] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#EBEBEB]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-1.5">
              预设模型
            </p>
            {PRESET_MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => select(m.value)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors duration-100
                  ${value === m.value
                    ? 'bg-[#0D0D0D] text-white font-medium'
                    : 'text-[#333] hover:bg-[#F5F5F5]'
                  }`}
              >
                {m.label}
                {value === m.value && (
                  <span className="ml-1 text-[10px] opacity-60">✓</span>
                )}
              </button>
            ))}
          </div>

          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-1.5">
              自定义
            </p>
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmCustom()}
                placeholder="输入模型名…"
                className="flex-1 text-xs border border-[#DDDDE0] rounded-lg px-2 py-1.5 outline-none
                           focus:border-[#0D0D0D] transition-colors"
              />
              <button
                onClick={confirmCustom}
                disabled={!draft.trim()}
                className="text-xs px-2.5 py-1.5 bg-[#0D0D0D] text-white rounded-lg disabled:opacity-30
                           hover:enabled:bg-[#2A2A2A] transition-colors"
              >
                用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
