'use client'

import { createContext, useContext } from 'react'
import type { AdvisorMeta } from '@/lib/advisors'

const AdvisorContext = createContext<Record<string, AdvisorMeta>>({})

export const AdvisorProvider = AdvisorContext.Provider

/** 在任意子组件中获取 id → AdvisorMeta 映射 */
export function useAdvisorMap(): Record<string, AdvisorMeta> {
  return useContext(AdvisorContext)
}

/** 根据 ID 查找顾问 meta，找不到则返回占位 meta */
export function useAdvisorMeta(id: string): AdvisorMeta {
  const map = useContext(AdvisorContext)
  return map[id] ?? {
    id,
    name: id,
    nameEn: id,
    color: '#888',
    tagline: '',
    icon: '○',
    profile: '',
  }
}
