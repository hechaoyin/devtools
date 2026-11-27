import { type CipherGCM, createCipheriv, type DecipherGCM, createDecipheriv, getCiphers, randomBytes as nodeRandom } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { bytesToHex, CryptoError, hexToBytes } from './bytes'
import { runSymmetric, symmetricCrypt } from './symmetric'
import type { CipherMode, PaddingMode, SymmetricAlgorithm, SymmetricTextParams } from './types'

const h = (hex: string) => hexToBytes(hex)

function enc(
  algorithm: SymmetricAlgorithm,
  mode: CipherMode,
  key: string,
  data: string,
  opts: { iv?: string; aad?: string; padding?: PaddingMode } = {},
): string {
  return bytesToHex(
    symmetricCrypt({
      algorithm,
      mode,
      padding: opts.padding ?? 'none',
      direction: 'encrypt',
      key: h(key),
      iv: opts.iv ? h(opts.iv) : undefined,
      aad: opts.aad ? h(opts.aad) : undefined,
      data: h(data),
    }),
  )
}

function dec(
  algorithm: SymmetricAlgorithm,
  mode: CipherMode,
  key: string,
  data: string,
  opts: { iv?: string; aad?: string; padding?: PaddingMode } = {},
): string {
  return bytesToHex(
    symmetricCrypt({
      algorithm,
      mode,
      padding: opts.padding ?? 'none',
      direction: 'decrypt',
      key: h(key),
      iv: opts.iv ? h(opts.iv) : undefined,
      aad: opts.aad ? h(opts.aad) : undefined,
      data: h(data),
    }),
  )
}

const NIST_KEY = '2b7e151628aed2a6abf7158809cf4f3c'
const NIST_PT = '6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51'
const NIST_IV = '000102030405060708090a0b0c0d0e0f'

