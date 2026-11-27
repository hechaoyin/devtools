import { parseJsonError } from './logic'
import type { IndentOption, JsonResult } from './types'

export const DEFAULT_ROOT_NAME = 'root'
export const DEFAULT_ITEM_NAME = 'item'

export interface XmlOptions {
  /** 根节点名称，非法时自动修正，缺省为 root */
  rootName?: string
  /** 数组嵌套数组、或根为数组时，数组元素使用的标签名 */
  itemName?: string
  indent?: IndentOption
  /** 是否输出 <?xml ...?> 声明，默认 true */
  declaration?: boolean
}

// XML 1.0 NameStartChar / NameChar（不含冒号：避免命名空间前缀问题）
const START_CLASS = String.raw`A-Za-z_\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}`
const NAME_START = new RegExp(`[${START_CLASS}]`, 'u')
const NAME_CHAR = new RegExp(String.raw`[${START_CLASS}\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]`, 'u')

// 控制字符与孤立代理项在 XML 1.0 中非法，直接移除
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function escapeXmlText(s: string): string {
  return s
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;')
}

export function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')
}

/** 把任意字符串修正为合法的 XML 标签名；changed 表示发生了修改 */
export function sanitizeXmlName(name: string, fallback = '_'): { name: string; changed: boolean } {
  let out = ''
  for (const ch of name) out += NAME_CHAR.test(ch) ? ch : '_'
  if (!out) out = fallback
  if (!NAME_START.test(String.fromCodePoint(out.codePointAt(0)!))) out = '_' + out
  if (/^xml/i.test(out)) out = '_' + out
  return { name: out, changed: out !== name }
}

/** 将已解析的 JSON 值转换为 XML 文本 */
export function valueToXml(value: unknown, options: XmlOptions = {}): string {
  const unit = options.indent === 'tab' ? '\t' : ' '.repeat(Math.max(0, options.indent ?? 2))
  const rootName = sanitizeXmlName(options.rootName?.trim() || DEFAULT_ROOT_NAME).name
  const itemName = sanitizeXmlName(options.itemName?.trim() || DEFAULT_ITEM_NAME).name
  const out: string[] = []
  const pad = (depth: number) => (unit ? '\n' + unit.repeat(depth) : '')

  /** 输出恰好一个元素 */
  function single(rawName: string, v: unknown, depth: number) {
    const { name, changed } = sanitizeXmlName(rawName)
    const open = changed ? `${name} key="${escapeXmlAttr(rawName)}"` : name

    if (v === null || v === '' || (Array.isArray(v) && !v.length)) {
      out.push(`<${open}/>`)
      return
    }
    if (Array.isArray(v)) {
      out.push(`<${open}>`)
      for (const item of v) {
        out.push(pad(depth + 1))
        single(itemName, item, depth + 1)
      }
      out.push(pad(depth), `</${name}>`)
      return
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v)
      if (!keys.length) {
        out.push(`<${open}/>`)
        return
      }
      out.push(`<${open}>`)
      for (const key of keys) {
        const child = (v as Record<string, unknown>)[key]
        // 数组属性展开为同名的重复元素；空数组由 single 输出为自闭合标签
        for (const entry of Array.isArray(child) && child.length ? child : [child]) {
          out.push(pad(depth + 1))
          single(key, entry, depth + 1)
        }
      }
      out.push(pad(depth), `</${name}>`)
      return
    }
    out.push(`<${open}>${escapeXmlText(String(v))}</${name}>`)
  }

  if (options.declaration ?? true) out.push('<?xml version="1.0" encoding="UTF-8"?>', unit ? '\n' : '')
  single(rootName, value, 0)
  return out.join('')
}

export function jsonToXml(text: string, options: XmlOptions = {}): JsonResult {
  if (!text.trim()) return { ok: false, error: { message: '输入为空' } }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (err) {
    return { ok: false, error: parseJsonError(text, err) }
  }
  try {
    return { ok: true, value: valueToXml(value, options) }
  } catch (err) {
    if (err instanceof RangeError) return { ok: false, error: { message: 'JSON 嵌套层级过深，无法转换为 XML' } }
    throw err
  }
}
