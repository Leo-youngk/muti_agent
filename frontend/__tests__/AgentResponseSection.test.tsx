import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AgentResponseSection from '@/components/AgentResponseSection'
import type { AdvisorMeta } from '@/lib/advisors'

const meta: AdvisorMeta = {
  id: 'agent-x',
  name: '分析 Agent',
  nameEn: 'Agent X',
  color: '#ff0000',
  icon: 'X',
  tagline: '',
  profile: '',
}

const judgment = {
  advisor: '分析 Agent',
  stance: '支持' as const,
  core_judgment: '核心内容',
  reasoning: '完整推理',
  criticism: '主要批评',
  focus: '焦点正文',
  demand: '改变正文',
  approach: '切入方式',
  blind_spot: '潜在盲点',
}

describe('AgentResponseSection', () => {
  it('leads with judgment and reasoning, without secondary fields or avatar', () => {
    render(<AgentResponseSection index={0} meta={meta} status="done" judgment={judgment} />)

    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('分析 Agent')).toBeInTheDocument()
    for (const text of ['核心内容', '完整推理']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.queryByText('主要批评')).not.toBeInTheDocument()
    // 版面层级已区分核心判断与推理，不再为它们保留小标题
    expect(screen.queryByRole('heading', { name: '核心判断' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '推理' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('分析 Agent 头像')).not.toBeInTheDocument()
  })

  it('does not render removed secondary fields', () => {
    const { container } = render(
      <AgentResponseSection index={0} meta={meta} status="done" judgment={judgment} />,
    )

    expect(container.querySelector('details')).not.toBeInTheDocument()
    expect(screen.queryByText(/展开完整判断/)).not.toBeInTheDocument()
    for (const text of ['焦点正文', '改变正文', '切入方式', '潜在盲点']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    }
  })

  it('does not render an expand control', () => {
    const { container } = render(
      <AgentResponseSection
        index={0}
        meta={meta}
        status="done"
        judgment={judgment}
      />,
    )

    expect(container.querySelector('details')).not.toBeInTheDocument()
    expect(screen.queryByText(/展开完整判断/)).not.toBeInTheDocument()
  })

  it('uses plain text for thinking and failure states', () => {
    const { rerender } = render(
      <AgentResponseSection index={1} meta={meta} status="thinking" />,
    )
    expect(screen.getByText('正在思考…')).toBeInTheDocument()

    rerender(
      <AgentResponseSection
        index={1}
        meta={meta}
        status="error"
        errorDetail="服务不可用"
      />,
    )
    expect(screen.getByText(/请求失败：服务不可用/)).toBeInTheDocument()
  })

  it('renders markdown, including CJK-adjacent emphasis', () => {
    const { container } = render(
      <AgentResponseSection
        index={0}
        meta={meta}
        status="done"
        judgment={{
          ...judgment,
          core_judgment: '中文**加粗**中文',
          reasoning: '- 第一条\n- 第二条\n\n最后 `code` 收尾',
        }}
      />,
    )

    // Streamdown 用 span[data-streamdown] 而非原生 strong/em 标签
    expect(container.querySelector('[data-streamdown="strong"]')).toHaveTextContent('加粗')
    expect(container.querySelectorAll('[data-streamdown="list-item"]')).toHaveLength(2)
    expect(container.querySelector('code')).toHaveTextContent('code')
  })

  it('calls the inline follow-up and retry actions', () => {
    const follow = vi.fn()
    const retry = vi.fn()
    const { rerender } = render(
      <AgentResponseSection
        index={0}
        meta={meta}
        status="done"
        judgment={judgment}
        onFollowUp={follow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '追问此 Agent' }))
    expect(follow).toHaveBeenCalledOnce()

    rerender(
      <AgentResponseSection index={0} meta={meta} status="error" onRetry={retry} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
