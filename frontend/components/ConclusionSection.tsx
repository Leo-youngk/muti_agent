'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CrossAnalysis } from '@/lib/types'
import { useAdvisorMap } from '@/lib/AdvisorContext'
import { useCopy } from '@/lib/hooks'
import DisputeCard from './DisputeCard'

function Md({ children, className }: { children: string; className?: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => <span className={className}>{c}</span>,
        strong: ({ children: c }) => <strong className="font-semibold">{c}</strong>,
        ul: ({ children: c }) => <ul className="list-disc pl-4 space-y-0.5">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal pl-4 space-y-0.5">{c}</ol>,
        li: ({ children: c }) => <li>{c}</li>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export default function ConclusionSection({
  analysis, status, streamingText,
}: {
  analysis?: CrossAnalysis
  status: 'idle' | 'thinking' | 'done'
  streamingText?: string
}) {
  const advisorMap = useAdvisorMap()
  const getColor = (name: string): string => {
    const found = Object.values(advisorMap).find(a => a.name === name || a.nameEn === name)
    return found?.color ?? '#888'
  }

  const { copied, copy } = useCopy()

  const getConclusionText = () => {
    if (!analysis) return ''
    const c = analysis.conclusion
    return [
      `主持人判断：${c.verdict}`,
      `核心矛盾：${c.core_tension}`,
      `最值得听：${c.top_voices.join('、')} — ${c.top_voices_reason}`,
      c.reference_only.length > 0 ? `仅供参考：${c.reference_only.join('、')} — ${c.reference_only_reason}` : '',
      `集体盲点：${c.biggest_blind_spot}`,
      `建议行动：\n${c.next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    ].filter(Boolean).join('\n\n')
  }
  if (status === 'idle') return null

  if (status === 'thinking') {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#BBB]">主持人分析</p>
        {streamingText ? (
          <div className="rounded-xl overflow-hidden border border-[#EBEBEB]">
            <div className="px-3 py-1.5 bg-[#F7F7F8] border-b border-[#EBEBEB] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#888] animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#888]">
                正在综合分析
              </span>
            </div>
            <pre
              className="px-3 py-2.5 text-[11px] text-[#555] font-mono leading-relaxed whitespace-pre-wrap break-words bg-white"
              style={{ maxHeight: '10rem', overflow: 'hidden' }}
            >
              {streamingText.length > 500 ? '…' + streamingText.slice(-500) : streamingText}
            </pre>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3">
            <div className="flex gap-1">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#CCC] animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <span className="text-sm text-[#999]">正在分析分歧…</span>
          </div>
        )}
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
        <div className="px-4 sm:px-5 pt-5 pb-4 space-y-4">
          {/* Verdict + 复制 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888]">主持人判断</p>
              <button
                onClick={() => copy(getConclusionText())}
                className="p-1 rounded-md text-[#555] hover:text-white hover:bg-white/10 transition-all"
                title="复制结论"
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-[#4ADE80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="1.8" />
                    <path strokeWidth="1.8" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>
            <div className="text-[15px] font-medium leading-relaxed text-white">
              <Md>{conclusion.verdict}</Md>
            </div>
          </div>

          {/* 核心矛盾 */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-1">核心矛盾</p>
            <div className="text-sm text-[#CCC] leading-relaxed">
              <Md>{conclusion.core_tension}</Md>
            </div>
          </div>

          {/* 最值得听 */}
          <div className="flex flex-col sm:flex-row gap-4">
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

          {/* 集体盲点 */}
          <div className="rounded-xl bg-[#1A1A1A] px-4 py-3 border border-[#333]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F59E0B] mb-1">集体盲点</p>
            <div className="text-sm text-[#CCC] leading-relaxed">
              <Md>{conclusion.biggest_blind_spot}</Md>
            </div>
          </div>

          {/* 下一步 */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">建议行动</p>
            <div className="space-y-1.5">
              {conclusion.next_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-xs font-bold text-[#555] mt-0.5 shrink-0">{i + 1}.</span>
                  <div className="text-sm text-[#CCC] leading-relaxed">
                    <Md>{step}</Md>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
