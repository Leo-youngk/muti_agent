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
        className={`min-h-11 text-xs underline decoration-transparent underline-offset-4 transition-colors
          ${disabled
            ? 'cursor-not-allowed text-[var(--text-faint)]'
            : open
              ? 'text-[var(--text)] decoration-current'
              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:decoration-current'
          }`}
        title="切换模型"
      >
        <span className="max-w-[120px] truncate">{value || '未选择'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 max-h-72 w-60 overflow-y-auto border border-[var(--line)] bg-[var(--page)]">
          {hasModels ? (
            activeProviders.map(p => (
              <div key={p.id} className="border-b border-[var(--line)] px-3 py-2 last:border-b-0">
                <p className="mb-1.5 text-xs text-[var(--text-faint)]">{p.name}</p>
                {p.models.map(m => (
                  <button
                    key={m}
                    onClick={() => select(m)}
                    className={`flex min-h-11 w-full items-center justify-between px-2 text-left text-xs transition-colors
                      ${value === m
                        ? 'font-semibold text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
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
              <p className="text-xs text-[var(--text-muted)]">暂无可用模型</p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">请在设置中添加服务商</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
