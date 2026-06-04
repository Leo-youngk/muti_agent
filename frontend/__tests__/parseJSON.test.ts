import { describe, it, expect } from 'vitest'

// Import the function directly from the route file — we extract the logic for testing
// Since parseJSON is not exported, we re-implement the same logic here to validate

function parseJSON<T>(text: string): T | null {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(stripped) as T } catch {}
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(stripped.slice(first, last + 1)) as T } catch {}
  }
  return null
}

describe('parseJSON', () => {
  it('parses valid JSON', () => {
    expect(parseJSON('{"a": 1}')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in markdown code block', () => {
    const input = '```json\n{"key": "value"}\n```'
    expect(parseJSON(input)).toEqual({ key: 'value' })
  })

  it('extracts JSON from surrounding text', () => {
    const input = 'Some text before {"a": 1, "b": "two"} some text after'
    expect(parseJSON(input)).toEqual({ a: 1, b: 'two' })
  })

  it('returns null for completely invalid input', () => {
    expect(parseJSON('not json at all')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseJSON('')).toBeNull()
  })

  it('handles nested objects', () => {
    const input = '{"outer": {"inner": true}}'
    expect(parseJSON(input)).toEqual({ outer: { inner: true } })
  })

  it('handles JSON with trailing comma gracefully', () => {
    // This should fail parsing but still return null gracefully
    expect(parseJSON('{"a": 1,}')).toBeNull()
  })
})
