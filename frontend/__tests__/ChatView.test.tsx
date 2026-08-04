import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import ChatView from '@/components/ChatView'
import { AdvisorProvider } from '@/lib/AdvisorContext'
import type { AdvisorMeta } from '@/lib/advisors'
import type {
  AdvisorJudgment,
  AdvisorStatus,
  Message,
  PanelResult,
} from '@/lib/types'

const advisor = (index: number): AdvisorMeta => ({
  id: `a${index}`,
  name: `Agent ${index}`,
  nameEn: `Agent ${index}`,
  color: '#000000',
  icon: String(index),
  tagline: '',
  profile: '',
})

function messagesFor(advisors: AdvisorMeta[]): Message[] {
  const reversed = [...advisors].reverse()
  const advisorStatus = Object.fromEntries(
    reversed.map(a => [a.id, 'done' as AdvisorStatus]),
  )
  const judgments = Object.fromEntries(
    reversed.map(a => [a.id, {
      advisor: a.name,
      stance: '支持',
      core_judgment: `${a.name} 核心`,
      reasoning: `${a.name} 推理`,
      criticism: `${a.name} 批评`,
      blind_spot: `${a.name} 盲点`,
    } satisfies AdvisorJudgment]),
  )
  const panel: PanelResult = {
    advisorStatus,
    judgments,
    streamingTexts: {},
    analysisStatus: 'idle',
    analysisStream: '',
  }

  return [
    { id: 'user-1', role: 'user', content: '用户问题正文' },
    { id: 'panel-1', role: 'panel', content: '', panel },
  ]
}

const callbacks = {
  onFollowUp: vi.fn(),
  onRegenerate: vi.fn(),
  onRetryAdvisor: vi.fn(),
  onStartDiscussion: vi.fn(),
  onContinueDiscussion: vi.fn(),
  onDebate: vi.fn(),
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function renderView(advisors: AdvisorMeta[]) {
  const map = Object.fromEntries(advisors.map(item => [item.id, item]))
  return render(
    <AdvisorProvider value={map}>
      <ChatView
        {...callbacks}
        advisors={advisors}
        messages={messagesFor(advisors)}
        isStreaming={false}
      />
    </AdvisorProvider>,
  )
}

describe('ChatView', () => {
  it('renders arbitrary agents in configured order, not completion order', () => {
    const advisors = Array.from({ length: 6 }, (_, index) => advisor(index))
    renderView(advisors)

    const headings = screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)
    expect(headings).toEqual(['Agent 0', 'Agent 1', 'Agent 2', 'Agent 3', 'Agent 4', 'Agent 5'])
    expect(screen.getByText('用户问题正文')).toHaveClass('text-[19px]')
    expect(screen.queryByText(/\/6|进度|展开完整判断/)).not.toBeInTheDocument()
  })

  it('does not offer another multi-agent round for one agent', () => {
    renderView([advisor(0)])

    expect(screen.getByRole('button', { name: '继续讨论' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发起下一轮讨论' })).not.toBeInTheDocument()
  })
})
