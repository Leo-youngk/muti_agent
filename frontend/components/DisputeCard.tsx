'use client'

import type { Dispute } from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'

function getColor(name: string): string {
  const found = ADVISORS.find(a => a.name === name || a.nameEn === name)
  return found?.color ?? '#888'
}

export default function DisputeCard({ dispute }: { dispute: Dispute }) {
  const [colorA, colorB] = dispute.between.map(getColor)

  return (
    <div className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
      {/* 冲突双方 */}
      <div className="flex">
        <div className="flex-1 px-4 py-3 border-r border-[#EBEBEB]" style={{ borderTop: `3px solid ${colorA}` }}>
          <p className="text-xs font-semibold mb-1" style={{ color: colorA }}>{dispute.between[0]}</p>
          <p className="text-sm text-[#333] leading-relaxed">{dispute.a_position}</p>
        </div>
        <div className="flex-1 px-4 py-3" style={{ borderTop: `3px solid ${colorB}` }}>
          <p className="text-xs font-semibold mb-1" style={{ color: colorB }}>{dispute.between[1]}</p>
          <p className="text-sm text-[#333] leading-relaxed">{dispute.b_position}</p>
        </div>
      </div>

      {/* 冲突原因 + 裁判 */}
      <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#EBEBEB] space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-1">冲突根源</p>
          <p className="text-sm text-[#555] leading-relaxed">{dispute.topic} — {dispute.why_they_clash}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#BBB] mb-1">当前场景更信谁</p>
          <p className="text-sm text-[#0D0D0D] font-medium">
            {dispute.who_to_trust}
            <span className="font-normal text-[#555]"> — {dispute.trust_reason}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
