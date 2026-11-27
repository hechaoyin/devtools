import { CryptoError } from './bytes'
import type { PaddingMode } from './types'

export const PADDING_LABELS: Record<PaddingMode, string> = {
  pkcs7: 'PKCS7',
  zero: 'ZeroPadding',
  none: 'NoPadding',
}

export function pad(data: Uint8Array, blockSize: number, mode: PaddingMode): Uint8Array {
  if (mode === 'none') {
    if (data.length % blockSize !== 0) {
      throw new CryptoError(`NoPadding 要求数据长度为 ${blockSize} 字节的整数倍，当前 ${data.length} 字节`)
    }
    return data
  }
  if (mode === 'zero') {
    const n = data.length % blockSize === 0 ? 0 : blockSize - (data.length % blockSize)
    const out = new Uint8Array(data.length + n)
    out.set(data)
    return out
  }
  const n = blockSize - (data.length % blockSize)
  const out = new Uint8Array(data.length + n)
  out.set(data)
  out.fill(n, data.length)
  return out
}

export function unpad(data: Uint8Array, blockSize: number, mode: PaddingMode): Uint8Array {
  if (mode === 'none') return data
  if (mode === 'zero') {
    let end = data.length
    while (end > 0 && data[end - 1] === 0) end--
    return data.subarray(0, end)
  }
  const n = data[data.length - 1]
  const valid = data.length > 0 && n >= 1 && n <= blockSize && n <= data.length && data.subarray(data.length - n).every((b) => b === n)
  if (!valid) throw new CryptoError('PKCS7 去填充失败：密钥、IV、模式、填充方式或密文可能不正确')
  return data.subarray(0, data.length - n)
}
