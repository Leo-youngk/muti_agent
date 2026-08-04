'use client'

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { AdvisorId, Provider } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'
import ModelSelector from './ModelSelector'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (task: string) => void
  isStreaming: boolean
  onStop?: () => void
  targetAdvisor?: AdvisorId | null
  onClearTarget?: () => void
  selectedModel: string
  onModelChange: (model: string) => void
  providers: Provider[]
  onSettingsOpen: () => void
}

export default function InputBar({
  open,
  onClose,
  onSubmit,
  isStreaming,
  onStop,
  targetAdvisor,
  onClearTarget,
  selectedModel,
  onModelChange,
  providers,
  onSettingsOpen,
}: Props) {
  const advisorMap = useAdvisorMap()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const targetMeta = targetAdvisor ? advisorMap[targetAdvisor] : null

  if (!open) return null

  const close = () => {
    onClearTarget?.()
    onClose()
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSubmit(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value)
    event.target.style.height = 'auto'
    event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`
  }

  return (
    <div
      role="dialog"
      aria-label={targetMeta ? `追问 ${targetMeta.name}` : '继续讨论'}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--page)] px-4 pt-3"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-[680px]">
        <div className="mb-2 flex min-h-11 items-center justify-between">
          <span className="text-sm text-[var(--text-muted)]">
            {targetMeta ? `追问 ${targetMeta.name}` : '继续讨论'}
          </span>
          <button
            onClick={close}
            aria-label="关闭输入"
            className="min-h-11 min-w-11 text-sm text-[var(--text-muted)]"
          >
            关闭
          </button>
        </div>

        <div className="border border-[var(--line)] bg-[var(--page)]">
          <div className="flex items-end gap-3 px-3 py-3">
            <textarea
              ref={textareaRef}
              autoFocus
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={isStreaming
                ? 'Agent 正在回答…'
                : targetMeta
                  ? `追问 ${targetMeta.name}…`
                  : '输入问题…'}
              rows={1}
              className="min-h-11 flex-1 resize-none bg-transparent py-2 text-base leading-7 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] disabled:cursor-not-allowed"
              style={{ maxHeight: '160px' }}
            />
            {(isStreaming || value.trim()) && (
              <button
                onClick={isStreaming ? onStop : submit}
                aria-label={isStreaming ? '停止生成' : '发送'}
                className="min-h-11 min-w-11 text-sm font-medium text-[var(--action)]"
              >
                {isStreaming ? '停止' : '发送'}
              </button>
            )}
          </div>

          <div className="flex min-h-11 items-center gap-2 border-t border-[var(--line)] px-3">
            <ModelSelector
              value={selectedModel}
              onChange={onModelChange}
              disabled={isStreaming}
              providers={providers}
            />
            <div className="flex-1" />
            <button
              onClick={onSettingsOpen}
              className="min-h-11 min-w-11 text-sm text-[var(--text-muted)]"
            >
              设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
