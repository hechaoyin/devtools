import { describe, expect, it } from 'vitest'
import { decodeUrl, encodeUrl, parseQuery } from './logic'

describe('url logic', () => {
  it('组件模式编码所有保留字符', () => {
    expect(encodeUrl('a b&c=d/中', 'component')).toBe('a%20b%26c%3Dd%2F%E4%B8%AD')
  })

  it('完整 URL 模式保留结构字符', () => {
    expect(encodeUrl('https://x.com/a b?q=中&r=1', 'full')).toBe('https://x.com/a%20b?q=%E4%B8%AD&r=1')
  })

  it('解码', () => {
    expect(decodeUrl('a%20b%26c%3Dd%2F%E4%B8%AD')).toEqual({ ok: true, value: 'a b&c=d/中' })
    expect(decodeUrl('a%26b', 'full')).toEqual({ ok: true, value: 'a%26b' })
  })

  it('非法序列报错', () => {
    expect(decodeUrl('%E4%B8').ok).toBe(false)
    expect(decodeUrl('%').ok).toBe(false)
  })

  it('解析查询参数', () => {
    expect(parseQuery('https://a.com/p?x=1&y=%E4%B8%AD&x=2&z&w=a+b#hash')).toEqual([
      { key: 'x', value: '1' },
      { key: 'y', value: '中' },
      { key: 'x', value: '2' },
      { key: 'z', value: '' },
      { key: 'w', value: 'a b' },
    ])
    expect(parseQuery('a=1&b=2')).toHaveLength(2)
    expect(parseQuery('hello')).toEqual([])
    expect(parseQuery('')).toEqual([])
  })
})
