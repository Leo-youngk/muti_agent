'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { AdvisorId, Provider } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'
import ModelSelector from './ModelSelector'

interface Props {
  onSubmit: (task: string) => boolean | void
  isStreaming: boolean
  onStop?: () => void
  targetAdvisor?: AdvisorId | null
  onClearTarget?: () => void
  selectedModel: string
  onModelChange: (model: string) => void
  providers: Provider[]
  draftKey?: string
  webSearchEnabled?: boolean
  onToggleWebSearch?: () => void
}

export interface InputBarHandle {
  focus: () => void
}

const InputBar = forwardRef<InputBarHandle, Props>(function InputBar({
  onSubmit,
  isStreaming,
  onStop,
  targetAdvisor,
  onClearTarget,
  selectedModel,
  onModelChange,
  providers,
  draftKey,
  webSearchEnabled,
  onToggleWebSearch,
}, ref) {
  const advisorMap = useAdvisorMap()
  const storageKey = draftKey ? `discussion_draft_${draftKey}` : null
  const [value, setValue] = useState(() => {
    try { return storageKey ? localStorage.getItem(storageKey) || '' : '' } catch { return '' }
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)
  const targetMeta = targetAdvisor ? advisorMap[targetAdvisor] : null

  useEffect(() => {
    if (!storageKey) return
    try {
      if (value) localStorage.setItem(storageKey, value)
      else localStorage.removeItem(storageKey)
    } catch { /* 草稿存储不可用时仍允许正常输入 */ }
  }, [storageKey, value])

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    if (onSubmit(trimmed) === false) return
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return
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
      className="shrink-0 bg-[var(--page)] px-3 pt-2 pb-3"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-[720px]">
        {targetMeta && (
          <div className="mb-2 flex min-h-8 items-center justify-between px-1">
            <span className="text-xs text-[var(--text-muted)]">
              追问 <span className="font-medium text-[var(--text)]">{targetMeta.name}</span>
            </span>
            <button
              onClick={onClearTarget}
              aria-label="取消追问对象"
              className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              取消
            </button>
          </div>
        )}

        <div className="relative rounded-[28px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          {/* 输入区 */}
          <div className="flex items-end gap-2 px-4 pt-3.5 pb-2">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={() => { composingRef.current = false }}
              placeholder={isStreaming
                ? '可以先写下一个问题…'
                : targetMeta
                  ? `追问 ${targetMeta.name}…`
                  : '发消息或输入问题…'}
              rows={1}
              className="min-h-6 flex-1 resize-none bg-transparent py-1 text-base leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] disabled:cursor-not-allowed"
              style={{ maxHeight: '160px' }}
            />
          </div>

          {/* 底部功能区 */}
          <div className="flex min-h-12 items-center justify-between px-3 pb-2">
            {/* 左侧：模型选择（深度思考位置） */}
            <div className="flex items-center gap-2">
              <ModelSelector
                value={selectedModel}
                onChange={onModelChange}
                disabled={isStreaming}
                providers={providers}
              />
              {onToggleWebSearch && (
                <button type="button" onClick={onToggleWebSearch} aria-pressed={Boolean(webSearchEnabled)} disabled={isStreaming}
                  className={`min-h-11 px-2 text-xs ${webSearchEnabled ? 'font-medium text-[var(--action)]' : 'text-[var(--text-muted)]'}`}>
                  联网
                </button>
              )}
            </div>

            {/* 右侧：发送/停止 */}
            <div className="flex items-center gap-1.5">
              {(isStreaming || value.trim()) && (
                <button
                  onClick={isStreaming ? onStop : submit}
                  aria-label={isStreaming ? '停止生成' : '发送'}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${
                    isStreaming
                      ? 'bg-[var(--text-muted)] text-[var(--surface)]'
                      : 'bg-[var(--action)] text-[var(--surface)]'
                  }`}
                >
                  {isStreaming ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="7" y="7" width="10" height="10" rx="2" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default InputBar
