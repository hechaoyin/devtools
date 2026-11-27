import CryptoJS from 'crypto-js'

export const HASH_ALGORITHMS = ['MD5', 'SHA-1', 'SHA-224', 'SHA-256', 'SHA-384', 'SHA-512'] as const
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number]

type Digest = (message: string) => CryptoJS.lib.WordArray
type Hmac = (message: string, key: string) => CryptoJS.lib.WordArray

const DIGESTS: Record<HashAlgorithm, [Digest, Hmac]> = {
  MD5: [CryptoJS.MD5, CryptoJS.HmacMD5],
  'SHA-1': [CryptoJS.SHA1, CryptoJS.HmacSHA1],
  'SHA-224': [CryptoJS.SHA224, CryptoJS.HmacSHA224],
  'SHA-256': [CryptoJS.SHA256, CryptoJS.HmacSHA256],
  'SHA-384': [CryptoJS.SHA384, CryptoJS.HmacSHA384],
  'SHA-512': [CryptoJS.SHA512, CryptoJS.HmacSHA512],
}

export type HashEncoding = 'hex' | 'base64'

function encode(words: CryptoJS.lib.WordArray, encoding: HashEncoding, upper: boolean): string {
  if (encoding === 'base64') return CryptoJS.enc.Base64.stringify(words)
  const hex = CryptoJS.enc.Hex.stringify(words)
  return upper ? hex.toUpperCase() : hex
}

/** 文本按 UTF-8 编码后计算摘要；传入 hmacKey 时计算 HMAC */
export function computeHash(
  algorithm: HashAlgorithm,
  text: string,
  options: { encoding?: HashEncoding; upper?: boolean; hmacKey?: string } = {},
): string {
  const [digest, hmac] = DIGESTS[algorithm]
  const words = options.hmacKey ? hmac(text, options.hmacKey) : digest(text)
  return encode(words, options.encoding ?? 'hex', options.upper ?? false)
}

export function computeAll(
  text: string,
  options: { encoding?: HashEncoding; upper?: boolean; hmacKey?: string } = {},
): Record<HashAlgorithm, string> {
  return Object.fromEntries(HASH_ALGORITHMS.map((a) => [a, computeHash(a, text, options)])) as Record<HashAlgorithm, string>
}
