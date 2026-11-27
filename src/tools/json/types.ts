export interface JsonError {
  message: string
  line?: number
  column?: number
  position?: number
}

export type JsonResult = { ok: true; value: string } | { ok: false; error: JsonError }

export interface JsonValidation {
  valid: boolean
  error?: JsonError
}

export type IndentOption = number | 'tab'

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

/** 容错格式化结果：good 为错误位置之前已格式化的内容，bad 为错误位置及其后的原始字符 */
export interface LenientFormat {
  good: string
  bad: string
  error: JsonError | null
}
