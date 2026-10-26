import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InputBar from '@/components/InputBar'
import { AdvisorProvider } from '@/lib/AdvisorContext'

const props = {
  onSubmit: vi.fn(),
  isStreaming: false,
  selectedModel: 'model-a',
  onModelChange: vi.fn(),
  providers: [],
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
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('is always docked and visible, even with no follow-up target', () => {
    renderBar()
    expect(screen.getByPlaceholderText('发消息或输入问题…')).toBeInTheDocument()
  })

  it('shows a follow-up chip with a way to clear it', () => {
    const onClearTarget = vi.fn()
    const { container } = renderBar({ targetAdvisor: 'a', onClearTarget })

    expect(container.textContent).toContain('追问')
    expect(container.textContent).toContain('Agent A')
    fireEvent.click(screen.getByRole('button', { name: '取消追问对象' }))
    expect(onClearTarget).toHaveBeenCalledOnce()
  })

  it('submits on Enter and clears the input', () => {
    const onSubmit = vi.fn()
    renderBar({ onSubmit })

    const textarea = screen.getByPlaceholderText('发消息或输入问题…')
    fireEvent.change(textarea, { target: { value: '你好' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledWith('你好')
    expect(textarea).toHaveValue('')
  })

  it('does not send while confirming Chinese IME candidates', () => {
    renderBar()
    const textarea = screen.getByRole('textbox')
    fireEvent.compositionStart(textarea)
    fireEvent.change(textarea, { target: { value: '中文输入' } })
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('中文输入')
    fireEvent.compositionEnd(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(props.onSubmit).toHaveBeenCalledWith('中文输入')
  })

  it('allows drafting during generation and restores a draft after switching away', () => {
    const view = renderBar({ isStreaming: true, draftKey: 't1' })
    const textarea = screen.getByRole('textbox')
    expect(textarea).not.toBeDisabled()
    fireEvent.change(textarea, { target: { value: '待发送的问题' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(props.onSubmit).not.toHaveBeenCalled()
    view.unmount()
    renderBar({ draftKey: 't1' })
    expect(screen.getByRole('textbox')).toHaveValue('待发送的问题')
  })

  it('retains the draft when configuration validation rejects sending', () => {
    renderBar({ onSubmit: () => false })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '不要丢失' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(screen.getByRole('textbox')).toHaveValue('不要丢失')
  })
})