describe('AES 已知测试向量', () => {
  it('FIPS-197 附录 C：AES-128/192/256 ECB', () => {
    const pt = '00112233445566778899aabbccddeeff'
    expect(enc('AES-128', 'ECB', '000102030405060708090a0b0c0d0e0f', pt)).toBe('69c4e0d86a7b0430d8cdb78070b4c55a')
    expect(enc('AES-192', 'ECB', '000102030405060708090a0b0c0d0e0f1011121314151617', pt)).toBe('dda97ca4864cdfe06eaf70a0ec0d7191')
    expect(enc('AES-256', 'ECB', '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', pt)).toBe(
      '8ea2b7ca516745bfeafc49904b496089',
    )
  })

  it('SP 800-38A：ECB / CBC / CFB128 / OFB / CTR', () => {
    expect(enc('AES-128', 'ECB', NIST_KEY, NIST_PT)).toBe('3ad77bb40d7a3660a89ecaf32466ef97f5d3d58503b9699de785895a96fdbaaf')
    expect(enc('AES-128', 'CBC', NIST_KEY, NIST_PT, { iv: NIST_IV })).toBe('7649abac8119b246cee98e9b12e9197d5086cb9b507219ee95db113a917678b2')
    expect(enc('AES-128', 'CFB', NIST_KEY, NIST_PT, { iv: NIST_IV })).toBe('3b3fd92eb72dad20333449f8e83cfb4ac8a64537a0b3a93fcde3cdad9f1ce58b')
    expect(enc('AES-128', 'OFB', NIST_KEY, NIST_PT, { iv: NIST_IV })).toBe('3b3fd92eb72dad20333449f8e83cfb4a7789508d16918f03f53c52dac54ed825')
    expect(enc('AES-128', 'CTR', NIST_KEY, NIST_PT, { iv: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff' })).toBe(
      '874d6191b620e3261bef6864990db6ce9806f66b7970fdff8617187bb9fffdff',
    )
  })

  it('NIST GCM 测试用例 4（含 AAD，密文||tag）', () => {
    const key = 'feffe9928665731c6d6a8f9467308308'
    const iv = 'cafebabefacedbaddecaf888'
    const aad = 'feedfacedeadbeeffeedfacedeadbeefabaddad2'
    const pt =
      'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39'
    const ct =
      '42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091'
    const tag = '5bc94fbc3221a5db94fae95ae7121a47'
    expect(enc('AES-128', 'GCM', key, pt, { iv, aad })).toBe(ct + tag)
    expect(dec('AES-128', 'GCM', key, ct + tag, { iv, aad })).toBe(pt)
  })

  it('GCM 认证失败时给出明确错误', () => {
    const key = 'feffe9928665731c6d6a8f9467308308'
    const iv = 'cafebabefacedbaddecaf888'
    const sealed = enc('AES-128', 'GCM', key, '00112233', { iv })
    const bad = sealed.slice(0, -2) + (sealed.endsWith('00') ? '01' : '00')
    expect(() => dec('AES-128', 'GCM', key, bad, { iv })).toThrow(/认证失败/)
    expect(() => dec('AES-128', 'GCM', key, sealed, { iv, aad: '0102' })).toThrow(/认证失败/)
  })
})

describe('DES / 3DES / RC4 已知测试向量', () => {
  it('DES ECB', () => {
    expect(enc('DES', 'ECB', '133457799bbcdff1', '0123456789abcdef')).toBe('85e813540f0ab405')
    const pt = '4e6f77206973207468652074696d6520666f7220616c6c20'
    expect(enc('DES', 'ECB', '0123456789abcdef', pt)).toBe('3fa40e8a984d48156a271787ab8883f9893d51ec4b563b53')
  })

  it('3DES ECB（24 字节密钥，期望值由 OpenSSL des-ede3-ecb 生成）', () => {
    const key = '0123456789abcdef23456789abcdef01456789abcdef0123'
    const pt = '4e6f77206973207468652074696d6520666f7220616c6c20'
    expect(enc('3DES', 'ECB', key, pt)).toBe('314f8327fa7a09a84362760cc13ba7daff55c5f80faaac45')
    expect(enc('3DES', 'ECB', '0123456789abcdef'.repeat(3), '0123456789abcdef')).toBe(enc('DES', 'ECB', '0123456789abcdef', '0123456789abcdef'))
  })

  it('3DES 16 字节双密钥等价于 K1||K2||K1', () => {
    const k16 = '0123456789abcdef23456789abcdef01'
    const pt = '4e6f77206973207468652074696d6520'
    expect(enc('3DES', 'CBC', k16, pt, { iv: '0001020304050607' })).toBe(enc('3DES', 'CBC', k16 + '0123456789abcdef', pt, { iv: '0001020304050607' }))
  })

  it('RC4（维基百科向量）', () => {
    const t = (key: string, pt: string) =>
      bytesToHex(
        symmetricCrypt({
          algorithm: 'RC4',
          mode: 'ECB',
          padding: 'none',
          direction: 'encrypt',
          key: new TextEncoder().encode(key),
          data: new TextEncoder().encode(pt),
        }),
      )
    expect(t('Key', 'Plaintext')).toBe('bbf316e8d940af0ad3')
    expect(t('Wiki', 'pedia')).toBe('1021bf0420')
    expect(t('Secret', 'Attack at dawn')).toBe('45a01f645fc35b383552544b9bf5')
  })
})

describe('SM4 已知测试向量', () => {
  const key = '0123456789abcdeffedcba9876543210'

  it('GB/T 32907 附录：单块 ECB', () => {
    expect(enc('SM4', 'ECB', key, key)).toBe('681edf34d206965e86b3e94f536e4246')
    expect(dec('SM4', 'ECB', key, '681edf34d206965e86b3e94f536e4246')).toBe(key)
  })

  it('RFC 8998：SM4-GCM（含 AAD）', () => {
    const iv = '00001234567800000000abcd'
    const aad = 'feedfacedeadbeeffeedfacedeadbeefabaddad2'
    const pt =
      'aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbccccccccccccccccddddddddddddddddeeeeeeeeeeeeeeeeffffffffffffffffeeeeeeeeeeeeeeeeaaaaaaaaaaaaaaaa'
    const ct =
      '17f399f08c67d5ee19d0dc9969c4bb7d5fd46fd3756489069157b282bb200735d82710ca5c22f0ccfa7cbf93d496ac15a56834cbcf98c397b4024a2691233b8d'
    const tag = '83de3541e4c2b58177e065a9bf7b62ec'
    expect(enc('SM4', 'GCM', key, pt, { iv, aad })).toBe(ct + tag)
    expect(dec('SM4', 'GCM', key, ct + tag, { iv, aad })).toBe(pt)
    expect(() => dec('SM4', 'GCM', key, ct + tag, { iv, aad: '00' })).toThrow(/认证失败/)
  })
})

const nodeHas = (name: string) => getCiphers().includes(name)

describe('与 Node.js / OpenSSL 交叉验证', () => {
  const sizes: Record<string, number> = { 'AES-128': 16, 'AES-192': 24, 'AES-256': 32 }
  const msg = Buffer.from('交叉验证 cross-check 1234567890 abcdefghijklmnopqrstuvwxyz')

  for (const [alg, n] of Object.entries(sizes)) {
    for (const mode of ['ECB', 'CBC', 'CTR', 'CFB', 'OFB'] as const) {
      it(`${alg}-${mode}`, () => {
        const key = nodeRandom(n)
        const iv = nodeRandom(16)
        const name = `aes-${n * 8}-${mode.toLowerCase()}`
        const c = createCipheriv(name, key, mode === 'ECB' ? null : iv)
        const expected = Buffer.concat([c.update(msg), c.final()])
        const got = symmetricCrypt({
          algorithm: alg as SymmetricAlgorithm,
          mode,
          padding: 'pkcs7',
          direction: 'encrypt',
          key,
          iv,
          data: msg,
        })
        expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
      })
    }
  }

  it('AES-256-GCM（含 AAD）', () => {
    const key = nodeRandom(32)
    const iv = nodeRandom(12)
    const aad = Buffer.from('header')
    const c = createCipheriv('aes-256-gcm', key, iv)
    c.setAAD(aad)
    const expected = Buffer.concat([c.update(msg), c.final(), c.getAuthTag()])
    const got = symmetricCrypt({ algorithm: 'AES-256', mode: 'GCM', padding: 'none', direction: 'encrypt', key, iv, aad, data: msg })
    expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
  })

  it('3DES-CBC 24 字节与 16 字节密钥', () => {
    for (const n of [24, 16]) {
      const key = nodeRandom(n)
      const iv = nodeRandom(8)
      const c = createCipheriv(n === 24 ? 'des-ede3-cbc' : 'des-ede-cbc', key, iv)
      const expected = Buffer.concat([c.update(msg), c.final()])
      const got = symmetricCrypt({ algorithm: '3DES', mode: 'CBC', padding: 'pkcs7', direction: 'encrypt', key, iv, data: msg })
      expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
    }
  })

  const sm4It = (name: string, mode: CipherMode, run: () => void) => (nodeHas(name) ? it : it.skip)(`SM4-${mode}`, run)

  sm4It('sm4-ecb', 'ECB', () => {
    const key = nodeRandom(16)
    const c = createCipheriv('sm4-ecb', key, null)
    const expected = Buffer.concat([c.update(msg), c.final()])
    const got = symmetricCrypt({ algorithm: 'SM4', mode: 'ECB', padding: 'pkcs7', direction: 'encrypt', key, data: msg })
    expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
  })

  sm4It('sm4-cbc', 'CBC', () => {
    const key = nodeRandom(16)
    const iv = nodeRandom(16)
    const c = createCipheriv('sm4-cbc', key, iv)
    const expected = Buffer.concat([c.update(msg), c.final()])
    const got = symmetricCrypt({ algorithm: 'SM4', mode: 'CBC', padding: 'pkcs7', direction: 'encrypt', key, iv, data: msg })
    expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
  })

  sm4It('sm4-ctr', 'CTR', () => {
    const key = nodeRandom(16)
    const iv = Buffer.alloc(16, 0xff)
    iv[0] = 0x01
    const c = createCipheriv('sm4-ctr', key, iv)
    const expected = Buffer.concat([c.update(msg), c.final()])
    const got = symmetricCrypt({ algorithm: 'SM4', mode: 'CTR', padding: 'none', direction: 'encrypt', key, iv, data: msg })
    expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
    const back = symmetricCrypt({ algorithm: 'SM4', mode: 'CTR', padding: 'none', direction: 'decrypt', key, iv, data: got })
    expect(Buffer.from(back).equals(msg)).toBe(true)
  })

  sm4It('sm4-gcm', 'GCM', () => {
    const key = nodeRandom(16)
    const iv = nodeRandom(12)
    const aad = Buffer.from('aad')
    const c = createCipheriv('sm4-gcm', key, iv) as CipherGCM
    c.setAAD(aad)
    const expected = Buffer.concat([c.update(msg), c.final(), c.getAuthTag()])
    const got = symmetricCrypt({ algorithm: 'SM4', mode: 'GCM', padding: 'none', direction: 'encrypt', key, iv, aad, data: msg })
    expect(Buffer.from(got).toString('hex')).toBe(expected.toString('hex'))
    const d = createDecipheriv('sm4-gcm', key, iv) as DecipherGCM
    d.setAAD(aad)
    d.setAuthTag(Buffer.from(got.subarray(got.length - 16)))
    expect(Buffer.concat([d.update(got.subarray(0, got.length - 16)), d.final()]).equals(msg)).toBe(true)
  })
})

describe('往返加解密与填充', () => {
  const combos: [SymmetricAlgorithm, CipherMode, number][] = [
    ['AES-128', 'ECB', 16],
    ['AES-192', 'CBC', 24],
    ['AES-256', 'CBC', 32],
    ['AES-256', 'CTR', 32],
    ['AES-128', 'CFB', 16],
    ['AES-128', 'OFB', 16],
    ['AES-256', 'GCM', 32],
    ['DES', 'ECB', 8],
    ['DES', 'CBC', 8],
    ['3DES', 'CBC', 24],
    ['3DES', 'CBC', 16],
    ['3DES', 'CTR', 24],
    ['SM4', 'ECB', 16],
    ['SM4', 'CBC', 16],
    ['SM4', 'CTR', 16],
    ['SM4', 'GCM', 16],
  ]
  const plain = '加解密往返 round-trip：中文 + English + 12345'

  for (const [algorithm, mode, keyLen] of combos) {
    it(`${algorithm}-${mode}（key ${keyLen}）文本往返`, () => {
      const base: SymmetricTextParams = {
        algorithm,
        mode,
        padding: 'pkcs7',
        direction: 'encrypt',
        key: 'k'.repeat(keyLen),
        keyEncoding: 'utf8',
        iv: '0123456789abcdef0123456789abcdef'.slice(0, SYM_IV(algorithm, mode)),
        ivEncoding: 'hex',
        aad: 'meta',
        aadEncoding: 'utf8',
        input: plain,
        inputEncoding: 'utf8',
        outputEncoding: 'base64',
      }
      const cipher = runSymmetric(base)
      expect(cipher).not.toBe(plain)
      const back = runSymmetric({ ...base, direction: 'decrypt', input: cipher, inputEncoding: 'base64', outputEncoding: 'utf8' })
      expect(back).toBe(plain)
    })
  }

  it('RC4 往返', () => {
    const base: SymmetricTextParams = {
      algorithm: 'RC4',
      mode: 'ECB',
      padding: 'none',
      direction: 'encrypt',
      key: 'secret',
      keyEncoding: 'utf8',
      iv: '',
      ivEncoding: 'hex',
      aad: '',
      aadEncoding: 'utf8',
      input: plain,
      inputEncoding: 'utf8',
      outputEncoding: 'hex',
    }
    const c = runSymmetric(base)
    expect(runSymmetric({ ...base, direction: 'decrypt', input: c, inputEncoding: 'hex', outputEncoding: 'utf8' })).toBe(plain)
  })

  it('ZeroPadding：补零并在解密时去除', () => {
    const key = '00112233445566778899aabbccddeeff'
    const data = '01020304'
    const c = enc('AES-128', 'ECB', key, data, { padding: 'zero' })
    expect(c.length).toBe(32)
    expect(dec('AES-128', 'ECB', key, c, { padding: 'zero' })).toBe(data)
    expect(c).toBe(enc('AES-128', 'ECB', key, data + '00'.repeat(12)))
  })

  it('PKCS7 与 NoPadding 的差异', () => {
    const key = '00112233445566778899aabbccddeeff'
    // 整块数据 + PKCS7 会额外补一整块
    expect(enc('AES-128', 'ECB', key, '00'.repeat(16), { padding: 'pkcs7' }).length).toBe(64)
    expect(enc('AES-128', 'ECB', key, '00'.repeat(16), { padding: 'none' }).length).toBe(32)
  })

  it('空明文可加密并往返', () => {
    const key = '00112233445566778899aabbccddeeff'
    const c = enc('AES-128', 'ECB', key, '', { padding: 'pkcs7' })
    expect(c.length).toBe(32)
    expect(dec('AES-128', 'ECB', key, c, { padding: 'pkcs7' })).toBe('')
  })
})

function SYM_IV(algorithm: SymmetricAlgorithm, mode: CipherMode): number {
  if (mode === 'GCM') return 24
  return algorithm === 'DES' || algorithm === '3DES' ? 16 : 32
}

describe('密钥 / IV / 填充错误提示', () => {
  const base = { algorithm: 'AES-128', mode: 'CBC', padding: 'pkcs7', direction: 'encrypt' } as const
  const run = (over: Partial<Parameters<typeof symmetricCrypt>[0]>) =>
    symmetricCrypt({ ...base, key: new Uint8Array(16), iv: new Uint8Array(16), data: new Uint8Array(5), ...over })

  it('密钥长度错误', () => {
    expect(() => run({ key: new Uint8Array(15) })).toThrow('AES-128 密钥必须为 16 字节，当前 15 字节')
    expect(() => run({ algorithm: 'AES-256', key: new Uint8Array(16) })).toThrow('AES-256 密钥必须为 32 字节，当前 16 字节')
    expect(() => run({ algorithm: 'DES', key: new Uint8Array(16) })).toThrow('DES 密钥必须为 8 字节')
    expect(() => run({ algorithm: '3DES', key: new Uint8Array(8) })).toThrow('3DES 密钥必须为 16 或 24 字节')
    expect(() => run({ algorithm: 'SM4', key: new Uint8Array(32) })).toThrow('SM4 密钥必须为 16 字节')
    expect(() => run({ key: new Uint8Array(0) })).toThrow('请填写密钥')
  })

  it('IV 长度错误', () => {
    expect(() => run({ iv: new Uint8Array(8) })).toThrow('AES-128-CBC 的 IV 必须为 16 字节，当前 8 字节')
    expect(() => run({ iv: undefined })).toThrow(/IV 必须为 16 字节/)
    expect(() => run({ algorithm: 'DES', key: new Uint8Array(8) })).toThrow('DES-CBC 的 IV 必须为 8 字节，当前 16 字节')
    expect(() => run({ mode: 'GCM', iv: new Uint8Array(0) })).toThrow(/GCM 需要 IV/)
  })

  it('NoPadding 数据未对齐', () => {
    expect(() => run({ padding: 'none' })).toThrow('NoPadding 要求数据长度为 16 字节的整数倍，当前 5 字节')
  })

  it('密文长度不是块的整数倍', () => {
    expect(() => run({ direction: 'decrypt', data: new Uint8Array(17) })).toThrow('密文长度必须为 16 字节整数倍')
  })

  it('错误密钥解密 PKCS7 报填充错误', () => {
    const iv = new Uint8Array(16)
    const cipher = symmetricCrypt({ ...base, key: new Uint8Array(16).fill(1), iv, data: new TextEncoder().encode('hello') })
    let failed = 0
    for (let i = 2; i < 40; i++) {
      try {
        symmetricCrypt({ ...base, direction: 'decrypt', key: new Uint8Array(16).fill(i), iv, data: cipher })
      } catch (e) {
        expect(e).toBeInstanceOf(CryptoError)
        expect((e as Error).message).toContain('去填充失败')
        failed++
      }
    }
    expect(failed).toBeGreaterThan(30)
  })

  it('不支持的模式', () => {
    expect(() => run({ algorithm: 'DES', key: new Uint8Array(8), mode: 'GCM' })).toThrow('DES 不支持 GCM 模式')
  })

  it('解密结果非 UTF-8 时提示改用 Hex/Base64', () => {
    expect(() =>
      runSymmetric({
        algorithm: 'AES-128',
        mode: 'ECB',
        padding: 'none',
        direction: 'decrypt',
        key: '0123456789abcdef',
        keyEncoding: 'utf8',
        iv: '',
        ivEncoding: 'hex',
        aad: '',
        aadEncoding: 'utf8',
        input: '00112233445566778899aabbccddeeff',
        inputEncoding: 'hex',
        outputEncoding: 'utf8',
      }),
    ).toThrow(/不是有效的 UTF-8/)
  })

  it('Hex / Base64 输入非法时指明字段', () => {
    expect(() =>
      runSymmetric({
        algorithm: 'AES-128',
        mode: 'ECB',
        padding: 'pkcs7',
        direction: 'encrypt',
        key: 'zz',
        keyEncoding: 'hex',
        iv: '',
        ivEncoding: 'hex',
        aad: '',
        aadEncoding: 'utf8',
        input: 'a',
        inputEncoding: 'utf8',
        outputEncoding: 'hex',
      }),
    ).toThrow('密钥不是有效的 Hex')
  })
})
