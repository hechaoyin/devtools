import { constants, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt, sign, verify } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CryptoError } from './bytes'
import {
  derivePublicKey,
  generateRsaKeyPair,
  parsePrivateKey,
  parsePublicKey,
  rsaDecrypt,
  rsaEncrypt,
  rsaMaxPlaintext,
  rsaSign,
  rsaVerify,
} from './rsa'
import type { HashName, RsaEncryptPadding } from './types'

const utf8 = (s: string) => new TextEncoder().encode(s)

let pkcs8 = ''
let spki = ''

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  pkcs8 = pair.privateKey
  spki = pair.publicKey
})

const stripPem = (pem: string) => pem.replace(/-----[^-]+-----|\s+/g, '')

describe('密钥生成与格式', () => {
  it('WebCrypto 生成 PKCS#8 / SPKI，Node 可直接解析', async () => {
    const kp = await generateRsaKeyPair(2048, 'pkcs8')
    expect(kp.privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----\n/)
    expect(kp.publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----\n/)
    const pub = createPublicKey(kp.publicKey)
    const priv = createPrivateKey(kp.privateKey)
    expect(pub.asymmetricKeyDetails?.modulusLength).toBe(2048)
    const sig = sign('sha256', utf8('m'), priv)
    expect(verify('sha256', utf8('m'), pub, sig)).toBe(true)
  })

  it('PKCS#1 格式导出', async () => {
    const kp = await generateRsaKeyPair(2048, 'pkcs1')
    expect(kp.privateKey).toMatch(/^-----BEGIN RSA PRIVATE KEY-----\n/)
    expect(kp.publicKey).toMatch(/^-----BEGIN RSA PUBLIC KEY-----\n/)
    expect(createPublicKey(kp.publicKey).asymmetricKeyType).toBe('rsa')
    expect(createPrivateKey(kp.privateKey).asymmetricKeyType).toBe('rsa')
  })

  it('纯 JS 回退路径可生成可用密钥（1024 位）', async () => {
    const kp = await generateRsaKeyPair(1024, 'pkcs8', { native: false })
    const ct = rsaEncrypt(kp.publicKey, utf8('fallback'), { scheme: 'pkcs1' })
    expect(new TextDecoder().decode(rsaDecrypt(kp.privateKey, ct, { scheme: 'pkcs1' }))).toBe('fallback')
  }, 60000)

  it('接受 PKCS#8 / PKCS#1 / 仅 Base64 正文', () => {
    const body8 = stripPem(pkcs8)
    expect(parsePrivateKey(body8).n.bitLength()).toBe(2048)
    expect(parsePublicKey(stripPem(spki)).n.bitLength()).toBe(2048)
    const pkcs1Priv = createPrivateKey(pkcs8).export({ type: 'pkcs1', format: 'pem' }).toString()
    const pkcs1Pub = createPublicKey(spki).export({ type: 'pkcs1', format: 'pem' }).toString()
    expect(parsePrivateKey(pkcs1Priv).n.toString(16)).toBe(parsePrivateKey(pkcs8).n.toString(16))
    expect(parsePrivateKey(stripPem(pkcs1Priv)).n.bitLength()).toBe(2048)
    expect(parsePublicKey(stripPem(pkcs1Pub)).n.bitLength()).toBe(2048)
  })

  it('从私钥导出公钥', () => {
    const pub = derivePublicKey(pkcs8, 'pkcs8')
    expect(stripPem(pub)).toBe(stripPem(spki))
  })

  it('非法密钥给出明确错误', () => {
    expect(() => parsePrivateKey('')).toThrow('请填写 RSA 私钥')
    expect(() => parsePrivateKey('not a key')).toThrow('无法解析 RSA 私钥')
    expect(() => parsePublicKey('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----')).toThrow('无法解析 RSA 公钥')
    expect(() => parsePrivateKey('-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----')).toThrow('口令')
  })
})

