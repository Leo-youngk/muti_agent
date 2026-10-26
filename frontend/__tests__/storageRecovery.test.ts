import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Thread } from '@/lib/types'
const idb = vi.hoisted(() => ({ getMany: vi.fn(), setMany: vi.fn(), set: vi.fn() }))
vi.mock('idb-keyval', () => idb)
import { checkpointThreads, loadThreads, loadThreadsSync, saveThreads } from '@/lib/storage'

function thread(text = '仍在生成的内容'): Thread {
  return { id: 't', title: '测试', createdAt: 1, messages: [{ id: 'p', role: 'panel', content: '', panel: { advisorStatus: { a: 'thinking' }, judgments: {}, streamingTexts: { a: `{"advisor":"A","stance":"支持","core_judgment":"${text}","reasoning":"还没写完` } } }] }
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); idb.setMany.mockResolvedValue(undefined); idb.getMany.mockResolvedValue([[], 0]) })

describe('后台保存与恢复', () => {
  it('切后台保存部分正文，重开显示中断而非丢内容或假装完成', () => {
    expect(checkpointThreads([thread()], 20)).toBe(true)
    const panel = loadThreadsSync()[0].messages[0].panel!
    expect(panel.judgments.a?.core_judgment).toBe('仍在生成的内容')
    expect(panel.streamingTexts).toEqual({})
    expect(panel.advisorStatus.a).toBe('partial')
  })
  it('较新的后台快照优先于旧 IndexedDB，较旧快照不会覆盖新保存', async () => {
    checkpointThreads([thread('较新内容')], 30)
    idb.getMany.mockResolvedValue([[thread('旧内容')], 10])
    expect((await loadThreads())[0].messages[0].panel?.judgments.a?.core_judgment).toBe('较新内容')
    await saveThreads([thread('已保存')], 40)
    expect(localStorage.getItem('advisor_threads_checkpoint_v1')).toBeNull()
  })
  it('IndexedDB 失败时真实降级到本地检查点', async () => {
    idb.setMany.mockRejectedValue(new Error('quota'))
    expect(await saveThreads([thread()], 10)).toBe(true)
    expect(loadThreadsSync()).toHaveLength(1)
  })
})
