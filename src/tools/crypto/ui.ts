import { CryptoError } from './bytes'
import type { DataEncoding } from './types'

export function errorMessage(e: unknown): string {
  if (e instanceof CryptoError) return e.message
  return `运算失败：${e instanceof Error ? e.message : String(e)}`
}

export interface PanelResult {
  value: string
  error: string
  /** 非错误的提示（如等待输入） */
  hint: string
  /** 验签结果：true 通过 / false 未通过 / undefined 不适用 */
  verdict?: boolean
}

export const emptyResult = (hint = ''): PanelResult => ({ value: '', error: '', hint })

export function guard(fn: () => Omit<PanelResult, 'error' | 'hint'> & Partial<PanelResult>): PanelResult {
  try {
    return { error: '', hint: '', ...fn() }
  } catch (e) {
    return { value: '', error: errorMessage(e), hint: '' }
  }
}

export const BINARY_ENCODINGS: DataEncoding[] = ['hex', 'base64']
