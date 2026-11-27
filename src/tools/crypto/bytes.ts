import type { DataEncoding } from './types'

/** 面向用户的可读错误：message 可直接展示 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoError'
  }
}

export const ENCODING_LABELS: Record<DataEncoding, string> = {
  utf8: '文本 (UTF-8)',
  hex: 'Hex',
  base64: 'Base64',
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function hexToBytes(hex: string, label = '数据'): Uint8Array {
  let s = hex.replace(/\s+/g, '')
  if (/^0x/i.test(s)) s = s.slice(2)
  if (!/^[0-9a-fA-F]*$/.test(s)) throw new CryptoError(`${label}不是有效的 Hex：包含非十六进制字符`)
  if (s.length % 2 !== 0) throw new CryptoError(`${label}不是有效的 Hex：长度必须为偶数（当前 ${s.length} 位）`)
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}

/** 同时接受标准与 URL-safe Base64，容忍空白与缺失的 `=` */
export function base64ToBytes(text: string, label = '数据'): Uint8Array {
  let s = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new CryptoError(`${label}不是有效的 Base64：包含非法字符`)
  s = s.replace(/=+$/, '')
  if (s.length % 4 === 1) throw new CryptoError(`${label}不是有效的 Base64：长度不正确`)
  s += '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function decodeData(value: string, encoding: DataEncoding, label = '数据'): Uint8Array {
  if (encoding === 'hex') return hexToBytes(value, label)
  if (encoding === 'base64') return base64ToBytes(value, label)
  return new TextEncoder().encode(value)
}

export function encodeData(bytes: Uint8Array, encoding: DataEncoding): string {
  if (encoding === 'hex') return bytesToHex(bytes)
  if (encoding === 'base64') return bytesToBase64(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new CryptoError('结果不是有效的 UTF-8 文本：请将输出编码改为 Hex 或 Base64（密钥/IV/模式错误也会导致此情况）')
  }
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  crypto.getRandomValues(out)
  return out
}

/** Uint8Array ↔ 二进制字符串（供 node-forge 使用） */
export function bytesToBinary(bytes: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return s
}

export function binaryToBytes(bin: string): Uint8Array {
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff
  return out
}
