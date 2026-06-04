export type Stance = '支持' | '反对' | '有条件支持' | '需要更多信息'
export type AdvisorId = 'jobs' | 'musk' | 'buffett' | 'munger' | 'pg' | 'zhang'
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
