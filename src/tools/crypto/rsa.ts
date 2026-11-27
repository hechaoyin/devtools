import forge from 'node-forge'
import { binaryToBytes, bytesToBinary, CryptoError } from './bytes'
import type { HashName, RsaEncryptPadding, RsaKeyFormat, RsaKeyPair, RsaSignScheme } from './types'

type PrivateKey = forge.pki.rsa.PrivateKey
type PublicKey = forge.pki.rsa.PublicKey

export const RSA_KEY_BITS = [1024, 2048, 3072, 4096] as const
export const RSA_HASHES: HashName[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'MD5']

const HASH_FACTORIES: Record<HashName, () => forge.md.MessageDigest> = {
  MD5: () => forge.md.md5.create(),
  'SHA-1': () => forge.md.sha1.create(),
  'SHA-256': () => forge.md.sha256.create(),
  'SHA-384': () => forge.md.sha384.create(),
  'SHA-512': () => forge.md.sha512.create(),
}

const HASH_BYTES: Record<HashName, number> = { MD5: 16, 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 }

function pemToLf(pem: string): string {
  return pem.replace(/\r\n/g, '\n').trim() + '\n'
}

function wrapPem(label: string, body: string): string {
  return `-----BEGIN ${label}-----\n${body.match(/.{1,64}/g)?.join('\n') ?? ''}\n-----END ${label}-----`
}

function bareBase64(text: string): string | null {
  const s = text.replace(/\s+/g, '')
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s) ? s : null
}

export function parsePrivateKey(text: string): PrivateKey {
  const src = text.trim()
  if (!src) throw new CryptoError('请填写 RSA 私钥')
  if (/ENCRYPTED PRIVATE KEY|Proc-Type:.*ENCRYPTED/.test(src)) throw new CryptoError('暂不支持带口令加密的私钥，请先解密为明文 PEM')
  const candidates: string[] = []
  if (src.includes('-----BEGIN')) candidates.push(src)
  else {
    const b64 = bareBase64(src)
    if (b64) candidates.push(wrapPem('PRIVATE KEY', b64), wrapPem('RSA PRIVATE KEY', b64))
  }
  for (const pem of candidates) {
    try {
      return forge.pki.privateKeyFromPem(pem)
    } catch {
      /* 尝试下一种格式 */
    }
  }
  throw new CryptoError('无法解析 RSA 私钥：请提供 PKCS#8（BEGIN PRIVATE KEY）或 PKCS#1（BEGIN RSA PRIVATE KEY）格式的 PEM，或其 Base64 正文')
}

export function parsePublicKey(text: string): PublicKey {
  const src = text.trim()
  if (!src) throw new CryptoError('请填写 RSA 公钥')
  const candidates: string[] = []
  if (src.includes('-----BEGIN')) candidates.push(src)
  else {
    const b64 = bareBase64(src)
    if (b64) candidates.push(wrapPem('PUBLIC KEY', b64), wrapPem('RSA PUBLIC KEY', b64))
  }
  for (const pem of candidates) {
    try {
      return forge.pki.publicKeyFromPem(pem)
    } catch {
      /* 尝试下一种格式 */
    }
  }
  throw new CryptoError('无法解析 RSA 公钥：请提供 SPKI（BEGIN PUBLIC KEY）或 PKCS#1（BEGIN RSA PUBLIC KEY）格式的 PEM，或其 Base64 正文')
}

export function exportPrivateKey(key: PrivateKey, format: RsaKeyFormat): string {
  if (format === 'pkcs1') return pemToLf(forge.pki.privateKeyToPem(key))
  return pemToLf(forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))))
}

export function exportPublicKey(key: PublicKey, format: RsaKeyFormat): string {
  return pemToLf(format === 'pkcs1' ? forge.pki.publicKeyToRSAPublicKeyPem(key) : forge.pki.publicKeyToPem(key))
}

/** 从私钥导出公钥 PEM */
export function derivePublicKey(privateKey: string, format: RsaKeyFormat): string {
  const k = parsePrivateKey(privateKey)
  return exportPublicKey(forge.pki.setRsaPublicKey(k.n, k.e), format)
}

