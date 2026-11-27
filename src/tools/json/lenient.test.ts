import { describe, expect, it } from 'vitest'
import { formatLenient } from './lenient'

describe('formatLenient 容错格式化', () => {
  it('合法 JSON 与 JSON.stringify 的缩进结果一致', () => {
    const samples = [
      '{"a":1,"b":[1,2,{"c":null}],"d":{"e":"x\\ny","f":true}}',
      '[]',
      '{}',
      '[[],{}]',
      '"str"',
      '-1.5',
      'false',
      '  { "a" : [ 1 , 2 ] }  ',
    ]
    for (const s of samples) {
      for (const indent of [2, 4] as const) {
        const r = formatLenient(s, indent)
        expect(r.error).toBeNull()
        expect(r.bad).toBe('')
        expect(r.good).toBe(JSON.stringify(JSON.parse(s), null, indent))
      }
    }
  })

  it('支持 tab 缩进与 0 缩进（压缩）', () => {
    expect(formatLenient('{"a":[1]}', 'tab').good).toBe('{\n\t"a": [\n\t\t1\n\t]\n}')
    expect(formatLenient('{ "a" : [ 1 , 2 ] }', 0).good).toBe('{"a":[1,2]}')
  })

  it('保留数字字面量（不丢失精度与写法）', () => {
    expect(formatLenient('[1.50e+3]').good).toBe('[\n  1.50e+3\n]')
    expect(formatLenient('[12345678901234567890]').good).toBe('[\n  12345678901234567890\n]')
  })

  it('缺少值：错误位置之前正常格式化，之后原样保留', () => {
    const r = formatLenient('{"a":1,"b":,"c":3}')
    expect(r.good).toBe('{\n  "a": 1,\n  "b": ')
    expect(r.bad).toBe(',"c":3}')
    expect(r.error).toMatchObject({ position: 11, line: 1, column: 12 })
    expect(r.error!.message).toContain('意外的字符')
  })

  it('尾逗号', () => {
    const r = formatLenient('[1,2,]')
    expect(r.good).toBe('[\n  1,\n  2,\n  ')
    expect(r.bad).toBe(']')
    expect(r.error!.message).toContain('多余的逗号')
    const o = formatLenient('{"a":1,}')
    expect(o.bad).toBe('}')
    expect(o.error!.message).toContain('多余的逗号')
  })

  it('属性值缺失', () => {
    const r = formatLenient('{"a":}')
    expect(r.bad).toBe('}')
    expect(r.error!.message).toContain('缺少值')
  })

  it('单引号字符串给出专门提示', () => {
    const r = formatLenient("{'a':1}")
    expect(r.good).toBe('{\n  ')
    expect(r.bad).toBe("'a':1}")
    expect(r.error!.message).toContain('双引号')
  })

  it('缺少逗号：good 与 bad 之间补空格以便阅读', () => {
    const r = formatLenient('{"a":1 "b":2}')
    expect(r.good).toBe('{\n  "a": 1 ')
    expect(r.bad).toBe('"b":2}')
    expect(r.error!.message).toContain('逗号')
  })

  it('缺少冒号', () => {
    const r = formatLenient('{"a" 1}')
    expect(r.bad).toBe('1}')
    expect(r.error!.message).toContain('冒号')
  })

  it('未闭合的对象/数组：错误位于输入末尾，bad 为空', () => {
    const r = formatLenient('{"a":[1,2')
    expect(r.good).toBe('{\n  "a": [\n    1,\n    2')
    expect(r.bad).toBe('')
    expect(r.error).toMatchObject({ position: 9, line: 1, column: 10 })
    expect(r.error!.message).toContain('"["')
  })

  it('未结束的字符串：已输入的部分保留', () => {
    const r = formatLenient('{"a":"hel')
    expect(r.good).toBe('{\n  "a": "hel')
    expect(r.bad).toBe('')
    expect(r.error!.message).toContain('字符串未结束')
  })

  it('字符串内的非法转义与控制字符', () => {
    const esc = formatLenient('["ab\\qcd"]')
    expect(esc.good).toBe('[\n  "ab')
    expect(esc.bad).toBe('\\qcd"]')
    expect(esc.error!.message).toContain('转义')

    const uni = formatLenient('["\\u12G4"]')
    expect(uni.good).toBe('[\n  "\\u12')
    expect(uni.bad).toBe('G4"]')

    const ctrl = formatLenient('{"a":"x\ny"}')
    expect(ctrl.good).toBe('{\n  "a": "x')
    expect(ctrl.bad).toBe('\ny"}')
    expect(ctrl.error).toMatchObject({ line: 1, column: 8 })
  })

  it('非法数字与字面量：已匹配的前缀保留', () => {
    const num = formatLenient('[1.]')
    expect(num.good).toBe('[\n  1.')
    expect(num.bad).toBe(']')
    expect(formatLenient('[-]').bad).toBe(']')
    expect(formatLenient('[1e]').bad).toBe(']')
    const lit = formatLenient('[tru]')
    expect(lit.good).toBe('[\n  tru')
    expect(lit.bad).toBe(']')
    const nul = formatLenient('{"a":nul')
    expect(nul.good).toBe('{\n  "a": nul')
    expect(nul.bad).toBe('')
    expect(nul.error!.message).toContain('null')
  })

  it('前导零：0 之后的数字被视为多余内容', () => {
    const r = formatLenient('[01]')
    expect(r.good).toBe('[\n  0 ')
    expect(r.bad).toBe('1]')
  })

  it('多个顶层值：第二个值起视为错误', () => {
    const r = formatLenient('{"a":1} {"b":2}')
    expect(r.good).toBe('{\n  "a": 1\n}\n')
    expect(r.bad).toBe('{"b":2}')
    expect(r.error!.message).toContain('已结束')
  })

  it('多余的右括号与括号不匹配', () => {
    const r = formatLenient('{"a":[1}')
    expect(r.good).toBe('{\n  "a": [\n    1 ')
    expect(r.bad).toBe('}')
    const extra = formatLenient('[1]]')
    expect(extra.bad).toBe(']')
  })

  it('行列号基于原始输入（含多行）', () => {
    const text = '{\n  "a": 1,\n  "b": ?\n}'
    const r = formatLenient(text)
    expect(r.error).toMatchObject({ line: 3, column: 8 })
    expect(r.bad).toBe('?\n}')
    expect(r.good).toBe('{\n  "a": 1,\n  "b": ')
  })

  it('空输入与纯空白', () => {
    expect(formatLenient('').error?.message).toBe('输入为空')
    expect(formatLenient(' \n ').error?.message).toBe('输入为空')
  })

  it('good + bad 去掉空白后等于原文（除补充的空白）', () => {
    const text = '{"a":[1,2,{"b":tru'
    const r = formatLenient(text)
    expect((r.good + r.bad).replace(/\s/g, '')).toBe(text.replace(/\s/g, ''))
  })

  it('随机破坏合法 JSON：是否报错与 JSON.parse 判定一致', () => {
    const base = JSON.stringify({ a: [1, -2.5e3, 'x\\u00e9\n', null, true, { b: {} }], 'k y': [[], {}], n: 0 }, null, 1)
    let seed = 42
    const rand = (m: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed % m
    }
    const junk = ['', ',', ':', '{', '}', '[', ']', '"', '\\', 'x', '0', '-', '.', 'e', ' ']
    for (let i = 0; i < 2000; i++) {
      const pos = rand(base.length + 1)
      const mutated = base.slice(0, pos) + junk[rand(junk.length)] + base.slice(pos + rand(3))
      let valid = true
      try {
        JSON.parse(mutated)
      } catch {
        valid = false
      }
      const r = formatLenient(mutated, 2)
      expect(r.error === null, mutated).toBe(valid)
      if (valid) expect(JSON.parse(r.good)).toEqual(JSON.parse(mutated))
    }
  })

  it('深层嵌套不会爆栈', () => {
    const depth = 50_000
    const text = '['.repeat(depth) + ']'.repeat(depth)
    const r = formatLenient(text, 0)
    expect(r.error).toBeNull()
    expect(r.good).toBe(text)
    const broken = formatLenient('['.repeat(depth), 0)
    expect(broken.error!.position).toBe(depth)
  })

  it('大输入保持线性耗时', () => {
    const rows = Array.from({ length: 100_000 }, (_, i) => ({ id: i, name: `item-${i}`, tags: ['a', 'b'], ok: i % 2 === 0 }))
    const text = JSON.stringify(rows)
    const start = performance.now()
    const r = formatLenient(text, 2)
    expect(r.error).toBeNull()
    expect(r.good).toBe(JSON.stringify(rows, null, 2))
    expect(performance.now() - start).toBeLessThan(5000)
  })
})
