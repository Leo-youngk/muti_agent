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
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 animate-in slide-in-from-bottom duration-300"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="bg-[#0D0D0D] text-white rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-2xl">
        <span className="text-2xl shrink-0 mt-0.5">顾</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-0.5">添加到主屏幕</p>
          <p className="text-xs text-[#AAA] leading-relaxed">
            点击底部
            <svg className="inline w-3.5 h-3.5 mx-1 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l-1.5 1.5L12 5l1.5-1.5L12 2zM5 9H3v12h18V9h-2V7H5v2zm2 0h10v10H7V9zm5-6.5L9.5 5H7l5-5 5 5h-2.5L12 2.5z"/>
            </svg>
            后选择「添加到主屏幕」，获得全屏体验
          </p>
        </div>
        <button onClick={dismiss} className="shrink-0 text-[#666] hover:text-white p-1 -mr-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
