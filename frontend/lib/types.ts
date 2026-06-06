export type Stance = '支持' | '反对' | '有条件支持' | '需要更多信息'

/** 内置顾问的固定 ID */
export type BuiltinAdvisorId = 'jobs' | 'musk' | 'buffett' | 'munger'

/** 顾问 ID 可以是内置 ID 或用户自定义 ID（字符串）*/
export type AdvisorId = string

export type AdvisorStatus = 'idle' | 'thinking' | 'done' | 'error'

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

export interface Dispute {
  between: [string, string]
  clash: string
  a_says: string
  b_says: string
  trust: string
  why: string
}

export interface CrossAnalysis {
  disputes: Dispute[]
  verdict: string
  listen_to: string[]
  blind_spot: string
  do_next: string[]
}

export interface PanelResult {
  judgments: Record<string, AdvisorJudgment | undefined>
  advisorStatus: Record<string, AdvisorStatus>
  streamingTexts: Record<string, string | undefined>
  analysis?: CrossAnalysis
  analysisStatus: 'idle' | 'thinking' | 'done'
  analysisStream: string
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
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PreviousJudgment {
  advisorId: AdvisorId
  judgment: AdvisorJudgment
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
    | 'analysis_start'
    | 'analysis_token'
    | 'analysis_complete'
    | 'complete'
    | 'error'
  advisorId?: string
  token?: string
  judgment?: AdvisorJudgment | null
  analysis?: CrossAnalysis | null
  error?: string
  /** 辩论模式下标记阶段 */
  phase?: 'initial' | 'debate'
}
