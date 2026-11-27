import CryptoJS from 'crypto-js'
import forge from 'node-forge'
import { fromWords, toWords } from './cryptojs'
import { binaryToBytes, bytesToBinary, CryptoError, decodeData, encodeData } from './bytes'
import { pad, unpad } from './padding'
import { sm4Block, sm4Ctr, sm4GcmDecrypt, sm4GcmEncrypt } from './sm'
import type { CipherMode, SymmetricAlgorithm, SymmetricInfo, SymmetricParams, SymmetricTextParams } from './types'

const BLOCK_MODES: CipherMode[] = ['ECB', 'CBC', 'CTR', 'CFB', 'OFB']

export const SYMMETRIC_ALGORITHMS: Record<SymmetricAlgorithm, SymmetricInfo> = {
  'AES-128': { label: 'AES-128', blockSize: 16, keySizes: [16], modes: [...BLOCK_MODES, 'GCM'] },
  'AES-192': { label: 'AES-192', blockSize: 16, keySizes: [24], modes: [...BLOCK_MODES, 'GCM'] },
  'AES-256': { label: 'AES-256', blockSize: 16, keySizes: [32], modes: [...BLOCK_MODES, 'GCM'] },
  DES: { label: 'DES', blockSize: 8, keySizes: [8], modes: BLOCK_MODES },
  '3DES': { label: '3DES', blockSize: 8, keySizes: [16, 24], modes: BLOCK_MODES },
  RC4: { label: 'RC4', blockSize: 0, keySizes: [], modes: [] },
  SM4: { label: 'SM4', blockSize: 16, keySizes: [16], modes: ['ECB', 'CBC', 'CTR', 'GCM'] },
}

/** 需要 IV 的模式（GCM 的 IV 长度不固定，单独处理） */
export const modeNeedsIv = (mode: CipherMode) => mode !== 'ECB'

/** 使用填充的模式 */
export const modeUsesPadding = (mode: CipherMode) => mode === 'ECB' || mode === 'CBC'

export const GCM_TAG_BYTES = 16

const sizesText = (sizes: number[]) => sizes.join(' 或 ')

export function validateKey(algorithm: SymmetricAlgorithm, key: Uint8Array): void {
  const info = SYMMETRIC_ALGORITHMS[algorithm]
  if (key.length === 0) throw new CryptoError('请填写密钥')
  if (algorithm === 'RC4') {
    if (key.length > 256) throw new CryptoError(`RC4 密钥最长 256 字节，当前 ${key.length} 字节`)
    return
  }
  if (!info.keySizes.includes(key.length)) {
    throw new CryptoError(`${info.label} 密钥必须为 ${sizesText(info.keySizes)} 字节，当前 ${key.length} 字节`)
  }
}

function validateIv(algorithm: SymmetricAlgorithm, mode: CipherMode, iv: Uint8Array | undefined): Uint8Array {
  const info = SYMMETRIC_ALGORITHMS[algorithm]
  if (mode === 'GCM') {
    if (!iv || iv.length === 0) throw new CryptoError(`${info.label}-GCM 需要 IV（Nonce），推荐 12 字节`)
    return iv
  }
  if (!iv || iv.length !== info.blockSize) {
    throw new CryptoError(`${info.label}-${mode} 的 IV 必须为 ${info.blockSize} 字节，当前 ${iv?.length ?? 0} 字节`)
  }
  return iv
}

const CJS_CIPHERS = {
  AES: CryptoJS.AES,
  DES: CryptoJS.DES,
  '3DES': CryptoJS.TripleDES,
} as const

const CJS_MODES = {
  ECB: CryptoJS.mode.ECB,
  CBC: CryptoJS.mode.CBC,
  CTR: CryptoJS.mode.CTR,
  CFB: CryptoJS.mode.CFB,
  OFB: CryptoJS.mode.OFB,
} as const

function cryptoJsRun(
  cipher: typeof CryptoJS.AES,
  mode: Exclude<CipherMode, 'GCM'>,
  encrypt: boolean,
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array | undefined,
): Uint8Array {
  const cfg = { mode: CJS_MODES[mode], padding: CryptoJS.pad.NoPadding, iv: iv ? toWords(iv) : undefined }
  if (data.length === 0) return new Uint8Array(0)
  if (encrypt) return fromWords(cipher.encrypt(toWords(data), toWords(key), cfg).ciphertext)
  const params = CryptoJS.lib.CipherParams.create({ ciphertext: toWords(data) })
  return fromWords(cipher.decrypt(params, toWords(key), cfg))
}

