'use client'

import type { CrossAnalysis } from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'
import DisputeCard from './DisputeCard'

function getColor(name: string): string {
  const found = ADVISORS.find(a => a.name === name || a.nameEn === name)
  return found?.color ?? '#888'
}

export default function ConclusionSection({
  analysis,
  status,
}: {
  analysis?: CrossAnalysis
  status: 'idle' | 'thinking' | 'done'
}) {
  if (status === 'idle') return null

  if (status === 'thinking') {
    return (
      <div className="mt-6 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#BBB]">分歧分析</p>
        <div className="flex items-center gap-2 py-3">
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#CCC] animate-bounce"
                style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <span className="text-sm text-[#999]">正在分析分歧…</span>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const { disputes, conclusion } = analysis

  return (
    <div className="mt-6 space-y-6">
      {/* 分歧区 */}
      {disputes.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#BBB]">核心分歧</p>
          {disputes.map((d, i) => <DisputeCard key={i} dispute={d} />)}
        </div>
      )}

      {/* 结论区 */}
      <div className="rounded-2xl border border-[#0D0D0D22] bg-[#0D0D0D] text-white overflow-hidden">
        <div className="px-5 pt-5 pb-4 space-y-4">
          {/* Verdict */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">主持人判断</p>
            <p className="text-[15px] font-medium leading-relaxed text-white">{conclusion.verdict}</p>
          </div>

          {/* 核心矛盾 */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-1">核心矛盾</p>
            <p className="text-sm text-[#CCC] leading-relaxed">{conclusion.core_tension}</p>
          </div>

          {/* 最值得听 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">当前场景最值得听</p>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {conclusion.top_voices.map(name => (
                  <span key={name} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${getColor(name)}33`, color: getColor(name) }}>
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#888]">{conclusion.top_voices_reason}</p>
            </div>
            {conclusion.reference_only.length > 0 && (
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">仅供参考</p>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {conclusion.reference_only.map(name => (
                    <span key={name} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#333] text-[#999]">
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-[#888]">{conclusion.reference_only_reason}</p>
              </div>
            )}
          </div>

          {/* 最危险盲点 */}
          <div className="rounded-xl bg-[#1A1A1A] px-4 py-3 border border-[#333]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F59E0B] mb-1">集体盲点</p>
            <p className="text-sm text-[#CCC] leading-relaxed">{conclusion.biggest_blind_spot}</p>
          </div>

          {/* 下一步 */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">建议行动</p>
            <div className="space-y-1.5">
              {conclusion.next_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-xs font-bold text-[#555] mt-0.5 shrink-0">{i + 1}.</span>
                  <p className="text-sm text-[#CCC] leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
