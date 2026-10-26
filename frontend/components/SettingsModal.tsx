'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import type { AppSettings, CustomAdvisor, BuiltinAdvisorId, Provider } from '@/lib/types'
import { ADVISORS, ADVISOR_COLOR_PRESETS } from '@/lib/advisors'
import { modelKey } from '@/lib/modelSelection'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

// ─── Provider 预设模板 ────────────────────────────────────────────────────────

const PROVIDER_PRESETS: { name: string; baseUrl: string; models: string[] }[] = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-v4-flash', 'deepseek-chat'] },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', models: [] },
  { name: '火山引擎', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: [] },
]

const THEME_PRESETS = [
  { id: 'sage', name: '鼠尾草', color: '#0F5A54' },
  { id: 'ocean', name: '海洋', color: '#176B80' },
  { id: 'midnight', name: '午夜', color: '#7BD1BF' },
  { id: 'rose', name: '玫瑰', color: '#A84B64' },
  { id: 'amber', name: '琥珀', color: '#9A6718' },
] as const

function generateProviderId(): string {
  return 'provider_' + Math.random().toString(36).slice(2, 8)
}

function generateId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `custom_${slug}_${suffix}`
}

// ─── 滑块控件（DeepSeek 风格，直接滑动调节） ──────────────────────────────────

interface RangeFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
  hint?: string
  disabled?: boolean
}