function forgeGcm(encrypt: boolean, data: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: Uint8Array): Uint8Array {
  const keyBin = bytesToBinary(key)
  const opts: Record<string, unknown> = { iv: bytesToBinary(iv), additionalData: bytesToBinary(aad), tagLength: GCM_TAG_BYTES * 8 }
  if (encrypt) {
    const cipher = forge.cipher.createCipher('AES-GCM', keyBin)
    cipher.start(opts)
    cipher.update(forge.util.createBuffer(bytesToBinary(data)))
    cipher.finish()
    const tag = (cipher.mode as unknown as { tag: forge.util.ByteStringBuffer }).tag
    return binaryToBytes(cipher.output.getBytes() + tag.getBytes())
  }
  if (data.length < GCM_TAG_BYTES) throw new CryptoError('AES-GCM 密文须为 密文||tag，至少 16 字节（tag）')
  const ct = data.subarray(0, data.length - GCM_TAG_BYTES)
  const tag = data.subarray(data.length - GCM_TAG_BYTES)
  const decipher = forge.cipher.createDecipher('AES-GCM', keyBin)
  decipher.start({ ...opts, tag: forge.util.createBuffer(bytesToBinary(tag)) })
  decipher.update(forge.util.createBuffer(bytesToBinary(ct)))
  if (!decipher.finish()) throw new CryptoError('AES-GCM 认证失败：密钥、IV、附加数据或密文（含 tag）不正确')
  return binaryToBytes(decipher.output.getBytes())
}

/** 对字节数据执行对称加解密。GCM 的密文格式为 密文||tag(16 字节) */
export function symmetricCrypt(p: SymmetricParams): Uint8Array {
  const { algorithm, mode, direction, data } = p
  const info = SYMMETRIC_ALGORITHMS[algorithm]
  const encrypt = direction === 'encrypt'
  validateKey(algorithm, p.key)

  if (algorithm === 'RC4') {
    // 加解密同为异或密钥流
    if (data.length === 0) return data
    const out = CryptoJS.RC4.encrypt(toWords(data), toWords(p.key)).ciphertext
    return fromWords(out)
  }

  if (!info.modes.includes(mode)) throw new CryptoError(`${info.label} 不支持 ${mode} 模式`)
  const iv = modeNeedsIv(mode) ? validateIv(algorithm, mode, p.iv) : undefined

  if (mode === 'GCM') {
    const aad = p.aad ?? new Uint8Array(0)
    if (algorithm === 'SM4') return encrypt ? sm4GcmEncrypt(data, p.key, iv!, aad) : sm4GcmDecrypt(data, p.key, iv!, aad)
    return forgeGcm(encrypt, data, p.key, iv!, aad)
  }

  const usesPadding = modeUsesPadding(mode)
  if (!encrypt && usesPadding && data.length % info.blockSize !== 0) {
    throw new CryptoError(`${info.label}-${mode} 密文长度必须为 ${info.blockSize} 字节整数倍，当前 ${data.length} 字节`)
  }
  if (!encrypt && data.length === 0) throw new CryptoError('密文为空')
  const input = encrypt && usesPadding ? pad(data, info.blockSize, p.padding) : data

  let out: Uint8Array
  if (algorithm === 'SM4') {
    if (mode === 'CTR') out = sm4Ctr(input, p.key, iv!)
    else out = sm4Block(mode === 'CBC' ? 'cbc' : 'ecb', encrypt, input, p.key, iv)
  } else {
    const cipher = algorithm === 'DES' ? CJS_CIPHERS.DES : algorithm === '3DES' ? CJS_CIPHERS['3DES'] : CJS_CIPHERS.AES
    // crypto-js 的 3DES 只接受 24 字节密钥；16 字节（双密钥）按 K1||K2||K1 展开
    let key = p.key
    if (algorithm === '3DES' && key.length === 16) {
      key = new Uint8Array(24)
      key.set(p.key)
      key.set(p.key.subarray(0, 8), 16)
    }
    out = cryptoJsRun(cipher, mode, encrypt, input, key, iv)
  }
  return !encrypt && usesPadding ? unpad(out, info.blockSize, p.padding) : out
}

/** 面向界面：入参均为文本（含编码），返回按输出编码处理的结果文本 */
export function runSymmetric(t: SymmetricTextParams): string {
  const key = decodeData(t.key, t.keyEncoding, '密钥')
  const needsIv = t.algorithm !== 'RC4' && modeNeedsIv(t.mode)
  const iv = needsIv ? decodeData(t.iv, t.ivEncoding, 'IV') : undefined
  const aad = t.algorithm !== 'RC4' && t.mode === 'GCM' ? decodeData(t.aad, t.aadEncoding, '附加数据') : undefined
  const data = decodeData(t.input, t.inputEncoding, t.direction === 'encrypt' ? '明文' : '密文')
  const out = symmetricCrypt({
    algorithm: t.algorithm,
    mode: t.mode,
    padding: t.padding,
    direction: t.direction,
    key,
    iv,
    aad,
    data,
  })
  return encodeData(out, t.outputEncoding)
}
