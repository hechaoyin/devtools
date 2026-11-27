import { sm2, sm3, sm4 } from 'sm-crypto-v2'
import { CryptoError } from './bytes'
import type { Sm2CipherOptions, Sm2SignOptions } from './types'

/** SM2 推荐曲线的阶 n */
const SM2_N = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123')

export const SM2_DEFAULT_USER_ID = '1234567812345678'

function cleanHex(value: string, label: string): string {
  const s = value.replace(/\s+/g, '').replace(/^0x/i, '')
  if (!s) throw new CryptoError(`请填写${label}`)
  if (!/^[0-9a-fA-F]+$/.test(s)) throw new CryptoError(`${label}必须是 Hex 字符串`)
  return s.toLowerCase()
}

/** 返回 64 位 Hex 私钥，校验范围 [1, n-1] */
export function normalizeSm2PrivateKey(value: string): string {
  const s = cleanHex(value, 'SM2 私钥')
  if (s.length > 64) throw new CryptoError(`SM2 私钥应为 64 位 Hex（32 字节），当前 ${s.length} 位`)
  const k = BigInt('0x' + s)
  if (k < 1n || k >= SM2_N) throw new CryptoError('SM2 私钥超出有效范围 [1, n-1]')
  return s.padStart(64, '0')
}

/** 接受 04 开头的非压缩公钥、省略 04 的 128 位 x||y，以及 02/03 压缩公钥；统一返回 04 开头的非压缩形式 */
export function normalizeSm2PublicKey(value: string): string {
  let s = cleanHex(value, 'SM2 公钥')
  if (s.length === 128) s = '04' + s
  if (s.length !== 130 && s.length !== 66) {
    throw new CryptoError(`SM2 公钥应为 130 位（04 开头）、128 位（x||y）或 66 位（压缩）Hex，当前 ${s.length} 位`)
  }
  try {
    return s.length === 66 ? uncompress(s) : sm2.verifyPublicKey(s) ? s : invalidPoint()
  } catch {
    return invalidPoint()
  }
}

function invalidPoint(): never {
  throw new CryptoError('SM2 公钥不是 SM2 曲线上的有效点')
}

function uncompress(compressed: string): string {
  const point = sm2.precomputePublicKey(compressed, 1)
  return point.toHex(false)
}

export function sm2GenerateKeyPair(): { privateKey: string; publicKey: string } {
  return sm2.generateKeyPairHex()
}

export function sm2PublicKeyFromPrivate(privateKey: string): string {
  return sm2.getPublicKeyFromPrivateKey(normalizeSm2PrivateKey(privateKey))
}

const cipherModeCode = (mode: Sm2CipherOptions['mode']) => (mode === 'C1C2C3' ? 0 : 1)

export function sm2Encrypt(publicKey: string, data: Uint8Array, options: Sm2CipherOptions): string {
  const pk = normalizeSm2PublicKey(publicKey)
  const out = sm2.doEncrypt(data, pk, cipherModeCode(options.mode), { asn1: options.format === 'asn1' })
  return options.format === 'raw' && options.c1Prefix ? '04' + out : out
}

const DECRYPT_FAIL = 'SM2 解密失败：私钥不匹配、密文模式（C1C3C2/C1C2C3）或格式不一致，或密文已损坏'

function sm2DecryptOnce(privateKey: string, cipherHex: string, options: Sm2CipherOptions): Uint8Array {
  const out = sm2.doDecrypt(cipherHex, privateKey, cipherModeCode(options.mode), { output: 'array', asn1: options.format === 'asn1' })
  const bytes = Uint8Array.from(out)
  if (bytes.length === 0) throw new CryptoError(DECRYPT_FAIL)
  return bytes
}

export function sm2Decrypt(privateKey: string, cipherText: string, options: Sm2CipherOptions): Uint8Array {
  const sk = normalizeSm2PrivateKey(privateKey)
  const hex = cleanHex(cipherText, 'SM2 密文')
  if (hex.length % 2 !== 0) throw new CryptoError('SM2 密文 Hex 长度必须为偶数')
  if (options.format === 'raw' && hex.length < 192) throw new CryptoError('SM2 密文过短：至少应包含 C1(64 字节) 与 C3(32 字节)')
  const attempt = (h: string) => {
    try {
      return sm2DecryptOnce(sk, h, options)
    } catch (e) {
      if (e instanceof CryptoError) throw e
      throw new CryptoError(DECRYPT_FAIL)
    }
  }
  try {
    return attempt(hex)
  } catch (e) {
    // 带 04 前缀的 C1（如 BouncyCastle 输出）：先按无前缀解析失败时，自动去掉前缀重试
    if (options.format === 'raw' && hex.startsWith('04') && hex.length > 194) {
      try {
        return attempt(hex.slice(2))
      } catch {
        /* 使用首次错误 */
      }
    }
    throw e
  }
}

