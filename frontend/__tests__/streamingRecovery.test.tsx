import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStreaming } from '@/lib/useStreaming'
import { DEFAULT_SETTINGS } from '@/lib/storage'
import { modelKey } from '@/lib/modelSelection'
import type { PanelResult, Thread } from '@/lib/types'

const advisor = { id: 'a', name: 'A', nameEn: 'A', profile: '测试档案', color: '', icon: '', tagline: '' }
const settings = { ...DEFAULT_SETTINGS, providers: [{ id: 'p', name: '测试服务商', baseUrl: 'https://example.org/v1', apiKey: 'test-only', models: ['test-model'] }] }
afterEach(() => vi.unstubAllGlobals())

function setup() {
  let thread: Thread = { id: 't', title: '测试', createdAt: 1, messages: [] }
  const updateThread = (_id: string, fn: (t: Thread) => Thread) => { thread = fn(thread) }
  const updatePanel = (_tid: string, id: string, fn: (p: PanelResult) => PanelResult) => { thread = { ...thread, messages: thread.messages.map(m => m.id === id && m.panel ? { ...m, panel: fn(m.panel) } : m) } }
  const hook = renderHook(() => useStreaming(updateThread, updatePanel, { current: false }))
  return { hook, getThread: () => thread, panel: () => thread.messages.find(m => m.panel)!.panel!, submit: () => hook.result.current.handleSubmit('测试问题', 't', [thread], modelKey('p', 'test-model'), settings, [advisor]) }
}

describe('客户端不会把抢救内容当成完成', () => {
  it('带 judgment 的 partial/error 事件也保留中断信息', async () => {
    const payload = [{ event: 'advisor_start' }, { event: 'advisor_complete', status: 'partial', error: '输出达到上限', judgment: { advisor: 'A', stance: '支持', core_judgment: '保留核心', reasoning: '部分依据' } }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(payload.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } })))
    const test = setup()
    await act(async () => { await test.submit() })
    expect(test.panel().advisorStatus.a).toBe('partial')
    expect(test.panel().advisorErrors?.a).toBe('输出达到上限')
    expect(test.panel().judgments.a?.core_judgment).toBe('保留核心')
  })

  it('停止正在输出的 SSE 后正文仍然可读', async () => {
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'advisor_start' })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'advisor_token', token: '{"advisor":"A","stance":"支持","core_judgment":"停止前已经读到的判断","reasoning":"仍在生成' })}\n\n`))
    } }))))
    const test = setup()
    let pending: Promise<void>
    act(() => { pending = test.submit() })
    await waitFor(() => expect(test.panel().streamingTexts.a).toContain('已经读到'))
    act(() => test.hook.result.current.handleStop())
    await act(async () => { await pending })
    expect(test.panel().advisorStatus.a).toBe('partial')
    expect(test.panel().judgments.a?.core_judgment).toBe('停止前已经读到的判断')
  })
})
