import { describe, expect, it } from 'vitest'
import { collapseAll, countNodes, createRoot, expandAll, flatten, previewValue, summaryOf, toggle, typeOf } from './tree'

const sample = { name: 'x', list: [1, 'a', null, true], obj: { deep: { v: 1 } }, empty: [] }

describe('JSON 树模型', () => {
  it('类型判断', () => {
    expect(['s', 1, true, null, [], {}].map(typeOf)).toEqual(['string', 'number', 'boolean', 'null', 'array', 'object'])
  })

  it('根节点默认展开第一层，子节点折叠', () => {
    const rows = flatten(createRoot(sample))
    expect(rows.map((r) => r.key)).toEqual([null, 'name', 'list', 'obj', 'empty'])
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 1, 1])
  })

  it('展开/折叠单个节点', () => {
    const root = createRoot(sample)
    const list = flatten(root)[2]
    toggle(list)
    expect(flatten(root).map((r) => r.key)).toEqual([null, 'name', 'list', 0, 1, 2, 3, 'obj', 'empty'])
    toggle(list)
    expect(flatten(root)).toHaveLength(5)
  })

  it('展开全部 / 折叠全部', () => {
    const root = createRoot(sample)
    const r = expandAll(root)
    expect(r.complete).toBe(true)
    expect(flatten(root)).toHaveLength(countNodes(sample))
    collapseAll(root)
    expect(flatten(root)).toHaveLength(5)
  })

  it('展开全部在节点过多时按层级截断', () => {
    const big = { a: Array.from({ length: 100 }, (_, i) => ({ i })), b: 1 }
    const root = createRoot(big)
    const r = expandAll(root, 50)
    expect(r.complete).toBe(false)
    expect(flatten(root).length).toBeLessThan(countNodes(big))
  })

  it('根为原始值或空容器', () => {
    expect(flatten(createRoot(5))).toHaveLength(1)
    expect(flatten(createRoot({}))).toHaveLength(1)
    toggle(createRoot(5))
  })

  it('深层嵌套与超大数组不会爆栈', () => {
    let v: unknown = 1
    for (let i = 0; i < 5000; i++) v = [v]
    const root = createRoot(v)
    expandAll(root)
    expect(flatten(root)).toHaveLength(5001)
    const wide = Array.from({ length: 300_000 }, (_, i) => i)
    expect(countNodes(wide)).toBe(300_001)
    const wideRoot = createRoot(wide)
    expect(flatten(wideRoot)).toHaveLength(300_001)
  })

  it('值预览与摘要', () => {
    const rows = flatten(createRoot({ s: 'a"b', n: 1.5, t: true, z: null, o: { a: 1 }, l: [1, 2], e: {}, ea: [] }))
    const by = Object.fromEntries(rows.slice(1).map((r) => [r.key, r]))
    expect(previewValue(by.s)).toBe('"a\\"b"')
    expect(previewValue(by.n)).toBe('1.5')
    expect(previewValue(by.t)).toBe('true')
    expect(previewValue(by.z)).toBe('null')
    expect(summaryOf(by.o)).toBe('{ 1 个键 }')
    expect(summaryOf(by.l)).toBe('[ 2 项 ]')
    expect(summaryOf(by.e)).toBe('{}')
    expect(summaryOf(by.ea)).toBe('[]')
  })

  it('超长字符串预览会被截断', () => {
    const rows = flatten(createRoot({ s: 'x'.repeat(1000) }))
    expect(previewValue(rows[1]).length).toBeLessThan(310)
  })
})
