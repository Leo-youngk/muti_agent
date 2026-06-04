export type Stance = '支持' | '反对' | '有条件支持' | '需要更多信息'
export type AdvisorId = 'jobs' | 'musk' | 'buffett' | 'munger'
export type AdvisorStatus = 'idle' | 'thinking' | 'done' | 'error'

export interface AdvisorJudgment {
  advisor: string
  stance: Stance
  core_judgment: string
  reasoning: string
  focus: string
  criticism: string
  demand: string
  approach: string
  blind_spot: string
}

export interface Dispute {
  between: [string, string]
  topic: string
  a_position: string
  b_position: string
  why_they_clash: string
  who_to_trust: string
  trust_reason: string
}

export interface CrossAnalysis {
  question_restate: string
  disputes: Dispute[]
  conclusion: {
    core_tension: string
    top_voices: string[]
    top_voices_reason: string
    reference_only: string[]
    reference_only_reason: string
    biggest_blind_spot: string
    worth_continuing: boolean
    verdict: string
    next_steps: string[]
  }
}

export interface PanelResult {
  judgments: Partial<Record<AdvisorId, AdvisorJudgment>>
  advisorStatus: Record<AdvisorId, AdvisorStatus>
  /** 每个顾问的 token 流累积文本 */
  streamingTexts: Partial<Record<AdvisorId, string>>
  analysis?: CrossAnalysis
  analysisStatus: 'idle' | 'thinking' | 'done'
  /** 分析阶段的 token 流累积文本 */
  analysisStream: string
}

export interface Message {
  id: string
  role: 'user' | 'panel'
  content: string
  panel?: PanelResult
  /** 如果这是一条追问消息，记录追问的目标顾问 */
  followUpMeta?: FollowUpMeta
}

export interface Thread {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

/** 用于传递给后端的对话历史 */
export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 追问模式：传给后端的上一轮顾问判断 */
export interface PreviousJudgment {
  advisorId: AdvisorId
  judgment: AdvisorJudgment
}

/** 消息的追问上下文标记 */
export interface FollowUpMeta {
  targetAdvisorId: AdvisorId
  /** 是否是追问模式（区别于全团模式） */
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
  advisorId?: AdvisorId
  /** advisor_token / analysis_token 的单个 chunk */
  token?: string
  judgment?: AdvisorJudgment | null
  analysis?: CrossAnalysis | null
  error?: string
}
