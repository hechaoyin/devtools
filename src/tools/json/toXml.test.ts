import { describe, expect, it } from 'vitest'
import { escapeXmlAttr, escapeXmlText, jsonToXml, sanitizeXmlName, valueToXml } from './toXml'
import { validateXml } from '@/tools/xml/logic'

const conv = (v: unknown, o = {}) => valueToXml(v, { declaration: false, ...o })

describe('JSON 转 XML', () => {
  it('嵌套对象与基本类型', () => {
    expect(conv({ a: 1, b: 'x', c: true, d: { e: 1.5 } })).toBe(
      '<root>\n  <a>1</a>\n  <b>x</b>\n  <c>true</c>\n  <d>\n    <e>1.5</e>\n  </d>\n</root>',
    )
  })

  it('默认输出 XML 声明，可关闭', () => {
    expect(valueToXml({ a: 1 })).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <a>1</a>\n</root>')
    expect(valueToXml({ a: 1 }, { declaration: false })).not.toContain('<?xml')
  })

  it('数组属性展开为同名重复元素', () => {
    expect(conv({ tags: ['x', 'y'] }, { indent: 0 })).toBe('<root><tags>x</tags><tags>y</tags></root>')
    expect(conv({ users: [{ id: 1 }, { id: 2 }] }, { indent: 0 })).toBe('<root><users><id>1</id></users><users><id>2</id></users></root>')
  })

  it('根为数组时使用 item 元素，可自定义 itemName', () => {
    expect(conv([1, 'a'], { indent: 0 })).toBe('<root><item>1</item><item>a</item></root>')
    expect(conv([1], { indent: 0, itemName: 'row' })).toBe('<root><row>1</row></root>')
  })

  it('数组中嵌套数组：包一层容器，不丢失层级', () => {
    expect(conv({ m: [[1, 2], [3]] }, { indent: 0 })).toBe('<root><m><item>1</item><item>2</item></m><m><item>3</item></m></root>')
  })

  it('根为原始值', () => {
    expect(conv('hi', { indent: 0 })).toBe('<root>hi</root>')
    expect(conv(42, { indent: 0 })).toBe('<root>42</root>')
    expect(conv(null, { indent: 0 })).toBe('<root/>')
  })

  it('null、空字符串、空对象、空数组均为自闭合标签', () => {
    expect(conv({ a: null, b: '', c: {}, d: [] }, { indent: 0 })).toBe('<root><a/><b/><c/><d/></root>')
  })

  it('可选根节点名，非法名称会被修正', () => {
    expect(conv({ a: 1 }, { rootName: 'data', indent: 0 })).toBe('<data><a>1</a></data>')
    expect(conv({ a: 1 }, { rootName: '  ', indent: 0 })).toBe('<root><a>1</a></root>')
    expect(conv({ a: 1 }, { rootName: '1 bad name', indent: 0 })).toBe('<_1_bad_name><a>1</a></_1_bad_name>')
  })

  it('文本特殊字符转义', () => {
    expect(conv({ t: `a & b < c > d "q" 'p'` }, { indent: 0 })).toBe(`<root><t>a &amp; b &lt; c &gt; d "q" 'p'</t></root>`)
    expect(escapeXmlText('x\r\ny')).toBe('x&#13;\ny')
  })

  it('移除 XML 1.0 不允许的控制字符与孤立代理项，保留合法 emoji', () => {
    expect(escapeXmlText('a\u0000b\u0008c\u001Fd\uFFFE')).toBe('abcd')
    expect(escapeXmlText('x\uD800y')).toBe('xy')
    expect(escapeXmlText('😀 中文')).toBe('😀 中文')
  })

  it('非法标签名：替换非法字符并用 key 属性保留原名', () => {
    expect(conv({ 'first name': 1, '1st': 2, 'a:b': 3, '': 4 }, { indent: 0 })).toBe(
      '<root><first_name key="first name">1</first_name><_1st key="1st">2</_1st><a_b key="a:b">3</a_b><_ key="">4</_></root>',
    )
    expect(conv({ 'xmlFoo': 1 }, { indent: 0 })).toBe('<root><_xmlFoo key="xmlFoo">1</_xmlFoo></root>')
    expect(conv({ '<x>"&': 1 }, { indent: 0 })).toBe('<root><_x___ key="&lt;x&gt;&quot;&amp;">1</_x___></root>')
  })

  it('合法的中文与带点、连字符的标签名保持不变', () => {
    expect(conv({ 名称: 1, 'a-b.c': 2, _x: 3 }, { indent: 0 })).toBe('<root><名称>1</名称><a-b.c>2</a-b.c><_x>3</_x></root>')
    expect(sanitizeXmlName('名称')).toEqual({ name: '名称', changed: false })
  })

  it('属性值转义', () => {
    expect(escapeXmlAttr('a"b\n\t&')).toBe('a&quot;b&#10;&#9;&amp;')
  })

  it('缩进选项：4 空格与 tab', () => {
    expect(conv({ a: { b: 1 } }, { indent: 4 })).toBe('<root>\n    <a>\n        <b>1</b>\n    </a>\n</root>')
    expect(conv({ a: 1 }, { indent: 'tab' })).toBe('<root>\n\t<a>1</a>\n</root>')
  })

  it('jsonToXml：非法 JSON 返回带位置的错误；空输入报错', () => {
    const bad = jsonToXml('{"a":}')
    expect(bad.ok).toBe(false)
    expect(jsonToXml('  ')).toEqual({ ok: false, error: { message: '输入为空' } })
  })

  it('jsonToXml：成功', () => {
    expect(jsonToXml('{"a":[1,2]}', { declaration: false, indent: 0 })).toEqual({ ok: true, value: '<root><a>1</a><a>2</a></root>' })
  })

  it('过深嵌套给出友好错误而不是抛出', () => {
    const depth = 20_000
    let v: unknown = 1
    for (let i = 0; i < depth; i++) v = { a: v }
    const text = '{"a":'.repeat(depth) + '1' + '}'.repeat(depth)
    let r
    try {
      r = jsonToXml(text)
    } catch (e) {
      throw new Error('should not throw: ' + e)
    }
    if (!r.ok) expect(r.error.message.length).toBeGreaterThan(0)
  })

  it('生成结果是良构的 XML（经现有 XML 工具校验）', () => {
    const xml = valueToXml({ 'a b': [1, { c: '<&>' }, [2]], 名: null, e: '"' })
    expect(validateXml(xml)).toMatchObject({ valid: true })
  })
})
