import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InputBar from '@/components/InputBar'
import { AdvisorProvider } from '@/lib/AdvisorContext'

const props = {
  open: true,
  onSubmit: vi.fn(),
  isStreaming: false,
  selectedModel: 'model-a',
  onModelChange: vi.fn(),
  providers: [],
  onSettingsOpen: vi.fn(),
  onClose: vi.fn(),
}

const map = {
  a: {
    id: 'a',
    name: 'Agent A',
    nameEn: 'A',
    color: '#000000',
    icon: 'A',
    tagline: '',
    profile: '',
  },
}

function renderBar(propsOverride: Partial<ComponentProps<typeof InputBar>> = {}) {
  return render(
    <AdvisorProvider value={map}>
      <InputBar {...props} {...propsOverride} />
    </AdvisorProvider>,
  )
}

describe('InputBar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when closed', () => {
    const { container } = renderBar({ open: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('opens as a follow-up composer with a close action', () => {
    renderBar({ open: true, targetAdvisor: 'a' })

    expect(screen.getByText('追问 Agent A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭输入' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
