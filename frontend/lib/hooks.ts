'use client'

import { useState, useCallback } from 'react'

/** 剪贴板 API 不可用时的降级：临时 textarea + execCommand */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** 复制到剪贴板，附带 2s 成功反馈 */
export function useCopy() {
  const [copied, setCopied] = useState(false)
  const markCopied = useCallback(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])
  const copy = useCallback((text: string) => {
    // 非安全上下文（http、部分 iOS WebView）没有 clipboard API，需降级
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(markCopied).catch(() => {
        if (legacyCopy(text)) markCopied()
      })
    } else if (legacyCopy(text)) {
      markCopied()
    }
  }, [markCopied])
  return { copied, copy }
}
