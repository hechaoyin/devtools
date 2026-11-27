export type Base64Result = { ok: true; value: string } | { ok: false; error: string }

function bytesToBinary(bytes: Uint8Array): string {
  let out = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return out
}

/** UTF-8 安全的 Base64 编码；urlSafe 使用 -_ 且去除填充 */
export function encodeBase64(text: string, options: { urlSafe?: boolean } = {}): string {
  const b64 = btoa(bytesToBinary(new TextEncoder().encode(text)))
  return options.urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64
}

/** 同时兼容标准与 URL-safe Base64，容忍缺失的填充与空白 */
export function decodeBase64(input: string): Base64Result {
  const cleaned = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return { ok: false, error: '包含非法的 Base64 字符' }
  const body = cleaned.replace(/=+$/, '')
  if (body.length % 4 === 1) return { ok: false, error: 'Base64 长度不合法' }
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { ok: false, error: '解码结果不是有效的 UTF-8 文本' }
  }
}