export function sm2Sign(privateKey: string, message: Uint8Array, options: Sm2SignOptions): string {
  const sk = normalizeSm2PrivateKey(privateKey)
  return sm2.doSignature(message, sk, { der: options.der, userId: options.userId, publicKey: sm2.getPublicKeyFromPrivateKey(sk) })
}

export function sm2Verify(publicKey: string, message: Uint8Array, signature: string, options: Sm2SignOptions): boolean {
  const pk = normalizeSm2PublicKey(publicKey)
  const sig = cleanHex(signature, 'SM2 签名')
  if (!options.der && sig.length !== 128) {
    throw new CryptoError(`SM2 原始签名（r||s）应为 128 位 Hex，当前 ${sig.length} 位；若为 DER 编码请勾选 DER`)
  }
  try {
    return sm2.doVerifySignature(message, sig, pk, { der: options.der, userId: options.userId })
  } catch {
    return false
  }
}

export function sm3Hash(data: Uint8Array): string {
  return sm3(data)
}

export function sm3Hmac(data: Uint8Array, key: Uint8Array): string {
  return sm3(data, { key, mode: 'hmac' })
}

const SM4_BLOCK = 16

function checkSm4Key(key: Uint8Array) {
  if (key.length !== SM4_BLOCK) throw new CryptoError(`SM4 密钥长度必须为 16 字节，当前 ${key.length} 字节`)
}

function checkIv(iv: Uint8Array | undefined, mode: string): Uint8Array {
  if (!iv || iv.length !== SM4_BLOCK) throw new CryptoError(`SM4-${mode} 的 IV 必须为 16 字节，当前 ${iv?.length ?? 0} 字节`)
  return iv
}

/** 底层 SM4：ECB / CBC 均不做填充，数据必须是 16 字节整数倍 */
export function sm4Block(mode: 'ecb' | 'cbc', encrypt: boolean, data: Uint8Array, key: Uint8Array, iv?: Uint8Array): Uint8Array {
  checkSm4Key(key)
  if (data.length % SM4_BLOCK !== 0) throw new CryptoError(`SM4 数据长度必须为 16 字节整数倍，当前 ${data.length} 字节`)
  const options = { mode, padding: 'none' as const, output: 'array' as const, iv: mode === 'cbc' ? checkIv(iv, 'CBC') : undefined }
  const fn = encrypt ? sm4.encrypt : sm4.decrypt
  return Uint8Array.from(fn(data, key, options))
}

/** SM4-CTR：以 ECB 加密 128 位大端计数器生成密钥流（NIST SP 800-38A 的 CTR 构造） */
export function sm4Ctr(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  checkSm4Key(key)
  checkIv(iv, 'CTR')
  const blocks = Math.ceil(data.length / SM4_BLOCK)
  const counters = new Uint8Array(blocks * SM4_BLOCK)
  const counter = Uint8Array.from(iv)
  for (let i = 0; i < blocks; i++) {
    counters.set(counter, i * SM4_BLOCK)
    for (let j = SM4_BLOCK - 1; j >= 0; j--) {
      counter[j] = (counter[j] + 1) & 0xff
      if (counter[j] !== 0) break
    }
  }
  const stream = blocks ? sm4Block('ecb', true, counters, key) : new Uint8Array(0)
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ stream[i]
  return out
}

export const SM4_GCM_TAG_BYTES = 16

/** SM4-GCM：返回 密文||tag(16 字节) */
export function sm4GcmEncrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: Uint8Array): Uint8Array {
  checkSm4Key(key)
  if (iv.length === 0) throw new CryptoError('SM4-GCM 的 IV（Nonce）不能为空，推荐 12 字节')
  const r = sm4.encrypt(data, key, { mode: 'gcm', iv, associatedData: aad, output: 'array' })
  const out = new Uint8Array(r.output.length + r.tag.length)
  out.set(r.output)
  out.set(r.tag, r.output.length)
  return out
}

export function sm4GcmDecrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: Uint8Array): Uint8Array {
  checkSm4Key(key)
  if (iv.length === 0) throw new CryptoError('SM4-GCM 的 IV（Nonce）不能为空，推荐 12 字节')
  if (data.length < SM4_GCM_TAG_BYTES) throw new CryptoError('SM4-GCM 密文须为 密文||tag，至少 16 字节（tag）')
  const ct = data.subarray(0, data.length - SM4_GCM_TAG_BYTES)
  const tag = data.subarray(data.length - SM4_GCM_TAG_BYTES)
  try {
    return Uint8Array.from(sm4.decrypt(ct, key, { mode: 'gcm', iv, associatedData: aad, tag, output: 'array' }))
  } catch {
    throw new CryptoError('SM4-GCM 认证失败：密钥、IV、附加数据或密文（含 tag）不正确')
  }
}