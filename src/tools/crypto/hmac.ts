import CryptoJS from 'crypto-js'
import { HASH_ALGORITHMS, type HashAlgorithm } from '../hash/logic'
import { hexToBytes } from './bytes'
import { toWords } from './cryptojs'
import { sm3Hmac } from './sm'

/** 复用哈希工具已有的摘要算法清单，另外追加国密 SM3 */
export const HMAC_ALGORITHMS = [...HASH_ALGORITHMS, 'SM3'] as const
export type HmacAlgorithm = HashAlgorithm | 'SM3'

const HMAC_FUNCS: Record<HashAlgorithm, (message: CryptoJS.lib.WordArray, key: CryptoJS.lib.WordArray) => CryptoJS.lib.WordArray> = {
  MD5: CryptoJS.HmacMD5,
  'SHA-1': CryptoJS.HmacSHA1,
  'SHA-224': CryptoJS.HmacSHA224,
  'SHA-256': CryptoJS.HmacSHA256,
  'SHA-384': CryptoJS.HmacSHA384,
  'SHA-512': CryptoJS.HmacSHA512,
}

/** 计算 HMAC，返回小写 Hex；密钥与消息均为原始字节 */
export function hmacHex(algorithm: HmacAlgorithm, message: Uint8Array, key: Uint8Array): string {
  if (algorithm === 'SM3') return sm3Hmac(message, key)
  return CryptoJS.enc.Hex.stringify(HMAC_FUNCS[algorithm](toWords(message), toWords(key)))
}

export function hmacBytes(algorithm: HmacAlgorithm, message: Uint8Array, key: Uint8Array): Uint8Array {
  return hexToBytes(hmacHex(algorithm, message, key))
}