describe('RSA 加解密', () => {
  const paddings: [string, RsaEncryptPadding][] = [
    ['PKCS#1 v1.5', { scheme: 'pkcs1' }],
    ['OAEP SHA-1', { scheme: 'oaep', hash: 'SHA-1', mgf1Hash: 'SHA-1' }],
    ['OAEP SHA-256', { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-256' }],
    ['OAEP SHA-256 + MGF1-SHA-1', { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-1' }],
  ]

  for (const [name, padding] of paddings) {
    it(`${name}：往返`, () => {
      const msg = utf8('RSA 加密 round-trip 中文')
      const ct = rsaEncrypt(spki, msg, padding)
      expect(ct.length).toBe(256)
      expect(rsaDecrypt(pkcs8, ct, padding)).toEqual(msg)
    })
  }

  it('我们加密 → Node(OpenSSL) 解密（OAEP SHA-256）', () => {
    const msg = utf8('interop')
    const ct = rsaEncrypt(spki, msg, { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-256' })
    expect(privateDecrypt({ key: pkcs8, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, ct)).toEqual(Buffer.from(msg))
  })

  it('Node 加密 → 我们解密（PKCS#1 v1.5 / OAEP SHA-1）', () => {
    const msg = Buffer.from('from node')
    const a = publicEncrypt({ key: spki, padding: constants.RSA_PKCS1_PADDING }, msg)
    expect(Buffer.from(rsaDecrypt(pkcs8, a, { scheme: 'pkcs1' }))).toEqual(msg)
    const b = publicEncrypt({ key: spki, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, msg)
    expect(Buffer.from(rsaDecrypt(pkcs8, b, { scheme: 'oaep', hash: 'SHA-1', mgf1Hash: 'SHA-1' }))).toEqual(msg)
  })

  it('明文过长给出最大长度', () => {
    expect(rsaMaxPlaintext(256, { scheme: 'pkcs1' })).toBe(245)
    expect(rsaMaxPlaintext(256, { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-256' })).toBe(190)
    expect(() => rsaEncrypt(spki, new Uint8Array(246), { scheme: 'pkcs1' })).toThrow('最多加密 245 字节，当前 246 字节')
    expect(() => rsaEncrypt(spki, new Uint8Array(191), { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-256' })).toThrow('最多加密 190 字节')
  })

  it('解密错误提示：密文长度 / 填充不一致 / 私钥不匹配', () => {
    const ct = rsaEncrypt(spki, utf8('x'), { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-256' })
    expect(() => rsaDecrypt(pkcs8, ct.subarray(0, 100), { scheme: 'pkcs1' })).toThrow('密文长度应为 256 字节')
    expect(() => rsaDecrypt(pkcs8, ct, { scheme: 'oaep', hash: 'SHA-1', mgf1Hash: 'SHA-1' })).toThrow('RSA 解密失败')
    const other = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
    expect(() => rsaDecrypt(other.privateKey, ct, { scheme: 'oaep', hash: 'SHA-256', mgf1Hash: 'SHA-256' })).toThrow(CryptoError)
  })
})

describe('RSA 签名 / 验签', () => {
  const hashes: [HashName, string][] = [
    ['SHA-1', 'sha1'],
    ['SHA-256', 'sha256'],
    ['SHA-384', 'sha384'],
    ['SHA-512', 'sha512'],
    ['MD5', 'md5'],
  ]
  const msg = utf8('待签名内容 sign me')

  for (const [hash, nodeHash] of hashes) {
    it(`PKCS#1 v1.5 + ${hash}：与 OpenSSL 签名逐字节一致（签名确定）`, () => {
      const ours = rsaSign(pkcs8, msg, { scheme: 'pkcs1', hash })
      expect(Buffer.from(ours)).toEqual(sign(nodeHash, msg, pkcs8))
      expect(rsaVerify(spki, msg, ours, { scheme: 'pkcs1', hash })).toBe(true)
      expect(rsaVerify(spki, utf8('tampered'), ours, { scheme: 'pkcs1', hash })).toBe(false)
    })
  }

  it('PSS：我们签名 → OpenSSL 验签，OpenSSL 签名 → 我们验签', () => {
    const ours = rsaSign(pkcs8, msg, { scheme: 'pss', hash: 'SHA-256' })
    expect(verify('sha256', msg, { key: spki, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, ours)).toBe(true)
    const theirs = sign('sha256', msg, { key: pkcs8, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 })
    expect(rsaVerify(spki, msg, theirs, { scheme: 'pss', hash: 'SHA-256' })).toBe(true)
    expect(rsaVerify(spki, utf8('other'), theirs, { scheme: 'pss', hash: 'SHA-256' })).toBe(false)
  })

  it('错误公钥 / 错误长度签名验签失败而不抛错', () => {
    const sig = rsaSign(pkcs8, msg, { scheme: 'pkcs1', hash: 'SHA-256' })
    const other = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
    expect(rsaVerify(other.publicKey, msg, sig, { scheme: 'pkcs1', hash: 'SHA-256' })).toBe(false)
    expect(rsaVerify(spki, msg, sig.subarray(0, 10), { scheme: 'pkcs1', hash: 'SHA-256' })).toBe(false)
    expect(rsaVerify(spki, msg, sig, { scheme: 'pkcs1', hash: 'SHA-1' })).toBe(false)
  })
})
