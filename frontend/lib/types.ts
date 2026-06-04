export interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  agent?: string
  status?: 'waiting' | 'thinking' | 'done'
}

export interface Thread {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

export interface StreamEvent {
  event: 'agent_start' | 'token' | 'agent_complete' | 'complete' | 'error'
  agent?: string
  content?: string
  error?: string
}
