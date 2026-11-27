import CryptoJS from 'crypto-js'

/** Uint8Array → crypto-js WordArray */
export function toWords(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = []
  for (let i = 0; i < bytes.length; i++) words[i >>> 2] = (words[i >>> 2] ?? 0) | (bytes[i] << (24 - (i % 4) * 8))
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

/** crypto-js WordArray → Uint8Array */
export function fromWords(wa: CryptoJS.lib.WordArray): Uint8Array {
  const out = new Uint8Array(wa.sigBytes)
  for (let i = 0; i < out.length; i++) out[i] = (wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  return out
}
