import type { AppSettings, ModelTarget, Provider } from './types'

export function modelKey(providerId: string, model: string): string {
  return `provider:${encodeURIComponent(providerId)}/${encodeURIComponent(model)}`
}

export function resolveModelTarget(
  settings: Pick<AppSettings, 'providers'>,
  selection: string,
): (ModelTarget & { provider?: Provider }) | null {
  for (const provider of settings.providers) {
    const model = provider.models.find(name => modelKey(provider.id, name) === selection)
    if (model) return { providerId: provider.id, model, provider }
  }
  // 只为旧版未区分服务商的选择迁移一次，保存后使用完整 key。
  if (!selection.startsWith('provider:')) {
    const provider = settings.providers.find(p => p.models.includes(selection))
    if (provider) return { providerId: provider.id, model: selection, provider }
    if (settings.providers.length === 0 && selection.trim()) return { model: selection.trim() }
  }
  return null
}

export function normalizeModelSelection(
  settings: Pick<AppSettings, 'providers' | 'defaultModel'>,
  requested?: string | null,
): string {
  for (const selection of [requested, settings.defaultModel]) {
    const target = selection ? resolveModelTarget(settings, selection) : null
    if (target) return target.providerId ? modelKey(target.providerId, target.model) : target.model
  }
  const provider = settings.providers.find(p => p.models.length > 0)
  return provider ? modelKey(provider.id, provider.models[0]) : ''
}