function RangeField({ label, value, min, max, step, onChange, format, hint, disabled }: RangeFieldProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">{label}</label>
        <span className="text-xs font-semibold tabular-nums text-[var(--text)]">{format(value)}</span>
      </div>
      <input
        type="range"
        className="zen-range w-full"
        style={{ '--fill': `${pct}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
      {hint && <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">{hint}</p>}
    </div>
  )
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
    <div className="border border-[var(--line)] rounded-xl p-4 space-y-3 bg-[var(--bubble)]">
      <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-widest">新增 Agent</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">名称 <span className="text-[var(--error)]">*</span></label>
          <input
            ref={nameRef}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="乔·史密斯"
            className="w-full text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">英文名（可选）</label>
          <input
            value={form.nameEn}
            onChange={e => set('nameEn', e.target.value)}
            placeholder="Joe Smith"
            className="w-full text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">图标（emoji）</label>
          <input
            value={form.icon}
            onChange={e => set('icon', e.target.value.slice(-2))}
            placeholder="★"
            className="w-full text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors text-center text-xl"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">标签语（可选）</label>
          <input
            value={form.tagline}
            onChange={e => set('tagline', e.target.value)}
            placeholder="核心思维方式"
            className="w-full text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-2">颜色</label>
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
        <label className="block text-xs text-[var(--text-muted)] mb-1">
          思维档案 <span className="text-[var(--error)]">*</span>
          <span className="text-[var(--text-muted)] ml-1 font-normal">描述这个人的核心信念、判断优先级、语言风格</span>
        </label>
        <textarea
          value={form.profile}
          onChange={e => set('profile', e.target.value)}
          rows={6}
          placeholder={`【人物名】\n\n【核心信念】\n1. ...\n\n【判断优先级】\n1. ...\n\n【语言风格】\n...`}
          className="w-full text-xs border border-[var(--line)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--text-muted)] transition-colors resize-y font-mono leading-relaxed"
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
          className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bubble)] rounded-xl transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.name.trim() || !form.profile.trim()}
          className="px-4 py-1.5 text-sm font-medium bg-[var(--text)] text-[var(--page)] rounded-xl
                     hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
        >
          添加 Agent
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
  const [showManualAddId, setShowManualAddId] = useState<string | null>(null)

  // 模型自动加载
  const [modelsLoadingId, setModelsLoadingId] = useState<string | null>(null)
  const [modelsErrors, setModelsErrors] = useState<Record<string, string>>({})
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({})

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

  // ── 模型自动加载（点击选择，无需手动输入） ────────────────────────────────────
  const loadModels = async (idx: number) => {
    const provider = draft.providers[idx]
    const baseUrl = provider.baseUrl.trim()
    if (!baseUrl || modelsLoadingId === provider.id) return
    setModelsLoadingId(provider.id)
    setModelsErrors(prev => ({ ...prev, [provider.id]: '' }))
    try {
      const res = await fetch('/api/chat/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientBaseUrl: baseUrl, clientApiKey: provider.apiKey }),
      })
      const data = (await res.json().catch(() => ({}))) as { models?: string[]; error?: string }
      if (!res.ok || !Array.isArray(data.models)) {
        setModelsErrors(prev => ({ ...prev, [provider.id]: data.error || `加载失败（${res.status}）` }))
        return
      }
      setFetchedModels(prev => ({ ...prev, [provider.id]: data.models as string[] }))
    } catch (e) {
      setModelsErrors(prev => ({ ...prev, [provider.id]: '网络错误：' + ((e as Error).message || String(e)) }))
    } finally {
      setModelsLoadingId(null)
    }
  }

  const toggleModel = (idx: number, model: string) =>
    updateProvider(idx, p =>
      p.models.includes(model)
        ? { ...p, models: p.models.filter(m => m !== model) }
        : { ...p, models: [...p.models, model] }
    )

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
      const isCurrentlyHidden = hidden.includes(id)
      // 至少保留一个可用 Agent，否则面板会空转
      if (!isCurrentlyHidden) {
        const total = ADVISORS.length + (d.customAdvisors ?? []).length
        if (total - hidden.length <= 1) return d
      }
      return {
        ...d,
        hiddenAdvisors: isCurrentlyHidden
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

  // 高级参数当前值（非法/缺失时回退默认）
  const tempIsAuto = draft.temperature === 'auto' || draft.temperature === undefined
  const tempValue = typeof draft.temperature === 'number' ? draft.temperature : 0.7
  const capValue = typeof draft.maxTokensCap === 'number' && draft.maxTokensCap >= 1024
    ? draft.maxTokensCap : 16_384
  const timeoutValue = typeof draft.timeoutMs === 'number' && draft.timeoutMs >= 10_000
    ? draft.timeoutMs : 120_000

  return (
    <div
      ref={overlayRef}
      className="zen-fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="zen-sheet flex w-full max-h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-[var(--surface)] shadow-2xl sm:max-w-lg sm:rounded-2xl">

        {/* 移动端把手 */}
        <div className="flex shrink-0 justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--line)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--text)]">设置</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bubble)] transition-colors">
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
                tab === t ? 'bg-[var(--text)] text-[var(--page)]' : 'text-[var(--text-muted)] hover:bg-[var(--bubble)]'
              }`}
            >
              {t === 'api' ? 'API 配置' : `Agent 管理 (${activeCount})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── API 配置 ── */}
          {tab === 'api' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                配置 API 服务商。每个服务商有独立的接口地址、密钥和模型列表。
              </p>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--bubble)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">主题颜色</span>
                  <span className="text-[10px] text-[var(--text-faint)]">点击切换</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {THEME_PRESETS.map(theme => {
                    const active = (draft.theme ?? 'sage') === theme.id
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setDraft(d => ({ ...d, theme: theme.id }))}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-all ${active ? 'border-[var(--text)] bg-[var(--surface)] font-medium text-[var(--text)] shadow-sm' : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface)]'}`}
                      >
                        <span className="h-3 w-3 rounded-full" style={{ background: theme.color }} />
                        {theme.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Provider 列表 */}
              {draft.providers.map((provider, idx) => {
                const isExp = expandedProviderId === provider.id
                const isKeyVisible = showKeyId === provider.id
                const fetched = fetchedModels[provider.id] ?? []
                const displayModels = Array.from(new Set([...provider.models, ...fetched]))
                const isLoading = modelsLoadingId === provider.id

                return (
                  <div key={provider.id}
                    className="border border-[var(--line)] rounded-xl overflow-hidden"
                    style={{ borderLeft: '3px solid var(--text)' }}
                  >
                    {/* Header */}
                    <div className="flex items-center px-3 py-2.5 gap-2">
                      <span className="text-sm font-semibold text-[var(--text)] flex-1 truncate">{provider.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bubble)] px-2 py-0.5 rounded-full shrink-0">
                        {provider.models.length} 模型
                      </span>
                      <button
                        onClick={() => {
                          setExpandedProviderId(isExp ? null : provider.id)
                          setModelDraft('')
                        }}
                        className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bubble)] transition-colors"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExp ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteProvider(idx)}
                        className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--error)] hover:bg-[var(--bubble)] transition-colors"
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
                      <div className="px-4 pb-4 pt-2 border-t border-[var(--line)] space-y-3">
                        {/* 名称 */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-widest">名称</label>
                          <input
                            value={provider.name}
                            onChange={e => updateProvider(idx, p => ({ ...p, name: e.target.value }))}
                            className="w-full text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors"
                          />
                        </div>

                        {/* Base URL（失焦自动加载模型） */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-widest">Base URL</label>
                          <input
                            value={provider.baseUrl}
                            onChange={e => updateProvider(idx, p => ({ ...p, baseUrl: e.target.value }))}
                            onBlur={() => {
                              if (provider.baseUrl.trim() && provider.models.length === 0) loadModels(idx)
                            }}
                            placeholder="https://api.example.com/v1"
                            className="w-full text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors font-mono text-xs"
                          />
                          <p className="mt-1 text-[10px] text-[var(--text-faint)]">填完自动加载模型列表，也可手动点「自动加载」</p>
                        </div>

                        {/* API Key */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-widest">API Key</label>
                          <p className="text-[10px] text-[var(--text-faint)] mb-1.5">留空则使用服务器环境变量</p>
                          <div className="flex gap-2">
                            <input
                              type={isKeyVisible ? 'text' : 'password'}
                              value={provider.apiKey}
                              onChange={e => updateProvider(idx, p => ({ ...p, apiKey: e.target.value }))}
                              placeholder="sk-..."
                              className="flex-1 text-sm border border-[var(--line)] rounded-xl px-3 py-2 outline-none focus:border-[var(--text-muted)] transition-colors font-mono text-xs"
                            />
                            <button
                              onClick={() => setShowKeyId(isKeyVisible ? null : provider.id)}
                              className="px-2.5 text-[10px] text-[var(--text-muted)] border border-[var(--line)] rounded-xl hover:bg-[var(--bubble)] transition-colors shrink-0"
                            >
                              {isKeyVisible ? '隐藏' : '显示'}
                            </button>
                          </div>
                        </div>

                        {/* 模型列表（点击选择） */}
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">模型列表</label>
                            <button
                              onClick={() => loadModels(idx)}
                              disabled={isLoading || !provider.baseUrl.trim()}
                              className="flex items-center gap-1 text-[11px] font-medium text-[var(--action)] hover:underline disabled:opacity-40"
                            >
                              <svg
                                className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                              >
                                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                              </svg>
                              {isLoading ? '加载中…' : '自动加载'}
                            </button>
                          </div>

                          {modelsErrors[provider.id] && (
                            <p className="mb-2 text-[11px] leading-4 text-[var(--error)]">{modelsErrors[provider.id]}</p>
                          )}

                          {displayModels.length > 0 ? (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {displayModels.map(m => {
                                const inList = provider.models.includes(m)
                                return (
                                  <button
                                    key={m}
                                    onClick={() => toggleModel(idx, m)}
                                    title={inList ? '点击移出' : '点击加入'}
                                    className={`flex max-w-full items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-mono transition-all ${
                                      inList
                                        ? 'bg-[var(--text)] text-[var(--page)]'
                                        : 'bg-[var(--bubble)] text-[var(--text-muted)] hover:bg-[var(--line)]'
                                    }`}
                                  >
                                    <span className="truncate">{m}</span>
                                    <span className={`shrink-0 ${inList ? 'opacity-80' : ''}`}>{inList ? '✓' : '+'}</span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="mb-2 text-[11px] text-[var(--text-faint)]">填入 Base URL 后点「自动加载」，或手动添加</p>
                          )}

                          {/* 手动添加（默认折叠） */}
                          {showManualAddId === provider.id ? (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={modelDraft}
                                onChange={e => setModelDraft(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addModelToProvider(idx)}
                                placeholder="手动输入模型名"
                                className="min-w-0 flex-1 text-xs border border-[var(--line)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--text-muted)] transition-colors font-mono"
                              />
                              <button
                                onClick={() => addModelToProvider(idx)}
                                disabled={!modelDraft.trim()}
                                className="shrink-0 text-xs px-2.5 py-1.5 bg-[var(--text)] text-[var(--page)] rounded-lg disabled:opacity-30"
                              >
                                添加
                              </button>
                              <button
                                onClick={() => setShowManualAddId(null)}
                                className="shrink-0 text-xs px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-muted)]"
                              >
                                收起
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setShowManualAddId(provider.id); setModelDraft('') }}
                              className="text-[11px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-muted)]"
                            >
                              + 手动添加模型
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 添加服务商 */}
              {showAddProvider ? (
                <div className="border-2 border-dashed border-[var(--line)] rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">选择服务商模板</p>
                  <div className="flex flex-wrap gap-2">
                    {PROVIDER_PRESETS.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => addProviderFromPreset(preset)}
                        className="px-3 py-1.5 text-xs font-medium border border-[var(--line)] rounded-xl
                                   text-[var(--text)] hover:bg-[var(--bubble)] hover:border-[var(--text)] transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                    <button
                      onClick={addCustomProvider}
                      className="px-3 py-1.5 text-xs font-medium border border-dashed border-[var(--line)] rounded-xl
                                 text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text)] transition-colors"
                    >
                      + 自定义
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAddProvider(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddProvider(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed
                             border-[var(--line)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text)]
                             transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加服务商
                </button>
              )}

              {/* 默认模型 */}
              {draft.providers.flatMap(p => p.models ?? []).length > 0 && (
                <div className="pt-2 border-t border-[var(--line)]">
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">默认模型</label>
                  <div className="space-y-1">
                    {draft.providers.flatMap(p => (p.models ?? []).map(m => ({ provider: p, model: m }))).map(({ provider, model: m }) => (
                      <button key={modelKey(provider.id, m)} onClick={() => setDraft(d => ({ ...d, defaultModel: modelKey(provider.id, m) }))}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors ${
                          draft.defaultModel === modelKey(provider.id, m) ? 'bg-[var(--text)] text-[var(--page)] font-medium' : 'text-[var(--text)] hover:bg-[var(--bubble)]'
                        }`}>
                        {provider.name} · {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 高级参数（滑块） */}
              <details className="border-t border-[var(--line)] pt-3">
                <summary className="min-h-11 cursor-pointer text-sm text-[var(--text)]">联网查证</summary>
                <p className="mb-3 text-xs leading-6 text-[var(--text-muted)]">使用 Brave Search 取得网页摘录，供本轮顾问共享。开启时会将问题发送给检索服务；密钥仅保存在此浏览器。</p>
                <label className="block text-xs text-[var(--text-muted)]" htmlFor="search-key">Brave Search API Key</label>
                <input id="search-key" type="password" autoComplete="off" value={draft.webSearch?.apiKey ?? ''}
                  onChange={event => setDraft(d => ({ ...d, webSearch: { enabled: d.webSearch?.enabled ?? false, apiKey: event.target.value } }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)]" />
              </details>
              <div className="pt-3 border-t border-[var(--line)] space-y-5">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                  高级参数 · 滑动调节
                </p>

                {/* 温度 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">温度</label>
                    <button
                      onClick={() => setDraft(d => ({ ...d, temperature: tempIsAuto ? 0.7 : 'auto' }))}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        tempIsAuto ? 'bg-[var(--text)] text-[var(--page)]' : 'bg-[var(--bubble)] text-[var(--text-muted)]'
                      }`}
                    >
                      自动
                    </button>
                  </div>
                  <RangeField
                    label=""
                    value={tempValue}
                    min={0}
                    max={1.2}
                    step={0.1}
                    disabled={tempIsAuto}
                    onChange={v => setDraft(d => ({ ...d, temperature: Math.round(v * 10) / 10 }))}
                    format={v => v.toFixed(1)}
                  />
                  <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                    {tempIsAuto
                      ? '自动：服务端先按 0.7 请求，模型拒绝时自动降级'
                      : '数值越大回答越发散，越小越稳定'}
                  </p>
                </div>

                {/* 单次输出上限 */}
                <RangeField
                  label="单次输出上限"
                  value={capValue}
                  min={4096}
                  max={1000000}
                  step={16384}
                  onChange={v => setDraft(d => ({ ...d, maxTokensCap: v }))}
                  format={v => v >= 1_000_000 ? '1M' : `${Math.round(v / 1024)}K`}
                  hint="推理模型（deepseek / qwen / glm）建议 ≥16K；minimax 等大上下文模型可拉到 1M"
                />

                {/* 单次调用超时 */}
                <RangeField
                  label="单次调用超时"
                  value={timeoutValue}
                  min={30000}
                  max={300000}
                  step={10000}
                  onChange={v => setDraft(d => ({ ...d, timeoutMs: v }))}
                  format={v => `${Math.round(v / 1000)} 秒`}
                  hint="慢模型（glm-5）建议 ≥120 秒"
                />
              </div>
            </div>
          )}

          {/* ── 顾问管理 ── */}
          {tab === 'advisors' && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] pb-1">
                调整参与讨论的 Agent、编辑思维档案，或添加新 Agent。
              </p>

              {/* 内置顾问 */}
              {ADVISORS.map(a => {
                const isExpanded = expandedId === a.id
                const isCustomized = !!draft.customProfiles[a.id as BuiltinAdvisorId]
                const hidden = isHidden(a.id)
                const currentProfile = draft.customProfiles[a.id as BuiltinAdvisorId] ?? a.profile

                return (
                  <div key={a.id}
                    className="border border-[var(--line)] rounded-xl overflow-hidden"
                    style={{ borderLeft: `3px solid ${hidden ? 'var(--line)' : a.color}` }}
                  >
                    <div className="flex items-center px-3 py-2.5 gap-2">
                      <button
                        onClick={() => toggleHidden(a.id)}
                        title={hidden ? '点击加入面板' : '点击移出面板'}
                        className={`w-8 h-5 rounded-full flex items-center transition-colors shrink-0 ${
                          hidden ? 'bg-[var(--line)] justify-start' : 'justify-end'
                        }`}
                        style={{ background: hidden ? undefined : a.color }}
                      >
                        <span className="w-4 h-4 bg-white rounded-full shadow mx-0.5 block" />
                      </button>

                      <span className={`text-sm font-bold shrink-0 transition-opacity ${hidden ? 'opacity-30' : ''}`}
                        style={{ color: a.color }}>{a.icon}</span>
                      <span className={`text-sm font-medium flex-1 truncate transition-opacity ${hidden ? 'opacity-40' : 'text-[var(--text)]'}`}>
                        {a.name}
                      </span>

                      {isCustomized && !hidden && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bubble)] text-[var(--text-muted)] font-medium shrink-0">
                          已自定义
                        </span>
                      )}

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        disabled={hidden}
                        className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bubble)] transition-colors disabled:opacity-30"
                        title="编辑档案"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[var(--line)]">
                        <textarea
                          value={currentProfile}
                          onChange={e => updateBuiltinProfile(a.id as BuiltinAdvisorId, e.target.value)}
                          rows={10}
                          className="w-full text-xs text-[var(--text)] border border-[var(--line)] rounded-xl px-3 py-2.5
                                     outline-none focus:border-[var(--text-muted)] transition-colors resize-y leading-relaxed font-mono"
                          spellCheck={false}
                        />
                        {isCustomized && (
                          <button onClick={() => resetBuiltinProfile(a.id as BuiltinAdvisorId)}
                            className="mt-2 text-xs text-[var(--error)] hover:underline">
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
                  <div className="flex-1 h-px bg-[var(--line)]" />
                  <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">自定义 Agent</span>
                  <div className="flex-1 h-px bg-[var(--line)]" />
                </div>
              )}

              {(draft.customAdvisors ?? []).map(ca => {
                const isExpanded = expandedId === ca.id
                const hidden = isHidden(ca.id)

                return (
                  <div key={ca.id}
                    className="border border-[var(--line)] rounded-xl overflow-hidden"
                    style={{ borderLeft: `3px solid ${hidden ? 'var(--line)' : ca.color}` }}
                  >
                    <div className="flex items-center px-3 py-2.5 gap-2">
                      <button
                        onClick={() => toggleHidden(ca.id)}
                        title={hidden ? '点击加入面板' : '点击移出面板'}
                        className="w-8 h-5 rounded-full flex items-center transition-colors shrink-0"
                        style={{ background: hidden ? 'var(--line)' : ca.color, justifyContent: hidden ? 'flex-start' : 'flex-end' }}
                      >
                        <span className="w-4 h-4 bg-white rounded-full shadow mx-0.5 block" />
                      </button>

                      <span className={`text-sm font-bold shrink-0 transition-opacity ${hidden ? 'opacity-30' : ''}`}
                        style={{ color: ca.color }}>{ca.icon}</span>
                      <span className={`text-sm font-medium flex-1 truncate transition-opacity ${hidden ? 'opacity-40' : 'text-[var(--text)]'}`}>
                        {ca.name}
                      </span>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ca.id)}
                        className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bubble)] transition-colors"
                        title="编辑档案"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => deleteCustomAdvisor(ca.id)}
                        className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--error)] hover:bg-[var(--bubble)] transition-colors"
                        title="删除此 Agent"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[var(--line)]">
                        <textarea
                          value={ca.profile}
                          onChange={e => updateCustomProfile(ca.id, e.target.value)}
                          rows={10}
                          className="w-full text-xs text-[var(--text)] border border-[var(--line)] rounded-xl px-3 py-2.5
                                     outline-none focus:border-[var(--text-muted)] transition-colors resize-y leading-relaxed font-mono"
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
                             border-[var(--line)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text)]
                             transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新增 Agent
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--line)]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bubble)] rounded-xl transition-colors">
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium bg-[var(--text)] text-[var(--page)] rounded-xl
                       hover:opacity-90 active:scale-95 transition-all"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
