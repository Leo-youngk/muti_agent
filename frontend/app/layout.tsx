import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '顾问团 · 多视角决策',
  description: '四位顶级顾问的多角度思维碰撞',
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
