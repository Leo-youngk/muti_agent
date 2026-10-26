import { describe, it, expect } from 'vitest'

import { parseJSON } from '@/app/api/chat/shared'

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
    expect(parseJSON('{"a": 1,}')).toEqual({ a: 1 })
  })
})
