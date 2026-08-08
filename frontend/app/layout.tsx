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
      { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-120.png', sizes: '120x120', type: 'image/png' },
    ],
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
