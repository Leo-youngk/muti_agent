'use client'

import { useState, useEffect, useRef } from 'react'
import type { AppSettings, CustomAdvisor, BuiltinAdvisorId } from '@/lib/types'
import { ADVISORS, ADVISOR_COLOR_PRESETS } from '@/lib/advisors'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

const PRESET_MODELS = [
  'deepseek-v4-flash', 'deepseek-v3', 'deepseek-r1', 'gpt-4o-mini', 'gpt-4o',
]

function generateId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `custom_${slug}_${suffix}`
}

// ─── 新增顾问表单 ──────────────────────────────────────────────────────────────

interface AddFormState {
  name: string
  nameEn: string
  icon: string
  color: string
  tagline: string
  profile: string
}

const EMPTY_FORM: AddFormState = {
  name: '', nameEn: '', icon: '★', color: ADVISOR_COLOR_PRESETS[0],
  tagline: '', profile: '',
}

function AddAdvisorForm({ onAdd, onCancel }: {
  onAdd: (a: CustomAdvisor) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const set = (key: keyof AddFormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = () => {
    if (!form.name.trim() || !form.profile.trim()) return
    onAdd({
      id: generateId(form.name),
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || form.name.trim(),
      icon: form.icon.trim() || '★',
      color: form.color,
      tagline: form.tagline.trim(),
      profile: form.profile.trim(),
    })
  }

  return (
    <div className="border border-[#0D0D0D22] rounded-xl p-4 space-y-3 bg-[#FAFAFA]">
      <p className="text-xs font-semibold text-[#0D0D0D] uppercase tracking-widest">新增顾问</p>

      <div className="grid grid-cols-2 gap-3">
        {/* 名称 */}
        <div>
          <label className="block text-xs text-[#555] mb-1">名称 <span className="text-[#DC2626]">*</span></label>
          <input
            ref={nameRef}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="乔·史密斯"
            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
          />
        </div>
        {/* 英文名 */}
        <div>
          <label className="block text-xs text-[#555] mb-1">英文名（可选）</label>
          <input
            value={form.nameEn}
            onChange={e => set('nameEn', e.target.value)}
            placeholder="Joe Smith"
            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 图标 */}
        <div>
          <label className="block text-xs text-[#555] mb-1">图标（emoji）</label>
          <input
            value={form.icon}
            onChange={e => set('icon', e.target.value.slice(-2))}
            placeholder="★"
            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors text-center text-xl"
          />
        </div>
        {/* 标签语 */}
        <div>
          <label className="block text-xs text-[#555] mb-1">标签语（可选）</label>
          <input
            value={form.tagline}
            onChange={e => set('tagline', e.target.value)}
            placeholder="核心思维方式"
            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
          />
        </div>
      </div>

      {/* 颜色 */}
      <div>
        <label className="block text-xs text-[#555] mb-2">颜色</label>
        <div className="flex flex-wrap gap-2">
          {ADVISOR_COLOR_PRESETS.map(c => (
            <button
              key={c}
              onClick={() => set('color', c)}
              className="w-6 h-6 rounded-full transition-transform hover:scale-110"
              style={{
                background: c,
                boxShadow: form.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* 思维档案 */}
      <div>
        <label className="block text-xs text-[#555] mb-1">
          思维档案 <span className="text-[#DC2626]">*</span>
          <span className="text-[#999] ml-1 font-normal">描述这个人的核心信念、判断优先级、语言风格</span>
        </label>
        <textarea
          value={form.profile}
          onChange={e => set('profile', e.target.value)}
          rows={6}
          placeholder={`【人物名】\n\n【核心信念】\n1. ...\n\n【判断优先级】\n1. ...\n\n【语言风格】\n...`}
          className="w-full text-xs border border-[#DDDDE0] rounded-xl px-3 py-2.5 outline-none focus:border-[#0D0D0D] transition-colors resize-y font-mono leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* 预览 + 按钮 */}
      <div className="flex items-center gap-2 pt-1">
        {/* 名片预览 */}
        {form.name && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border"
            style={{ borderColor: `${form.color}44`, color: form.color, background: `${form.color}0D` }}>
            <span>{form.icon || '★'}</span>
            <span>{form.name}</span>
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-[#555] hover:bg-[#F0F0F0] rounded-xl transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.name.trim() || !form.profile.trim()}
          className="px-4 py-1.5 text-sm font-medium bg-[#0D0D0D] text-white rounded-xl
                     hover:bg-[#2A2A2A] active:scale-95 transition-all disabled:opacity-30"
        >
          添加顾问
        </button>
      </div>
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [tab, setTab] = useState<'api' | 'advisors'>('api')
  const [draft, setDraft] = useState<AppSettings>({
    ...settings,
    customAdvisors: settings.customAdvisors ?? [],
    hiddenAdvisors: settings.hiddenAdvisors ?? [],
    customProfiles: settings.customProfiles ?? {},
  })
  const [showKey, setShowKey] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => { onSave(draft); onClose() }

  // ── 内置顾问档案 ──────────────────────────────────────────────────────────────
  const updateBuiltinProfile = (id: BuiltinAdvisorId, value: string) =>
    setDraft(d => ({ ...d, customProfiles: { ...d.customProfiles, [id]: value } }))

  const resetBuiltinProfile = (id: BuiltinAdvisorId) =>
    setDraft(d => {
      const cp = { ...d.customProfiles }; delete cp[id]
      return { ...d, customProfiles: cp }
    })

  // ── 隐藏/显示顾问 ─────────────────────────────────────────────────────────────
  const toggleHidden = (id: string) =>
    setDraft(d => {
      const hidden = d.hiddenAdvisors ?? []
      return {
        ...d,
        hiddenAdvisors: hidden.includes(id)
          ? hidden.filter(x => x !== id)
          : [...hidden, id],
      }
    })

  // ── 自定义顾问 CRUD ───────────────────────────────────────────────────────────
  const addCustomAdvisor = (a: CustomAdvisor) => {
    setDraft(d => ({ ...d, customAdvisors: [...(d.customAdvisors ?? []), a] }))
    setShowAddForm(false)
  }

  const deleteCustomAdvisor = (id: string) =>
    setDraft(d => ({
      ...d,
      customAdvisors: (d.customAdvisors ?? []).filter(a => a.id !== id),
      hiddenAdvisors: (d.hiddenAdvisors ?? []).filter(x => x !== id),
    }))

  const updateCustomProfile = (id: string, profile: string) =>
    setDraft(d => ({
      ...d,
      customAdvisors: (d.customAdvisors ?? []).map(a => a.id === id ? { ...a, profile } : a),
    }))

  const isHidden = (id: string) => (draft.hiddenAdvisors ?? []).includes(id)
  const activeCount = (ADVISORS.length + (draft.customAdvisors ?? []).length) -
    (draft.hiddenAdvisors ?? []).length

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">

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
                tab === t ? 'bg-[#0D0D0D] text-white' : 'text-[#555] hover:bg-[#F5F5F5]'
              }`}
            >
              {t === 'api' ? 'API 配置' : `顾问管理 (${activeCount})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── API 配置 ── */}
          {tab === 'api' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">API Key</label>
                <p className="text-xs text-[#999] mb-2">填入后优先使用，留空则使用服务器环境变量</p>
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft.apiKey}
                    onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="flex-1 text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors font-mono"
                  />
                  <button onClick={() => setShowKey(v => !v)} className="px-3 text-xs text-[#888] border border-[#DDDDE0] rounded-xl hover:bg-[#F5F5F5] transition-colors">
                    {showKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Base URL</label>
                <p className="text-xs text-[#999] mb-2">OpenAI 兼容接口地址，留空使用默认</p>
                <input
                  type="text"
                  value={draft.baseUrl}
                  onChange={e => setDraft(d => ({ ...d, baseUrl: e.target.value }))}
                  placeholder="https://opencode.ai/zen/go/v1"
                  className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">默认模型</label>
                <div className="space-y-1.5 mb-2">
                  {PRESET_MODELS.map(m => (
                    <button key={m} onClick={() => setDraft(d => ({ ...d, defaultModel: m }))}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                        draft.defaultModel === m ? 'bg-[#0D0D0D] text-white font-medium' : 'text-[#333] hover:bg-[#F5F5F5]'
                      }`}>
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

          {/* ── 顾问管理 ── */}
          {tab === 'advisors' && (
            <div className="space-y-2">
              <p className="text-xs text-[#999] pb-1">
                切换面板成员、编辑思维档案，或添加全新顾问。
              </p>

              {/* 内置顾问 */}
              {ADVISORS.map(a => {
                const isExpanded = expandedId === a.id
                const isCustomized = !!draft.customProfiles[a.id as BuiltinAdvisorId]
                const hidden = isHidden(a.id)
                const currentProfile = draft.customProfiles[a.id as BuiltinAdvisorId] ?? a.profile

                return (
                  <div key={a.id}
                    className="border border-[#EBEBEB] rounded-xl overflow-hidden"
                    style={{ borderLeft: `3px solid ${hidden ? '#DDD' : a.color}` }}
                  >
                    <div className="flex items-center px-3 py-2.5 gap-2">
                      {/* 启用/禁用开关 */}
                      <button
                        onClick={() => toggleHidden(a.id)}
                        title={hidden ? '点击加入面板' : '点击移出面板'}
                        className={`w-8 h-5 rounded-full flex items-center transition-colors shrink-0 ${
                          hidden ? 'bg-[#E0E0E0] justify-start' : 'justify-end'
                        }`}
                        style={{ background: hidden ? undefined : a.color }}
                      >
                        <span className="w-4 h-4 bg-white rounded-full shadow mx-0.5 block" />
                      </button>

                      <span className={`text-sm font-bold shrink-0 transition-opacity ${hidden ? 'opacity-30' : ''}`}
                        style={{ color: a.color }}>{a.icon}</span>
                      <span className={`text-sm font-medium flex-1 truncate transition-opacity ${hidden ? 'opacity-40' : 'text-[#0D0D0D]'}`}>
                        {a.name}
                      </span>

                      {isCustomized && !hidden && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] font-medium shrink-0">
                          已自定义
                        </span>
                      )}

                      {/* 展开/收起档案编辑 */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        disabled={hidden}
                        className="p-1 rounded-md text-[#BBB] hover:text-[#555] hover:bg-[#F5F5F5] transition-colors disabled:opacity-30"
                        title="编辑档案"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#F0F0F0]">
                        <textarea
                          value={currentProfile}
                          onChange={e => updateBuiltinProfile(a.id as BuiltinAdvisorId, e.target.value)}
                          rows={10}
                          className="w-full text-xs text-[#333] border border-[#DDDDE0] rounded-xl px-3 py-2.5
                                     outline-none focus:border-[#0D0D0D] transition-colors resize-y leading-relaxed font-mono"
                          spellCheck={false}
                        />
                        {isCustomized && (
                          <button onClick={() => resetBuiltinProfile(a.id as BuiltinAdvisorId)}
                            className="mt-2 text-xs text-[#DC2626] hover:underline">
                            恢复默认档案
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 分隔线（有自定义顾问时显示）*/}
              {(draft.customAdvisors ?? []).length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                  <span className="text-[10px] text-[#BBB] uppercase tracking-widest">自定义顾问</span>
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                </div>
              )}

              {/* 自定义顾问列表 */}
              {(draft.customAdvisors ?? []).map(ca => {
                const isExpanded = expandedId === ca.id
                const hidden = isHidden(ca.id)

                return (
                  <div key={ca.id}
                    className="border border-[#EBEBEB] rounded-xl overflow-hidden"
                    style={{ borderLeft: `3px solid ${hidden ? '#DDD' : ca.color}` }}
                  >
                    <div className="flex items-center px-3 py-2.5 gap-2">
                      {/* 启用/禁用 */}
                      <button
                        onClick={() => toggleHidden(ca.id)}
                        title={hidden ? '点击加入面板' : '点击移出面板'}
                        className="w-8 h-5 rounded-full flex items-center transition-colors shrink-0"
                        style={{ background: hidden ? '#E0E0E0' : ca.color, justifyContent: hidden ? 'flex-start' : 'flex-end' }}
                      >
                        <span className="w-4 h-4 bg-white rounded-full shadow mx-0.5 block" />
                      </button>

                      <span className={`text-sm font-bold shrink-0 transition-opacity ${hidden ? 'opacity-30' : ''}`}
                        style={{ color: ca.color }}>{ca.icon}</span>
                      <span className={`text-sm font-medium flex-1 truncate transition-opacity ${hidden ? 'opacity-40' : 'text-[#0D0D0D]'}`}>
                        {ca.name}
                      </span>

                      {/* 编辑档案 */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ca.id)}
                        className="p-1 rounded-md text-[#BBB] hover:text-[#555] hover:bg-[#F5F5F5] transition-colors"
                        title="编辑档案"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* 删除 */}
                      <button
                        onClick={() => deleteCustomAdvisor(ca.id)}
                        className="p-1 rounded-md text-[#BBB] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                        title="删除此顾问"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#F0F0F0]">
                        <textarea
                          value={ca.profile}
                          onChange={e => updateCustomProfile(ca.id, e.target.value)}
                          rows={10}
                          className="w-full text-xs text-[#333] border border-[#DDDDE0] rounded-xl px-3 py-2.5
                                     outline-none focus:border-[#0D0D0D] transition-colors resize-y leading-relaxed font-mono"
                          spellCheck={false}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 新增顾问 */}
              {showAddForm ? (
                <AddAdvisorForm
                  onAdd={addCustomAdvisor}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <button
                  onClick={() => { setShowAddForm(true); setExpandedId(null) }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed
                             border-[#DDDDE0] text-sm text-[#888] hover:text-[#0D0D0D] hover:border-[#0D0D0D]
                             transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新增顾问
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EBEBEB]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#555] hover:bg-[#F5F5F5] rounded-xl transition-colors">
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
