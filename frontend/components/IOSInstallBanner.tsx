'use client'

import { useState, useEffect } from 'react'

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 只在 iOS Safari 且未安装为 PWA 时显示
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed')
    if (isIOS && !isStandalone && !dismissed) {
      // 延迟2秒再显示，避免打断首次加载
      const t = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  if (!show) return null

  const dismiss = () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1')
    setShow(false)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--page)] px-5"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-[680px] items-start gap-3 py-3 text-[var(--text)]">
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-sm font-semibold">添加到主屏幕</p>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            点击底部
            <svg className="inline w-3.5 h-3.5 mx-1 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l-1.5 1.5L12 5l1.5-1.5L12 2zM5 9H3v12h18V9h-2V7H5v2zm2 0h10v10H7V9zm5-6.5L9.5 5H7l5-5 5 5h-2.5L12 2.5z"/>
            </svg>
            后选择「添加到主屏幕」，获得全屏体验
          </p>
        </div>
        <button
          onClick={dismiss}
          className="min-h-11 min-w-11 shrink-0 text-sm text-[var(--text-muted)]"
        >
          关闭
        </button>
      </div>
    </div>
  )
}
