export interface XmlSyntaxError {
  message: string
  line: number
  column: number
}

function locate(text: string, index: number) {
  const lines = text.slice(0, index).split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

const NAME = '[A-Za-z_\\u00C0-\\uFFFF][\\w.\\-:\\u00B7\\u00C0-\\uFFFF]*'
const ATTR_RE = new RegExp(`\\s+${NAME}\\s*=\\s*(?:"[^"<]*"|'[^'<]*')`, 'y')
const OPEN_TAG_RE = new RegExp(`<(${NAME})`, 'y')
const CLOSE_TAG_RE = new RegExp(`</(${NAME})\\s*>`, 'y')

/** 轻量 XML 良构性检查：标签配对、属性引号、单一根节点、注释/CDATA/PI 闭合 */
export function checkWellFormed(text: string): XmlSyntaxError | null {
  const fail = (index: number, message: string): XmlSyntaxError => ({ message, ...locate(text, index) })
  const stack: { name: string; index: number }[] = []
  let i = 0
  let rootCount = 0

  while (i < text.length) {
    const lt = text.indexOf('<', i)
    const chunkEnd = lt === -1 ? text.length : lt
    const chunk = text.slice(i, chunkEnd)
    if (stack.length === 0 && chunk.trim()) {
      return fail(i + chunk.search(/\S/), '根节点之外不允许出现文本')
    }
    if (/&(?!(?:[A-Za-z]+|#\d+|#x[0-9a-fA-F]+);)/.test(chunk)) {
      return fail(i + chunk.search(/&/), '存在未转义的 & 字符')
    }
    if (lt === -1) break
    i = lt

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4)
      if (end === -1) return fail(i, '注释未闭合')
      i = end + 3
    } else if (text.startsWith('<![CDATA[', i)) {
      const end = text.indexOf(']]>', i)
      if (end === -1) return fail(i, 'CDATA 未闭合')
      if (stack.length === 0) return fail(i, 'CDATA 必须位于根节点内')
      i = end + 3
    } else if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i)
      if (end === -1) return fail(i, '处理指令未闭合')
      i = end + 2
    } else if (text.startsWith('<!', i)) {
      let depth = 0
      let j = i
      for (; j < text.length; j++) {
        if (text[j] === '<') depth++
        else if (text[j] === '>' && --depth === 0) break
      }
      if (j >= text.length) return fail(i, 'DOCTYPE 未闭合')
      i = j + 1
    } else if (text.startsWith('</', i)) {
      CLOSE_TAG_RE.lastIndex = i
      const m = CLOSE_TAG_RE.exec(text)
      if (!m) return fail(i, '非法的结束标签')
      const top = stack.pop()
      if (!top) return fail(i, `多余的结束标签 </${m[1]}>`)
      if (top.name !== m[1]) return fail(i, `结束标签 </${m[1]}> 与开始标签 <${top.name}> 不匹配`)
      i += m[0].length
    } else {
      OPEN_TAG_RE.lastIndex = i
      const m = OPEN_TAG_RE.exec(text)
      if (!m) return fail(i, '非法的标签')
      const name = m[1]
      let j = i + m[0].length
      const seen = new Set<string>()
      for (;;) {
        ATTR_RE.lastIndex = j
        const a = ATTR_RE.exec(text)
        if (!a) break
        const attrName = a[0].trim().split(/\s*=/)[0]
        if (seen.has(attrName)) return fail(j, `属性 ${attrName} 重复`)
        seen.add(attrName)
        j += a[0].length
      }
      while (/\s/.test(text[j] ?? '')) j++
      const selfClosing = text.startsWith('/>', j)
      if ((selfClosing || text[j] === '>') && stack.length === 0 && ++rootCount > 1) {
        return fail(i, '只能有一个根节点')
      }
      if (selfClosing) {
        i = j + 2
      } else if (text[j] === '>') {
        stack.push({ name, index: i })
        i = j + 1
      } else {
        return fail(j, `标签 <${name}> 的属性格式有误（属性值需用引号包裹）`)
      }
    }
  }

  if (stack.length) {
    const top = stack[stack.length - 1]
    return fail(top.index, `标签 <${top.name}> 未闭合`)
  }
  if (rootCount === 0) return fail(0, '没有找到根节点')
  return null
}
