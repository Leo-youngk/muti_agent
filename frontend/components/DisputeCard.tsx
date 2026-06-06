'use client'

import type { Dispute } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'

export default function DisputeCard({ dispute }: { dispute: Dispute }) {
  const advisorMap = useAdvisorMap()
  const getColor = (name: string): string => {
    const found = Object.values(advisorMap).find(a => a.name === name || a.nameEn === name)
    return found?.color ?? '#888'
  }

  const [colorA, colorB] = dispute.between.map(getColor)

  return (
    <div className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
      {/* 冲突双方 */}
      <div className="flex">
        <div className="flex-1 px-4 py-3 border-r border-[#EBEBEB]" style={{ borderTop: `3px solid ${colorA}` }}>
          <p className="text-xs font-semibold mb-1" style={{ color: colorA }}>{dispute.between[0]}</p>
          <p className="text-sm text-[#333] leading-relaxed">{dispute.a_says}</p>
        </div>
        <div className="flex-1 px-4 py-3" style={{ borderTop: `3px solid ${colorB}` }}>
          <p className="text-xs font-semibold mb-1" style={{ color: colorB }}>{dispute.between[1]}</p>
          <p className="text-sm text-[#333] leading-relaxed">{dispute.b_says}</p>
        </div>
      </div>

      {/* 裁判 */}
      <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#EBEBEB]">
        <p className="text-sm text-[#0D0D0D]">
          <span className="font-medium">{dispute.clash}</span>
          <span className="text-[#555]"> → 听 </span>
          <span className="font-semibold" style={{ color: getColor(dispute.trust) }}>{dispute.trust}</span>
          <span className="text-[#999]">（{dispute.why}）</span>
        </p>
      </div>
    </div>
  )
}
