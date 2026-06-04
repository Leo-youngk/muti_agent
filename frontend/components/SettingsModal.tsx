'use client'

import { useState, useEffect, useRef } from 'react'
import type { AppSettings, AdvisorId } from '@/lib/types'
import { ADVISORS } from '@/lib/advisors'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

const PRESET_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v3',
  'deepseek-r1',
  'gpt-4o-mini',
  'gpt-4o',
]

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [tab, setTab] = useState<'api' | 'advisors'>('api')
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [expandedAdvisor, setExpandedAdvisor] = useState<AdvisorId | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // 按 Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  const updateProfile = (id: AdvisorId, value: string) => {
    setDraft(d => ({ ...d, customProfiles: { ...d.customProfiles, [id]: value } }))
  }

  const resetProfile = (id: AdvisorId) => {
    setDraft(d => {
      const cp = { ...d.customProfiles }
      delete cp[id]
      return { ...d, customProfiles: cp }
    })
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EBEBEB]">
          <h2 className="text-base font-semibold text-[#0D0D0D]">设置</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:bg-[#F5F5F5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 pb-0">
          {(['api', 'advisors'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-[#0D0D0D] text-white'
                  : 'text-[#555] hover:bg-[#F5F5F5]'
              }`}
            >
              {t === 'api' ? 'API 配置' : '顾问档案'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {tab === 'api' && (
            <div className="space-y-5">
              {/* API Key */}
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">
                  API Key
                </label>
                <p className="text-xs text-[#999] mb-2">填入后优先使用，留空则使用服务器环境变量</p>
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft.apiKey}
                    onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="flex-1 text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors font-mono"
                  />
                  <button
                    onClick={() => setShowKey(v => !v)}
                    className="px-3 text-xs text-[#888] border border-[#DDDDE0] rounded-xl hover:bg-[#F5F5F5] transition-colors"
                  >
                    {showKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">
                  Base URL
                </label>
                <p className="text-xs text-[#999] mb-2">OpenAI 兼容接口地址，留空使用默认</p>
                <input
                  type="text"
                  value={draft.baseUrl}
                  onChange={e => setDraft(d => ({ ...d, baseUrl: e.target.value }))}
                  placeholder="https://opencode.ai/zen/go/v1"
                  className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
                />
              </div>

              {/* Default Model */}
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">
                  默认模型
                </label>
                <div className="space-y-1.5 mb-2">
                  {PRESET_MODELS.map(m => (
                    <button
                      key={m}
                      onClick={() => setDraft(d => ({ ...d, defaultModel: m }))}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                        draft.defaultModel === m
                          ? 'bg-[#0D0D0D] text-white font-medium'
                          : 'text-[#333] hover:bg-[#F5F5F5]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={PRESET_MODELS.includes(draft.defaultModel) ? '' : draft.defaultModel}
                  onChange={e => setDraft(d => ({ ...d, defaultModel: e.target.value }))}
                  placeholder="或输入自定义模型名…"
                  className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
                />
              </div>
            </div>
          )}

          {tab === 'advisors' && (
            <div className="space-y-3">
              <p className="text-xs text-[#999] pb-1">
                可自定义各顾问的思维框架档案。修改后将在下一次提问时生效。
              </p>
              {ADVISORS.map(a => {
                const isExpanded = expandedAdvisor === a.id
                const isCustomized = !!draft.customProfiles[a.id as AdvisorId]
                const currentProfile = draft.customProfiles[a.id as AdvisorId] ?? a.profile
                return (
                  <div
                    key={a.id}
                    className="border border-[#EBEBEB] rounded-xl overflow-hidden"
                    style={{ borderLeft: `3px solid ${a.color}` }}
                  >
                    <button
                      onClick={() => setExpandedAdvisor(isExpanded ? null : a.id as AdvisorId)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span style={{ color: a.color }}>{a.icon}</span>
                        <span className="text-sm font-medium text-[#0D0D0D]">{a.name}</span>
                        {isCustomized && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] font-medium">
                            已自定义
                          </span>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 text-[#BBB] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#F0F0F0]">
                        <textarea
                          value={currentProfile}
                          onChange={e => updateProfile(a.id as AdvisorId, e.target.value)}
                          rows={10}
                          className="w-full text-xs text-[#333] border border-[#DDDDE0] rounded-xl px-3 py-2.5
                                     outline-none focus:border-[#0D0D0D] transition-colors resize-y leading-relaxed
                                     font-mono"
                          spellCheck={false}
                        />
                        {isCustomized && (
                          <button
                            onClick={() => resetProfile(a.id as AdvisorId)}
                            className="mt-2 text-xs text-[#DC2626] hover:underline"
                          >
                            恢复默认档案
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EBEBEB]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#555] hover:bg-[#F5F5F5] rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium bg-[#0D0D0D] text-white rounded-xl
                       hover:bg-[#2A2A2A] active:scale-95 transition-all"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
