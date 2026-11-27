import { offsetToLineColumn } from './logic'
import type { IndentOption, LenientFormat } from './types'

type Expect = 'value' | 'valueOrEnd' | 'keyOrEnd' | 'key' | 'colon' | 'commaOrEnd' | 'done'

const ESCAPES = '"\\/bfnrt'
const isWs = (c: number) => c === 32 || c === 9 || c === 10 || c === 13
const isDigit = (c: number) => c >= 48 && c <= 57
const isHex = (c: number) => isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)

const describeChar = (ch: string) => (ch === '\n' || ch === '\r' ? '换行' : `"${ch}"`)

/**
 * 容错格式化：逐字符扫描并按缩进输出，遇到第一处语法错误即停止。
 * good 为错误位置之前已格式化的内容；bad 为错误位置及其后的原始字符；无错误时 bad 为空。
 * 采用迭代状态机而非递归，深层嵌套与超大输入也不会爆栈。
 */
export function formatLenient(text: string, indent: IndentOption = 2): LenientFormat {
  if (!text.trim()) return { good: '', bad: '', error: { message: '输入为空' } }

  const unit = indent === 'tab' ? '\t' : ' '.repeat(Math.max(0, indent))
  const pretty = unit !== ''
  const out: string[] = []
  const stack: Array<'{' | '['> = []
  const n = text.length
  let expect = 'value' as Expect
  let last = ''
  let i = 0

  const nl = () => (pretty ? '\n' + unit.repeat(stack.length) : '')

  const fail = (pos: number, message: string): LenientFormat => {
    if (pos < n && (expect === 'commaOrEnd' || expect === 'colon')) out.push(' ')
    if (pos < n && expect === 'done') out.push('\n')
    return {
      good: out.join(''),
      bad: text.slice(pos),
      error: { message, position: pos, ...offsetToLineColumn(text, pos) },
    }
  }

  const unexpected = (pos: number, hint: string) => {
    const ch = text[pos]
    if (ch === "'") return fail(pos, '字符串必须使用双引号 "，不能使用单引号')
    return fail(pos, `意外的字符 ${describeChar(ch)}：${hint}`)
  }

  const afterValue = () => {
    expect = stack.length ? 'commaOrEnd' : 'done'
  }

  /** 返回 null 表示字符串合法，end 为结束下标；否则返回出错位置与原因 */
  const scanString = (start: number): { end: number } | { pos: number; message: string } => {
    let j = start + 1
    while (j < n) {
      const c = text.charCodeAt(j)
      if (c === 34) return { end: j + 1 }
      if (c === 92) {
        const e = text[j + 1]
        if (e === undefined) return { pos: n, message: '字符串未结束，缺少结尾的双引号' }
        if (ESCAPES.includes(e)) {
          j += 2
        } else if (e === 'u') {
          for (let k = 0; k < 4; k++) {
            const at = j + 2 + k
            if (at >= n) return { pos: n, message: '字符串未结束，缺少结尾的双引号' }
            if (!isHex(text.charCodeAt(at))) return { pos: at, message: '无效的 Unicode 转义，\\u 后需要 4 位十六进制数' }
          }
          j += 6
        } else {
          return { pos: j, message: `无效的转义序列 "\\${e}"` }
        }
        continue
      }
      if (c < 0x20) return { pos: j, message: '字符串中含有未转义的控制字符（如换行），请使用 \\n 等转义' }
      j++
    }
    return { pos: n, message: '字符串未结束，缺少结尾的双引号' }
  }

  const pushString = (): LenientFormat | null => {
    const r = scanString(i)
    if ('pos' in r) {
      out.push(text.slice(i, r.pos))
      return fail(r.pos, r.message)
    }
    out.push(text.slice(i, r.end))
    i = r.end
    return null
  }

  const pushNumber = (): LenientFormat | null => {
    let j = i
    const bad = (message: string) => {
      out.push(text.slice(i, j))
      return fail(j, j >= n ? '数字不完整，输入意外结束' : message)
    }
    if (text[j] === '-') j++
    if (text[j] === '0') j++
    else if (j < n && text.charCodeAt(j) >= 49 && text.charCodeAt(j) <= 57) {
      while (j < n && isDigit(text.charCodeAt(j))) j++
    } else return bad('"-" 之后需要数字')
    if (text[j] === '.') {
      j++
      if (!(j < n && isDigit(text.charCodeAt(j)))) return bad('小数点之后需要数字')
      while (j < n && isDigit(text.charCodeAt(j))) j++
    }
    if (text[j] === 'e' || text[j] === 'E') {
      j++
      if (text[j] === '+' || text[j] === '-') j++
      if (!(j < n && isDigit(text.charCodeAt(j)))) return bad('指数部分需要数字')
      while (j < n && isDigit(text.charCodeAt(j))) j++
    }
    out.push(text.slice(i, j))
    i = j
    return null
  }

  const pushLiteral = (word: string): LenientFormat | null => {
    for (let k = 0; k < word.length; k++) {
      if (text[i + k] !== word[k]) {
        out.push(text.slice(i, i + k))
        return i + k >= n ? fail(n, `值不完整，期望 ${word}`) : fail(i + k, `无效的值，期望 ${word}`)
      }
    }
    out.push(word)
    i += word.length
    return null
  }

  const close = (ch: string, wasEmpty: boolean) => {
    stack.pop()
    out.push(wasEmpty ? ch : nl() + ch)
    i++
    last = ch
    afterValue()
  }

  while (i < n) {
    const c = text.charCodeAt(i)
    if (isWs(c)) {
      i++
      continue
    }
    const ch = text[i]
    let r: LenientFormat | null = null

    switch (expect) {
      case 'done':
        return fail(i, `JSON 已结束，之后不应再有内容（意外的 ${describeChar(ch)}）`)

      case 'keyOrEnd':
      case 'key': {
        if (expect === 'keyOrEnd') {
          if (ch === '}') {
            close(ch, true)
            continue
          }
          out.push(nl())
        }
        if (ch !== '"') {
          if (ch === '}' && last === ',') return fail(i, '对象末尾不允许多余的逗号')
          return unexpected(i, '期望属性名（用双引号包裹的字符串）')
        }
        r = pushString()
        if (r) return r
        expect = 'colon'
        last = '"'
        continue
      }

      case 'colon':
        if (ch !== ':') return unexpected(i, '属性名之后期望冒号 ":"')
        out.push(pretty ? ': ' : ':')
        i++
        last = ':'
        expect = 'value'
        continue

      case 'commaOrEnd': {
        const top = stack[stack.length - 1]
        if (ch === ',') {
          out.push(',', nl())
          i++
          last = ','
          expect = top === '{' ? 'key' : 'value'
        } else if ((ch === '}' && top === '{') || (ch === ']' && top === '[')) {
          close(ch, false)
        } else {
          return unexpected(i, top === '{' ? '期望逗号 "," 或 "}"' : '期望逗号 "," 或 "]"')
        }
        continue
      }

      default: {
        if (expect === 'valueOrEnd') {
          if (ch === ']') {
            close(ch, true)
            continue
          }
          out.push(nl())
        }
        if (ch === '{' || ch === '[') {
          out.push(ch)
          stack.push(ch)
          i++
          last = ch
          expect = ch === '{' ? 'keyOrEnd' : 'valueOrEnd'
          continue
        }
        if (ch === '"') r = pushString()
        else if (ch === '-' || isDigit(c)) r = pushNumber()
        else if (ch === 't') r = pushLiteral('true')
        else if (ch === 'f') r = pushLiteral('false')
        else if (ch === 'n') r = pushLiteral('null')
        else if (ch === ']' && last === ',') return fail(i, '数组末尾不允许多余的逗号')
        else if ((ch === '}' || ch === ']') && last === ':') return fail(i, '属性名之后缺少值')
        else return unexpected(i, '期望一个值（对象、数组、字符串、数字、true、false 或 null）')
        if (r) return r
        last = 'v'
        afterValue()
      }
    }
  }

  if (expect !== 'done') {
    const top = stack[stack.length - 1]
    const message = top ? `输入意外结束，缺少与 "${top}" 匹配的 "${top === '{' ? '}' : ']'}"` : '输入意外结束，缺少 JSON 值'
    return fail(n, message)
  }
  return { good: out.join(''), bad: '', error: null }
}