/** 生成密钥对：优先使用浏览器原生 WebCrypto（快），不可用时退回纯 JS 实现 */
export async function generateRsaKeyPair(bits: number, format: RsaKeyFormat, options: { native?: boolean } = {}): Promise<RsaKeyPair> {
  let privateKey: PrivateKey
  let publicKey: PublicKey
  const subtle = options.native === false ? undefined : globalThis.crypto?.subtle
  if (subtle) {
    const pair = await subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )
    const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey))
    privateKey = forge.pki.privateKeyFromAsn1(forge.asn1.fromDer(bytesToBinary(pkcs8)))
    publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e)
  } else {
    const pair = forge.pki.rsa.generateKeyPair({ bits, e: 0x10001 })
    privateKey = pair.privateKey
    publicKey = pair.publicKey
  }
  return { privateKey: exportPrivateKey(privateKey, format), publicKey: exportPublicKey(publicKey, format) }
}

function modulusBytes(key: PublicKey | PrivateKey): number {
  return Math.ceil(key.n.bitLength() / 8)
}

export function rsaMaxPlaintext(keyBytes: number, padding: RsaEncryptPadding): number {
  return padding.scheme === 'pkcs1' ? keyBytes - 11 : keyBytes - 2 * HASH_BYTES[padding.hash] - 2
}

function oaepOptions(padding: Extract<RsaEncryptPadding, { scheme: 'oaep' }>) {
  return { md: HASH_FACTORIES[padding.hash](), mgf1: { md: HASH_FACTORIES[padding.mgf1Hash]() } }
}

export function rsaEncrypt(publicKeyPem: string, data: Uint8Array, padding: RsaEncryptPadding): Uint8Array {
  const key = parsePublicKey(publicKeyPem)
  const max = rsaMaxPlaintext(modulusBytes(key), padding)
  if (max < 0) throw new CryptoError('密钥过短，无法使用所选填充方式')
  if (data.length > max) {
    throw new CryptoError(`明文过长：${key.n.bitLength()} 位密钥配合 ${padding.scheme === 'pkcs1' ? 'PKCS#1 v1.5' : 'OAEP'} 最多加密 ${max} 字节，当前 ${data.length} 字节`)
  }
  const bin = bytesToBinary(data)
  try {
    const out = padding.scheme === 'pkcs1' ? key.encrypt(bin, 'RSAES-PKCS1-V1_5') : key.encrypt(bin, 'RSA-OAEP', oaepOptions(padding))
    return binaryToBytes(out)
  } catch {
    throw new CryptoError('RSA 加密失败，请检查公钥与填充参数')
  }
}

export function rsaDecrypt(privateKeyPem: string, data: Uint8Array, padding: RsaEncryptPadding): Uint8Array {
  const key = parsePrivateKey(privateKeyPem)
  const k = modulusBytes(key)
  if (data.length !== k) throw new CryptoError(`密文长度应为 ${k} 字节（与密钥模长一致），当前 ${data.length} 字节：请确认密钥与密文匹配`)
  const bin = bytesToBinary(data)
  try {
    const out = padding.scheme === 'pkcs1' ? key.decrypt(bin, 'RSAES-PKCS1-V1_5') : key.decrypt(bin, 'RSA-OAEP', oaepOptions(padding))
    return binaryToBytes(out)
  } catch {
    throw new CryptoError('RSA 解密失败：私钥不匹配、填充方式/哈希不一致，或密文已损坏')
  }
}

function pssFor(sign: Extract<RsaSignScheme, { scheme: 'pss' }>) {
  const md = HASH_FACTORIES[sign.hash]
  return forge.pss.create({ md: md(), mgf: forge.mgf.mgf1.create(md()), saltLength: sign.saltLength ?? HASH_BYTES[sign.hash] })
}

function digestOf(hash: HashName, message: Uint8Array): forge.md.MessageDigest {
  const md = HASH_FACTORIES[hash]()
  md.update(bytesToBinary(message))
  return md
}

export function rsaSign(privateKeyPem: string, message: Uint8Array, scheme: RsaSignScheme): Uint8Array {
  const key = parsePrivateKey(privateKeyPem)
  const md = digestOf(scheme.hash, message)
  try {
    return binaryToBytes(scheme.scheme === 'pkcs1' ? key.sign(md) : key.sign(md, pssFor(scheme)))
  } catch {
    throw new CryptoError('RSA 签名失败：密钥长度可能不足以容纳所选哈希/填充（PSS 需要更长的密钥）')
  }
}

export function rsaVerify(publicKeyPem: string, message: Uint8Array, signature: Uint8Array, scheme: RsaSignScheme): boolean {
  const key = parsePublicKey(publicKeyPem)
  if (signature.length !== modulusBytes(key)) return false
  const digest = digestOf(scheme.hash, message).digest().getBytes()
  try {
    return scheme.scheme === 'pkcs1'
      ? key.verify(digest, bytesToBinary(signature))
      : key.verify(digest, bytesToBinary(signature), pssFor(scheme))
  } catch {
    return false
  }
}