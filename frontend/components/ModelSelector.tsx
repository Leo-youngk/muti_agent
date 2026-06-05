'use client'

import { useState, useRef, useEffect } from 'react'
import type { Provider } from '@/lib/types'

interface Props {
  value: string
  onChange: (model: string) => void
  disabled?: boolean
  providers: Provider[]
}

export default function ModelSelector({ value, onChange, disabled, providers }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeProviders = providers.filter(p => p.models.length > 0)
  const hasModels = activeProviders.length > 0

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
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.8" />
          <rect x="9" y="9" width="6" height="6" rx="0.5" strokeWidth="1.8" />
          <path strokeWidth="1.8" d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
        </svg>
        <span className="max-w-[120px] truncate">{value || '未选择'}</span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-60 bg-white border border-[#EBEBEB] rounded-xl shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto">
          {hasModels ? (
            activeProviders.map(p => (
              <div key={p.id} className="px-3 py-2 border-b border-[#EBEBEB] last:border-b-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-1.5">{p.name}</p>
                {p.models.map(m => (
                  <button
                    key={m}
                    onClick={() => select(m)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors duration-100 flex items-center justify-between
                      ${value === m
                        ? 'bg-[#0D0D0D] text-white font-medium'
                        : 'text-[#333] hover:bg-[#F5F5F5]'
                      }`}
                  >
                    <span className="truncate">{m}</span>
                    {value === m && <span className="text-[10px] opacity-60">✓</span>}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-[#999]">暂无可用模型</p>
              <p className="text-[10px] text-[#CCC] mt-1">请在设置中添加服务商</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
