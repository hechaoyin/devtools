import { createHash, createHmac, getHashes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CryptoError } from './bytes'
import {
  normalizeSm2PrivateKey,
  normalizeSm2PublicKey,
  SM2_DEFAULT_USER_ID,
  sm2Decrypt,
  sm2Encrypt,
  sm2GenerateKeyPair,
  sm2PublicKeyFromPrivate,
  sm2Sign,
  sm2Verify,
  sm3Hash,
  sm3Hmac,
} from './sm'

const utf8 = (s: string) => new TextEncoder().encode(s)

// GB/T 32918.5-2017 附录 A：SM2 推荐曲线示例
const STD_PRIV = '3945208f7b2144b13f36e38ac6d39f95889393692860b51a42fb81ef4df7c5b8'
const STD_PUB =
  '04' +
  '09f9df311e5421a150dd7d161e4bc5c672179fad1833fc076bb08ff356f35020' +
  'ccea490ce26775a52dc6ea718cc1aa600aed05fbf35e084a6632f6072da9ad13'

describe('SM3', () => {
  it('GB/T 32905 标准向量', () => {
    expect(sm3Hash(utf8('abc'))).toBe('66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0')
    expect(sm3Hash(utf8('abcd'.repeat(16)))).toBe('debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732')
    expect(sm3Hash(new Uint8Array(0))).toBe('1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b')
  })

  it('HMAC-SM3 与 OpenSSL 一致', () => {
    if (!getHashes().includes('sm3')) return
    for (const [key, msg] of [
      ['key', 'The quick brown fox jumps over the lazy dog'],
      ['k'.repeat(100), '中文消息'],
      ['', 'abc'],
    ]) {
      expect(sm3Hmac(utf8(msg), utf8(key))).toBe(createHmac('sm3', key).update(msg).digest('hex'))
    }
    expect(sm3Hash(utf8('openssl'))).toBe(createHash('sm3').update('openssl').digest('hex'))
  })
})

describe('SM2 密钥', () => {
  it('标准示例私钥推导出标准公钥', () => {
    expect(sm2PublicKeyFromPrivate(STD_PRIV)).toBe(STD_PUB)
  })

  it('生成的密钥对格式正确且匹配', () => {
    const kp = sm2GenerateKeyPair()
    expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/)
    expect(kp.publicKey).toMatch(/^04[0-9a-f]{128}$/)
    expect(sm2PublicKeyFromPrivate(kp.privateKey)).toBe(kp.publicKey)
  })

  it('公钥接受 04 / 无前缀 / 压缩三种形式', () => {
    const x = STD_PUB.slice(2, 66)
    const yLastByteOdd = parseInt(STD_PUB.slice(-2), 16) % 2 === 1
    expect(normalizeSm2PublicKey(STD_PUB.slice(2))).toBe(STD_PUB)
    expect(normalizeSm2PublicKey((yLastByteOdd ? '03' : '02') + x)).toBe(STD_PUB)
  })

  it('非法密钥给出明确错误', () => {
    expect(() => normalizeSm2PrivateKey('')).toThrow('请填写SM2 私钥')
    expect(() => normalizeSm2PrivateKey('xyz')).toThrow('必须是 Hex')
    expect(() => normalizeSm2PrivateKey('1'.repeat(66))).toThrow('64 位 Hex')
    expect(() => normalizeSm2PrivateKey('0'.repeat(64))).toThrow('超出有效范围')
    expect(() => normalizeSm2PublicKey('04abcd')).toThrow('应为 130 位')
    expect(() => normalizeSm2PublicKey('04' + '11'.repeat(64))).toThrow('不是 SM2 曲线上的有效点')
  })
})

describe('SM2 签名 / 验签', () => {
  it('GB/T 32918.5 附录 A 的标准签名可验签通过', () => {
    const msg = utf8('message digest')
    const sig =
      'f5a03b0648d2c4630eeac513e1bb81a15944da3827d5b74143ac7eaceee720b3' + 'b1b6aa29df212fd8763182bc0d421ca1bb9038fd1f7f42d4840b69c485bbc1aa'
    expect(sm2Verify(STD_PUB, msg, sig, { userId: SM2_DEFAULT_USER_ID, der: false })).toBe(true)
    expect(sm2Verify(STD_PUB, utf8('message digesT'), sig, { userId: SM2_DEFAULT_USER_ID, der: false })).toBe(false)
    expect(sm2Verify(STD_PUB, msg, sig, { userId: 'other-id', der: false })).toBe(false)
  })

  it('签名往返：raw 与 DER，自定义 userId', () => {
    const kp = sm2GenerateKeyPair()
    const msg = utf8('待签名消息 hello')
    for (const der of [false, true]) {
      for (const userId of [SM2_DEFAULT_USER_ID, 'alice@example.com']) {
        const sig = sm2Sign(kp.privateKey, msg, { userId, der })
        if (!der) expect(sig).toMatch(/^[0-9a-f]{128}$/)
        else expect(sig.startsWith('30')).toBe(true)
        expect(sm2Verify(kp.publicKey, msg, sig, { userId, der })).toBe(true)
        expect(sm2Verify(kp.publicKey, utf8('tampered'), sig, { userId, der })).toBe(false)
      }
    }
  })

  it('用别人的公钥或错误格式验签', () => {
    const a = sm2GenerateKeyPair()
    const b = sm2GenerateKeyPair()
    const msg = utf8('x')
    const sig = sm2Sign(a.privateKey, msg, { userId: SM2_DEFAULT_USER_ID, der: false })
    expect(sm2Verify(b.publicKey, msg, sig, { userId: SM2_DEFAULT_USER_ID, der: false })).toBe(false)
    expect(() => sm2Verify(a.publicKey, msg, 'abcd', { userId: SM2_DEFAULT_USER_ID, der: false })).toThrow('128 位')
    expect(sm2Verify(a.publicKey, msg, '30', { userId: SM2_DEFAULT_USER_ID, der: true })).toBe(false)
  })
})

