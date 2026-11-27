import type { JsonError, JsonResult, JsonValidation } from './types'

export type { JsonError, JsonResult, JsonValidation } from './types'

export function offsetToLineColumn(text: string, position: number) {
  const before = text.slice(0, Math.max(0, Math.min(position, text.length)))
  const lines = before.split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

/** 兼容不同 JS 引擎的 JSON.parse 报错信息，提取行列位置 */
export function parseJsonError(text: string, err: unknown): JsonError {
  const raw = err instanceof Error ? err.message : String(err)
  const result: JsonError = { message: raw }

  const lc = /line (\d+) column (\d+)/i.exec(raw)
  if (lc) {
    result.line = Number(lc[1])
    result.column = Number(lc[2])
    return result
  }
  const pos = /position (\d+)/i.exec(raw)
  if (pos) {
    result.position = Number(pos[1])
    Object.assign(result, offsetToLineColumn(text, result.position))
    return result
  }
  if (/end of (json )?(input|data)|unexpected end/i.test(raw)) {
    result.position = text.length
    Object.assign(result, offsetToLineColumn(text, text.length))
  }
  return result
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) out[key] = sortKeys((value as Record<string, unknown>)[key])
    return out
  }
  return value
}

export function validateJson(text: string): JsonValidation {
  if (!text.trim()) return { valid: false, error: { message: '输入为空' } }
  try {
    JSON.parse(text)
    return { valid: true }
  } catch (err) {
    return { valid: false, error: parseJsonError(text, err) }
  }
}

export interface FormatOptions {
  indent?: number | 'tab'
  sortKeys?: boolean
}

export function formatJson(text: string, options: FormatOptions = {}): JsonResult {
  if (!text.trim()) return { ok: false, error: { message: '输入为空' } }
  try {
    let value: unknown = JSON.parse(text)
    if (options.sortKeys) value = sortKeys(value)
    const space = options.indent === 'tab' ? '\t' : (options.indent ?? 2)
    return { ok: true, value: JSON.stringify(value, null, space) }
  } catch (err) {
    return { ok: false, error: parseJsonError(text, err) }
  }
}

export function minifyJson(text: string): JsonResult {
  if (!text.trim()) return { ok: false, error: { message: '输入为空' } }
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(text)) }
  } catch (err) {
    return { ok: false, error: parseJsonError(text, err) }
  }
}

/** 将任意文本转义为 JSON 字符串内容（不含外层引号），常用于把 JSON 嵌入字符串 */
export function escapeJsonString(text: string): string {
  return JSON.stringify(text).slice(1, -1)
}

/** 反转义：支持带或不带外层引号的 JSON 字符串内容 */
export function unescapeJsonString(text: string): JsonResult {
  const trimmed = text.trim()
  const quoted = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${text}"`
  try {
    const value = JSON.parse(quoted)
    if (typeof value !== 'string') return { ok: false, error: { message: '不是有效的 JSON 字符串' } }
    return { ok: true, value }
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } }
  }
}
