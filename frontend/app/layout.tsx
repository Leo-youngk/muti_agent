import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '顾问团 · 多视角决策',
  description: '四位顶级顾问的多角度思维碰撞',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '顾问团',
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',   // 允许内容延伸到刘海/灵动岛区域
  themeColor: '#0D0D0D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className={`${inter.className} h-full bg-white text-[#0D0D0D] antialiased`}>
        {children}
      </body>
    </html>
  )
}
