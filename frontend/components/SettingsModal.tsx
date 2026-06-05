'use client'

import { useState, useEffect, useRef } from 'react'
import type { AppSettings, CustomAdvisor, BuiltinAdvisorId, Provider } from '@/lib/types'
import { ADVISORS, ADVISOR_COLOR_PRESETS } from '@/lib/advisors'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

// ─── Provider 预设模板 ────────────────────────────────────────────────────────

const PROVIDER_PRESETS: { name: string; baseUrl: string; models: string[] }[] = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', models: [] },
  { name: '火山引擎', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: [] },
]

function generateProviderId(): string {
  return 'provider_' + Math.random().toString(36).slice(2, 8)
}

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
        <div>
          <label className="block text-xs text-[#555] mb-1">图标（emoji）</label>
          <input
            value={form.icon}
            onChange={e => set('icon', e.target.value.slice(-2))}
            placeholder="★"
            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors text-center text-xl"
          />
        </div>
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

      <div className="flex items-center gap-2 pt-1">
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
    providers: settings.providers ?? [],
    customAdvisors: settings.customAdvisors ?? [],
    hiddenAdvisors: settings.hiddenAdvisors ?? [],
    customProfiles: settings.customProfiles ?? {},
  })

  // API tab state
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null)
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [modelDraft, setModelDraft] = useState('')
  const [showKeyId, setShowKeyId] = useState<string | null>(null)

  // Advisor tab state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => { onSave(draft); onClose() }

  // ── Provider CRUD ─────────────────────────────────────────────────────────────
  const updateProvider = (idx: number, updater: (p: Provider) => Provider) =>
    setDraft(d => ({
      ...d,
      providers: d.providers.map((p, i) => i === idx ? updater(p) : p),
    }))

  const deleteProvider = (idx: number) =>
    setDraft(d => ({ ...d, providers: d.providers.filter((_, i) => i !== idx) }))

  const addProviderFromPreset = (preset: typeof PROVIDER_PRESETS[0]) => {
    const newProvider: Provider = {
      id: generateProviderId(),
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: '',
      models: [...preset.models],
    }
    setDraft(d => ({ ...d, providers: [...d.providers, newProvider] }))
    setExpandedProviderId(newProvider.id)
    setShowAddProvider(false)
    setModelDraft('')
  }

  const addCustomProvider = () => {
    const newProvider: Provider = {
      id: generateProviderId(),
      name: '自定义',
      baseUrl: '',
      apiKey: '',
      models: [],
    }
    setDraft(d => ({ ...d, providers: [...d.providers, newProvider] }))
    setExpandedProviderId(newProvider.id)
    setShowAddProvider(false)
    setModelDraft('')
  }

  const addModelToProvider = (idx: number) => {
    const m = modelDraft.trim()
    if (!m) return
    updateProvider(idx, p =>
      p.models.includes(m) ? p : { ...p, models: [...p.models, m] }
    )
    setModelDraft('')
  }

  const removeModelFromProvider = (idx: number, model: string) =>
    updateProvider(idx, p => ({ ...p, models: p.models.filter(m => m !== model) }))

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
            <div className="space-y-4">
              <p className="text-xs text-[#999]">
                配置 API 服务商。每个服务商有独立的接口地址、密钥和模型列表。
              </p>

              {/* Provider 列表 */}
              {draft.providers.map((provider, idx) => {
                const isExp = expandedProviderId === provider.id
                const isKeyVisible = showKeyId === provider.id
                return (
                  <div key={provider.id}
                    className="border border-[#EBEBEB] rounded-xl overflow-hidden"
                    style={{ borderLeft: '3px solid #0D0D0D' }}
                  >
                    {/* Header */}
                    <div className="flex items-center px-3 py-2.5 gap-2">
                      <span className="text-sm font-semibold text-[#0D0D0D] flex-1 truncate">{provider.name}</span>
                      <span className="text-[10px] text-[#999] bg-[#F5F5F5] px-2 py-0.5 rounded-full shrink-0">
                        {provider.models.length} 模型
                      </span>
                      <button
                        onClick={() => {
                          setExpandedProviderId(isExp ? null : provider.id)
                          setModelDraft('')
                        }}
                        className="p-1 rounded-md text-[#BBB] hover:text-[#555] hover:bg-[#F5F5F5] transition-colors"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExp ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteProvider(idx)}
                        className="p-1 rounded-md text-[#BBB] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                        title="删除服务商"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded content */}
                    {isExp && (
                      <div className="px-4 pb-4 pt-2 border-t border-[#F0F0F0] space-y-3">
                        {/* 名称 */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#888] mb-1 uppercase tracking-widest">名称</label>
                          <input
                            value={provider.name}
                            onChange={e => updateProvider(idx, p => ({ ...p, name: e.target.value }))}
                            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors"
                          />
                        </div>

                        {/* Base URL */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Base URL</label>
                          <input
                            value={provider.baseUrl}
                            onChange={e => updateProvider(idx, p => ({ ...p, baseUrl: e.target.value }))}
                            placeholder="https://api.example.com/v1"
                            className="w-full text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors font-mono text-xs"
                          />
                        </div>

                        {/* API Key */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#888] mb-1 uppercase tracking-widest">API Key</label>
                          <p className="text-[10px] text-[#BBB] mb-1.5">留空则使用服务器环境变量</p>
                          <div className="flex gap-2">
                            <input
                              type={isKeyVisible ? 'text' : 'password'}
                              value={provider.apiKey}
                              onChange={e => updateProvider(idx, p => ({ ...p, apiKey: e.target.value }))}
                              placeholder="sk-..."
                              className="flex-1 text-sm border border-[#DDDDE0] rounded-xl px-3 py-2 outline-none focus:border-[#0D0D0D] transition-colors font-mono text-xs"
                            />
                            <button
                              onClick={() => setShowKeyId(isKeyVisible ? null : provider.id)}
                              className="px-2.5 text-[10px] text-[#888] border border-[#DDDDE0] rounded-xl hover:bg-[#F5F5F5] transition-colors shrink-0"
                            >
                              {isKeyVisible ? '隐藏' : '显示'}
                            </button>
                          </div>
                        </div>

                        {/* 模型列表 */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#888] mb-1.5 uppercase tracking-widest">模型列表</label>
                          {provider.models.length > 0 && (
                            <div className="space-y-1 mb-2">
                              {provider.models.map(m => (
                                <div key={m} className="flex items-center gap-2 group/model">
                                  <span className="flex-1 text-xs text-[#333] font-mono truncate">{m}</span>
                                  <button
                                    onClick={() => removeModelFromProvider(idx, m)}
                                    className="opacity-0 group-hover/model:opacity-100 p-0.5 rounded text-[#CCC] hover:text-[#DC2626] transition-all"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={modelDraft}
                              onChange={e => setModelDraft(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addModelToProvider(idx)}
                              placeholder="输入模型名，Enter 确认"
                              className="flex-1 text-xs border border-[#DDDDE0] rounded-lg px-2.5 py-1.5 outline-none
                                         focus:border-[#0D0D0D] transition-colors min-w-0 font-mono"
                            />
                            <button
                              onClick={() => addModelToProvider(idx)}
                              disabled={!modelDraft.trim()}
                              className="text-xs px-2.5 py-1.5 bg-[#0D0D0D] text-white rounded-lg disabled:opacity-30
                                         hover:enabled:bg-[#2A2A2A] transition-colors shrink-0"
                            >
                              添加
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 添加服务商 */}
              {showAddProvider ? (
                <div className="border-2 border-dashed border-[#DDDDE0] rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#555]">选择服务商模板</p>
                  <div className="flex flex-wrap gap-2">
                    {PROVIDER_PRESETS.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => addProviderFromPreset(preset)}
                        className="px-3 py-1.5 text-xs font-medium border border-[#DDDDE0] rounded-xl
                                   text-[#333] hover:bg-[#F5F5F5] hover:border-[#0D0D0D] transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                    <button
                      onClick={addCustomProvider}
                      className="px-3 py-1.5 text-xs font-medium border border-dashed border-[#DDDDE0] rounded-xl
                                 text-[#888] hover:text-[#0D0D0D] hover:border-[#0D0D0D] transition-colors"
                    >
                      + 自定义
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAddProvider(false)}
                    className="text-xs text-[#999] hover:text-[#555] transition-colors"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddProvider(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed
                             border-[#DDDDE0] text-sm text-[#888] hover:text-[#0D0D0D] hover:border-[#0D0D0D]
                             transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加服务商
                </button>
              )}

              {/* 默认模型 */}
              {draft.providers.flatMap(p => p.models).length > 0 && (
                <div className="pt-2 border-t border-[#EBEBEB]">
                  <label className="block text-[10px] font-semibold text-[#888] mb-1.5 uppercase tracking-widest">默认模型</label>
                  <div className="space-y-1">
                    {draft.providers.flatMap(p => p.models).map(m => (
                      <button key={m} onClick={() => setDraft(d => ({ ...d, defaultModel: m }))}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors ${
                          draft.defaultModel === m ? 'bg-[#0D0D0D] text-white font-medium' : 'text-[#333] hover:bg-[#F5F5F5]'
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

              {(draft.customAdvisors ?? []).length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                  <span className="text-[10px] text-[#BBB] uppercase tracking-widest">自定义顾问</span>
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                </div>
              )}

              {(draft.customAdvisors ?? []).map(ca => {
                const isExpanded = expandedId === ca.id
                const hidden = isHidden(ca.id)

                return (
                  <div key={ca.id}
                    className="border border-[#EBEBEB] rounded-xl overflow-hidden"
                    style={{ borderLeft: `3px solid ${hidden ? '#DDD' : ca.color}` }}
                  >
                    <div className="flex items-center px-3 py-2.5 gap-2">
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
