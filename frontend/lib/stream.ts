import type { StreamEvent } from './types'

export async function* streamChat(
  task: string,
  threadId: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, thread_id: threadId }),
  })

  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try { detail = JSON.parse(text).error ?? text } catch {}
    throw new Error(detail)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6).trim()
        if (data) {
          try { yield JSON.parse(data) as StreamEvent } catch {}
        }
      }
    }
  }
}
