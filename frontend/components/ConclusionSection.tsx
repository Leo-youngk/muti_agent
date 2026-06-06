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
    return [
      `主持人判断：${analysis.verdict}`,
      `最值得听：${analysis.listen_to.join('、')}`,
      `集体盲点：${analysis.blind_spot}`,
      `下一步：\n${analysis.do_next.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    ].join('\n\n')
  }

  if (status === 'idle') return null

  if (status === 'thinking') {
    return (
      <div className="flex items-start gap-3 mt-2">
        <div className="shrink-0 w-9 h-9 rounded-full bg-[#0D0D0D] flex items-center justify-center text-white text-xs font-bold mt-0.5 select-none">
          主
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-semibold text-[#0D0D0D]">主持人</span>
            <span className="text-xs text-[#BBB]">Moderator</span>
          </div>
          {streamingText ? (
            <pre className="text-[12px] text-[#555] font-mono leading-relaxed whitespace-pre-wrap break-words"
              style={{ maxHeight: '8rem', overflow: 'hidden' }}>
              {streamingText.length > 400 ? '…' + streamingText.slice(-400) : streamingText}
            </pre>
          ) : (
            <div className="flex items-center gap-1.5 py-2">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-[#CCC] animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="flex items-start gap-3 mt-2">
      {/* 主持人头像 */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-[#0D0D0D] flex items-center justify-center text-white text-xs font-bold mt-0.5 select-none">
        主
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        {/* 主持人标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#0D0D0D]">主持人</span>
            <span className="text-xs text-[#BBB]">Moderator</span>
          </div>
          <button
            onClick={() => copy(getConclusionText())}
            className="p-1 rounded text-[#CCC] hover:text-[#888] transition-colors"
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

        <div className="space-y-4">
          {/* 分歧区 */}
          {analysis.disputes.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#BBB]">核心分歧</p>
              {analysis.disputes.map((d, i) => <DisputeCard key={i} dispute={d} />)}
            </div>
          )}

          {/* 结论区 */}
          <div className="rounded-2xl border border-[#0D0D0D22] bg-[#0D0D0D] text-white overflow-hidden">
            <div className="px-4 sm:px-5 pt-5 pb-4 space-y-4">
              {/* Verdict */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">主持人判断</p>
                <div className="text-[15px] font-medium leading-relaxed text-white">
                  <Md>{analysis.verdict}</Md>
                </div>
              </div>

              {/* 最值得听 */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">最值得听</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.listen_to.map(name => (
                    <span key={name} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${getColor(name)}33`, color: getColor(name) }}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              {/* 集体盲点 */}
              <div className="rounded-xl bg-[#1A1A1A] px-4 py-3 border border-[#333]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F59E0B] mb-1">集体盲点</p>
                <div className="text-sm text-[#CCC] leading-relaxed">
                  <Md>{analysis.blind_spot}</Md>
                </div>
              </div>

              {/* 下一步 */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#888] mb-2">马上该做</p>
                <div className="space-y-1.5">
                  {analysis.do_next.map((step, i) => (
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
      </div>
    </div>
  )
}
