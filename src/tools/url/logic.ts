export type UrlMode = 'component' | 'full'
export type UrlResult = { ok: true; value: string } | { ok: false; error: string }

export function encodeUrl(text: string, mode: UrlMode = 'component'): string {
  return mode === 'component' ? encodeURIComponent(text) : encodeURI(text)
}

export function decodeUrl(text: string, mode: UrlMode = 'component'): UrlResult {
  try {
    return { ok: true, value: mode === 'component' ? decodeURIComponent(text) : decodeURI(text) }
  } catch {
    return { ok: false, error: '包含非法的百分号编码序列' }
  }
}

export interface QueryParam {
  key: string
  value: string
}

/** 解析 URL 或查询字符串中的参数（保持顺序，保留重复键） */
export function parseQuery(input: string): QueryParam[] {
  const trimmed = input.trim()
  const q = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?') + 1) : trimmed
  const query = q.split('#')[0]
  if (!query || (!trimmed.includes('?') && !query.includes('='))) return []
  return query
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=')
      const rawKey = idx === -1 ? pair : pair.slice(0, idx)
      const rawValue = idx === -1 ? '' : pair.slice(idx + 1)
      return { key: safeDecode(rawKey), value: safeDecode(rawValue) }
    })
}

function safeDecode(s: string): string {
  const plus = s.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(plus)
  } catch {
    return plus
  }
}
