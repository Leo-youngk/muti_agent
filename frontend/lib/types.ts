export type Stance = '支持' | '反对' | '有条件支持' | '需要更多信息'

/** 内置顾问的固定 ID */
export type BuiltinAdvisorId =
  | 'jobs' | 'musk' | 'buffett' | 'munger'
  | 'pg' | 'bezos' | 'taleb' | 'ren' | 'zhangyiming' | 'horowitz'
  | 'lky' | 'huangzheng' | 'kk' | 'luxun'

/** 顾问 ID 可以是内置 ID 或用户自定义 ID（字符串）*/
export type AdvisorId = string

export type AdvisorStatus = 'queued' | 'idle' | 'thinking' | 'partial' | 'done' | 'error'

/** 每轮独立保存，后续修改顾问设置不改变历史。密钥不进入会话。 */
export interface AdvisorSnapshot {
  id: string
  name: string
  nameEn: string
  color: string
  icon: string
  tagline: string
  profile: string
}

export interface ModelTarget {
  providerId?: string
  model: string
}

export interface AdvisorJudgment {
  advisor: string
  stance: Stance
  core_judgment: string
  reasoning: string
  criticism: string
  blind_spot: string
  /** @deprecated 已从 prompt 移除，旧数据可能包含 */
  focus?: string
  demand?: string
  approach?: string
}

export interface PanelResult {
  judgments: Record<string, AdvisorJudgment | undefined>
  advisorStatus: Record<string, AdvisorStatus>
  advisorErrors?: Record<string, string | undefined>
  streamingTexts: Record<string, string | undefined>
  participants?: AdvisorSnapshot[]
  model?: ModelTarget
  promptVersion?: string
  research?: ResearchResult
}

export interface Message {
  id: string
  role: 'user' | 'panel'
  content: string
  panel?: PanelResult
  followUpMeta?: FollowUpMeta
  /** 标记此面板为辩论轮 */
  isDebateRound?: boolean
}

export interface Thread {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

/** 用户自定义的顾问 */
export interface CustomAdvisor {
  id: string
  name: string
  nameEn: string
  color: string
  icon: string
  tagline: string
  profile: string
}

/** API 服务商 */
export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
}

/** 用户可配置的全局设置 */
export interface AppSettings {
  providers: Provider[]
  defaultModel: string
  /** @deprecated 已迁移到 providers */
  apiKey: string
  /** @deprecated 已迁移到 providers */
  baseUrl: string
  /** 覆盖内置顾问的思维档案 */
  customProfiles: Partial<Record<BuiltinAdvisorId, string>>
  /** 用户新增的自定义顾问 */
  customAdvisors: CustomAdvisor[]
  /** 从面板中隐藏的顾问 ID（内置 + 自定义均可） */
  hiddenAdvisors: string[]
  /** 已应用到 hiddenAdvisors 的内置阵容版本，用于把后来新增的内置 agent 默认隐藏 */
  advisorRosterVersion?: number
  /** 高级参数：采样温度（undefined / 'auto' 表示不传，让服务端自己降级） */
  temperature?: number | 'auto'
  /** 高级参数：单次调用 max_tokens 上限（undefined 用服务端默认 16384） */
  maxTokensCap?: number
  /** 高级参数：服务端单次调用超时（毫秒，undefined 用服务端默认 120000） */
  timeoutMs?: number
  webSearch?: { enabled: boolean; apiKey: string }
  theme?: 'sage' | 'ocean' | 'midnight' | 'rose' | 'amber'
}

/** 该 agent 上一次成功作答的问答对，作为下一轮对话里的 user/assistant 样例 */
export interface PriorTurn {
  question: string
  judgment: AdvisorJudgment
}

export interface ConversationContext {
  background: string[]
  turns: { question: string; judgment?: AdvisorJudgment }[]
  omittedTurns: number
}

export interface ResearchSource {
  id: number
  title: string
  url: string
  excerpt: string
  kind: 'page_excerpt' | 'search_excerpt'
}

export interface ResearchResult {
  status: 'searching' | 'ready' | 'partial' | 'unavailable'
  sources: ResearchSource[]
  error?: string
  retrievedAt?: string
}

export interface PreviousJudgment {
  advisorId: AdvisorId
  judgment: AdvisorJudgment
  question?: string
}

export interface FollowUpMeta {
  targetAdvisorId: AdvisorId
  isFollowUp: true
}

export interface StreamEvent {
  event:
    | 'advisor_start'
    | 'advisor_token'
    | 'advisor_complete'
    | 'complete'
    | 'error'
  advisorId?: string
  token?: string
  judgment?: AdvisorJudgment | null
  status?: 'done' | 'partial' | 'error'
  error?: string
  /** 辩论模式下标记阶段 */
  phase?: 'initial' | 'debate'
}
