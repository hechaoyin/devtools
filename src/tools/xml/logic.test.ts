import { describe, expect, it } from 'vitest'
import { formatXml, minifyXml, validateXml } from './logic'

describe('xml logic', () => {
  it('格式化', () => {
    const r = formatXml('<root><a id="1">x</a><b><c/></b></root>')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('<root>\n  <a id="1">x</a>\n  <b>\n    <c/>\n  </b>\n</root>')
  })

  it('格式化：4 空格 / tab', () => {
    const four = formatXml('<r><a/></r>', 4)
    expect(four.ok && four.value).toBe('<r>\n    <a/>\n</r>')
    const tab = formatXml('<r><a/></r>', 'tab')
    expect(tab.ok && tab.value).toBe('<r>\n\t<a/>\n</r>')
  })

  it('压缩：去掉缩进与换行', () => {
    const r = minifyXml('<root>\n  <a id="1">x</a>\n  <b>\n    <c/>\n  </b>\n</root>')
    expect(r.ok && r.value).toBe('<root><a id="1">x</a><b><c/></b></root>')
  })

  it('压缩保留文本节点内容', () => {
    const r = minifyXml('<p>hello world</p>')
    expect(r.ok && r.value).toBe('<p>hello world</p>')
  })

  it('非法 XML 报错', () => {
    expect(formatXml('<a><b></a>').ok).toBe(false)
    expect(validateXml('<a><b></a>').valid).toBe(false)
    expect(validateXml('<a><b/></a>').valid).toBe(true)
  })

  it('空输入', () => {
    expect(formatXml('').ok).toBe(false)
  })
})

describe('xml 良构性检查', () => {
  it('各类非法输入', () => {
    expect(validateXml('<a>').valid).toBe(false)
    expect(validateXml('</a>').valid).toBe(false)
    expect(validateXml('<a/><b/>').valid).toBe(false)
    expect(validateXml('<a x=1/>').valid).toBe(false)
    expect(validateXml('<a x="1" x="2"/>').valid).toBe(false)
    expect(validateXml('<a>1 & 2</a>').valid).toBe(false)
    expect(validateXml('text').valid).toBe(false)
    expect(validateXml('<a><!-- x </a>').valid).toBe(false)
  })

  it('合法输入：声明、注释、CDATA、实体、DOCTYPE', () => {
    const doc = '<?xml version="1.0"?>\n<!DOCTYPE a>\n<a x="1" y=\'2\'><!-- c --><![CDATA[<raw>]]>&amp;&#38;<b/></a>'
    expect(validateXml(doc).valid).toBe(true)
  })

  it('错误信息包含行列', () => {
    const r = validateXml('<a>\n  <b>\n</a>')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('第 3 行')
  })
})
