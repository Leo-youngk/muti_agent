'use client'

import { useState, useRef, useEffect } from 'react'
import type { Provider } from '@/lib/types'
import { modelKey } from '@/lib/modelSelection'

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
    const handler = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    // iOS 上 mousedown 只在点击结束后才补发，触屏必须同时监听 touchstart
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const activeProviders = providers.filter(p => p.models.length > 0)
  const hasModels = activeProviders.length > 0
  const chosen = activeProviders.flatMap(p => p.models.map(model => ({ key: modelKey(p.id, model), model, provider: p.name }))).find(item => item.key === value)
  const displayName = chosen?.model || (value.startsWith('provider:') ? '请选择模型' : value) || '未选择'

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`flex h-8 max-w-[160px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all
          ${open
            ? 'border-[var(--action)] bg-[var(--action)] text-[var(--surface)]'
            : 'border-[var(--line)] bg-[var(--bubble)] text-[var(--text-muted)] hover:border-[var(--action)] hover:text-[var(--action)]'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        title={chosen ? `${chosen.provider} · ${chosen.model}` : '切换模型'}
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span className="truncate">{displayName}</span>
        <svg className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="max-h-72 overflow-y-auto py-1">
            {hasModels ? (
              activeProviders.map(p => (
                <div key={p.id} className="border-b border-[var(--line)] px-3 py-2 last:border-b-0">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{p.name}</p>
                  {p.models.map(m => {
                    const key = modelKey(p.id, m)
                    const active = value === key
                    return (
                      <button
                        key={m}
                        onClick={() => select(key)}
                        className={`flex min-h-9 w-full items-center justify-between rounded-lg px-2 text-left text-xs transition-colors
                          ${active
                            ? 'bg-[var(--action)] text-[var(--surface)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bubble)] hover:text-[var(--text)]'
                          }`}
                      >
                        <span className="truncate font-mono">{m}</span>
                        {active && (
                          <svg className="ml-2 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">暂无可用模型</p>
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">请在设置中添加服务商</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
