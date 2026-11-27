import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from './logic'

describe('base64 logic', () => {
  it('ASCII 编解码', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=')
    expect(decodeBase64('aGVsbG8=')).toEqual({ ok: true, value: 'hello' })
  })

  it('UTF-8 中文与 emoji', () => {
    const text = '你好，世界 🌍'
    const enc = encodeBase64(text)
    expect(enc).toBe('5L2g5aW977yM5LiW55WMIPCfjI0=')
    expect(decodeBase64(enc)).toEqual({ ok: true, value: text })
  })

  it('URL-safe 无填充', () => {
    expect(encodeBase64('subjects?_d', { urlSafe: true })).toBe('c3ViamVjdHM_X2Q')
    expect(encodeBase64('>>>???', { urlSafe: true })).toBe('Pj4-Pz8_')
    expect(decodeBase64('Pj4-Pz8_')).toEqual({ ok: true, value: '>>>???' })
    expect(decodeBase64('c3ViamVjdHM_X2Q')).toEqual({ ok: true, value: 'subjects?_d' })
  })

  it('容忍空白与缺失填充', () => {
    expect(decodeBase64('aGVs\nbG8')).toEqual({ ok: true, value: 'hello' })
  })

  it('非法输入', () => {
    expect(decodeBase64('***').ok).toBe(false)
    expect(decodeBase64('a').ok).toBe(false)
    expect(decodeBase64('/w==').ok).toBe(false) // 0xFF 不是合法 UTF-8
  })

  it('空串', () => {
    expect(encodeBase64('')).toBe('')
    expect(decodeBase64('')).toEqual({ ok: true, value: '' })
  })

  it('长文本不会栈溢出', () => {
    const big = 'a'.repeat(200_000)
    const r = decodeBase64(encodeBase64(big))
    expect(r.ok && r.value.length).toBe(200_000)
  })
})
