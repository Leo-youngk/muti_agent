import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Thread } from '@/lib/types'
const storage = vi.hoisted(() => ({ loadThreadsSync: vi.fn(), loadThreads: vi.fn(), saveThreads: vi.fn(), checkpointThreads: vi.fn() }))
vi.mock('@/lib/storage', () => storage)
import { useThreads } from '@/lib/useThreads'

const initial: Thread[] = [{ id: 't', title: '测试', createdAt: 1, messages: [{ id: 'p', role: 'panel', content: '', panel: { judgments: {}, advisorStatus: { a: 'thinking' }, streamingTexts: {} } }] }]
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks()
  storage.loadThreadsSync.mockReturnValue(initial); storage.loadThreads.mockResolvedValue(initial); storage.saveThreads.mockResolvedValue(true)
})
afterEach(() => vi.useRealTimers())
describe('连续流式期间定期保存', () => {
  it('持续更新不会让防抖永远推迟落盘，pagehide 保存最新检查点', async () => {
    const hook = renderHook(() => useThreads())
    await act(async () => {})
    hook.result.current.isStreamingRef.current = true
    for (let i = 0; i < 4; i++) {
      act(() => hook.result.current.updatePanel('t', 'p', p => ({ ...p, streamingTexts: { a: `第${i}段` } })))
      await act(async () => { vi.advanceTimersByTime(500) })
    }
    expect(storage.saveThreads).toHaveBeenCalled()
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(storage.checkpointThreads.mock.calls.at(-1)?.[0][0].messages[0].panel.streamingTexts.a).toBe('第3段')
    hook.unmount()
  })
})
