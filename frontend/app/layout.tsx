import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '讨论室 · 多 Agent 讨论',
  description: '让多个 Agent 按顺序给出完整判断的讨论工具',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '讨论室',
    startupImage: [],
  },
  icons: {
    apple: [
      { url: '/icons/icon-180.svg', sizes: '180x180' },
      { url: '/icons/icon-152.svg', sizes: '152x152' },
      { url: '/icons/icon-120.svg', sizes: '120x120' },
    ],
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',   // 允许内容延伸到刘海/灵动岛区域
  themeColor: '#FAFAF8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  )
}
