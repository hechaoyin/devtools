import { describe, expect, it } from 'vitest'
import { escapeJsonString, formatJson, minifyJson, parseJsonError, unescapeJsonString, validateJson } from './logic'

describe('json logic', () => {
  it('格式化：默认 2 空格缩进', () => {
    const r = formatJson('{"a":1,"b":[1,2]}')
    expect(r).toEqual({ ok: true, value: '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}' })
  })

  it('格式化：4 空格、tab、键排序', () => {
    expect(formatJson('{"a":1}', { indent: 4 })).toEqual({ ok: true, value: '{\n    "a": 1\n}' })
    expect(formatJson('{"a":1}', { indent: 'tab' })).toEqual({ ok: true, value: '{\n\t"a": 1\n}' })
    const sorted = formatJson('{"b":1,"a":{"d":1,"c":2}}', { sortKeys: true, indent: 0 })
    expect(sorted).toEqual({ ok: true, value: '{"a":{"c":2,"d":1},"b":1}' })
  })

  it('格式化：非法 JSON 返回错误', () => {
    const r = formatJson('{"a":}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toBeTruthy()
  })

  it('空输入报错', () => {
    expect(formatJson('  ').ok).toBe(false)
    expect(minifyJson('').ok).toBe(false)
    expect(validateJson('').valid).toBe(false)
  })

  it('压缩', () => {
    expect(minifyJson('{\n  "a": 1,\n  "b": [ 1, 2 ]\n}')).toEqual({ ok: true, value: '{"a":1,"b":[1,2]}' })
  })

  it('校验', () => {
    expect(validateJson('[1,2,3]').valid).toBe(true)
    expect(validateJson('"str"').valid).toBe(true)
    const bad = validateJson('{\n  "a": 1,\n}')
    expect(bad.valid).toBe(false)
    expect(bad.error?.line).toBeGreaterThanOrEqual(2)
  })

  it('解析错误位置：从 position 推导行列', () => {
    const err = parseJsonError('{\n  "a": x\n}', new SyntaxError('Unexpected token x in JSON at position 9'))
    expect(err.line).toBe(2)
    expect(err.column).toBe(8)
  })

  it('解析错误位置：line/column 格式', () => {
    const err = parseJsonError('', new SyntaxError('Unexpected token (JSON.parse: line 3 column 5 of the JSON data)'))
    expect(err).toMatchObject({ line: 3, column: 5 })
  })

  it('转义与反转义', () => {
    const src = 'a "quote"\nline\ttab \\ 中文'
    const escaped = escapeJsonString(src)
    expect(escaped).toBe('a \\"quote\\"\\nline\\ttab \\\\ 中文')
    expect(unescapeJsonString(escaped)).toEqual({ ok: true, value: src })
    expect(unescapeJsonString(`"${escaped}"`)).toEqual({ ok: true, value: src })
  })

  it('反转义：非法内容报错', () => {
    expect(unescapeJsonString('bad \\q escape').ok).toBe(false)
  })
})