describe('SM2 加解密', () => {
  // GM/T 0003.5-2012 附录 C / OpenSSL sm2_internal_test：明文 "encryption standard"
  const x1 = '04ebfc718e8d1798620432268e77feb6415e2ede0e073c0f4f640ecd2e149a73'
  const y1 = 'e858f9d81e5430a57b36daab8f950a3c64e6ee6a63094d99283aff767e124df0'
  const c3 = '59983c18f809e262923c53aec295d30383b54e39d609d160afcb1908d0bd8766'
  const c2 = '21886ca989ca9c7d58087307ca93092d651efa'

  it('标准密文可解密：C1C3C2 / C1C2C3 / 带 04 前缀 / ASN.1 DER', () => {
    const want = 'encryption standard'
    const dec = (cipher: string, mode: 'C1C3C2' | 'C1C2C3', format: 'raw' | 'asn1') =>
      new TextDecoder().decode(sm2Decrypt(STD_PRIV, cipher, { mode, format }))
    expect(dec(x1 + y1 + c3 + c2, 'C1C3C2', 'raw')).toBe(want)
    expect(dec('04' + x1 + y1 + c3 + c2, 'C1C3C2', 'raw')).toBe(want)
    expect(dec(x1 + y1 + c2 + c3, 'C1C2C3', 'raw')).toBe(want)
    const der = '307c0220' + x1 + '022100' + y1 + '0420' + c3 + '0413' + c2
    expect(dec(der, 'C1C3C2', 'asn1')).toBe(want)
  })
  it('往返：C1C3C2 / C1C2C3 × raw / ASN.1 × 有无 04 前缀', () => {
    const kp = sm2GenerateKeyPair()
    const text = '国密 SM2 加解密 round-trip'
    for (const mode of ['C1C3C2', 'C1C2C3'] as const) {
      for (const format of ['raw', 'asn1'] as const) {
        for (const c1Prefix of [false, true]) {
          const cipher = sm2Encrypt(kp.publicKey, utf8(text), { mode, format, c1Prefix })
          if (format === 'raw') expect(cipher.length).toBe((c1Prefix ? 130 : 128) + 64 + utf8(text).length * 2)
          const back = sm2Decrypt(kp.privateKey, cipher, { mode, format })
          expect(new TextDecoder().decode(back)).toBe(text)
        }
      }
    }
  })

  it('密文结构：C1C3C2 与 C1C2C3 的 C3 位置不同', () => {
    const kp = sm2GenerateKeyPair()
    const msg = utf8('structure')
    const a = sm2Encrypt(kp.publicKey, msg, { mode: 'C1C3C2', format: 'raw' })
    expect(a.length).toBe(128 + 64 + msg.length * 2)
    // 以 C1C3C2 加密的密文按 C1C2C3 解密会失败（C3 校验不通过）
    expect(() => sm2Decrypt(kp.privateKey, a, { mode: 'C1C2C3', format: 'raw' })).toThrow('SM2 解密失败')
  })

  it('错误私钥 / 损坏密文 / 过短密文', () => {
    const a = sm2GenerateKeyPair()
    const b = sm2GenerateKeyPair()
    const cipher = sm2Encrypt(a.publicKey, utf8('secret'), { mode: 'C1C3C2', format: 'raw' })
    expect(() => sm2Decrypt(b.privateKey, cipher, { mode: 'C1C3C2', format: 'raw' })).toThrow(CryptoError)
    const flipped = cipher.slice(0, -2) + (cipher.endsWith('00') ? '01' : '00')
    expect(() => sm2Decrypt(a.privateKey, flipped, { mode: 'C1C3C2', format: 'raw' })).toThrow('SM2 解密失败')
    expect(() => sm2Decrypt(a.privateKey, 'abcd', { mode: 'C1C3C2', format: 'raw' })).toThrow('SM2 密文过短')
    expect(() => sm2Decrypt(a.privateKey, 'zz', { mode: 'C1C3C2', format: 'asn1' })).toThrow('必须是 Hex')
  })
})
