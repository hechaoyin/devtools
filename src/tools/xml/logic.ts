import xmlFormat from 'xml-formatter'
import { checkWellFormed } from './wellformed'

export type XmlResult = { ok: true; value: string } | { ok: false; error: string }

function run(text: string, options: Parameters<typeof xmlFormat>[1]): XmlResult {
  if (!text.trim()) return { ok: false, error: '输入为空' }
  const syntax = checkWellFormed(text)
  if (syntax) return { ok: false, error: `第 ${syntax.line} 行第 ${syntax.column} 列：${syntax.message}` }
  try {
    return { ok: true, value: xmlFormat(text, { throwOnFailure: true, ...options }) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function formatXml(text: string, indent: number | 'tab' = 2): XmlResult {
  return run(text, {
    indentation: indent === 'tab' ? '\t' : ' '.repeat(indent),
    collapseContent: true,
    lineSeparator: '\n',
  })
}

/** 压缩：去除标签之间的空白与换行（保留文本节点内容） */
export function minifyXml(text: string): XmlResult {
  return run(text, { indentation: '', lineSeparator: '', collapseContent: true })
}

export function validateXml(text: string): { valid: boolean; error?: string } {
  const r = run(text, {})
  return r.ok ? { valid: true } : { valid: false, error: r.error }
}
