import { describe, expect, it } from 'vitest'
import { computeHash } from '../hash/logic'
import { hexToBytes } from './bytes'
import { HMAC_ALGORITHMS, hmacBytes, hmacHex } from './hmac'

const utf8 = (s: string) => new TextEncoder().encode(s)

describe('HMAC', () => {
  it('RFC 4231 测试用例 1/2（HMAC-SHA-224/256/384/512）', () => {
    const key1 = hexToBytes('0b'.repeat(20))
    const data1 = utf8('Hi There')
    expect(hmacHex('SHA-224', data1, key1)).toBe('896fb1128abbdf196832107cd49df33f47b4b1169912ba4f53684b22')
    expect(hmacHex('SHA-256', data1, key1)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
    expect(hmacHex('SHA-384', data1, key1)).toBe(
      'afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6',
    )
    expect(hmacHex('SHA-512', data1, key1)).toBe(
      '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854',
    )
    expect(hmacHex('SHA-256', utf8('what do ya want for nothing?'), utf8('Jefe'))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    )
  })

  it('RFC 2202：HMAC-MD5 / HMAC-SHA1', () => {
    expect(hmacHex('MD5', utf8('Hi There'), hexToBytes('0b'.repeat(16)))).toBe('9294727a3638bb1c13f48ef8158bfc9d')
    expect(hmacHex('SHA-1', utf8('Hi There'), hexToBytes('0b'.repeat(20)))).toBe('b617318655057264e28bc0b6fb378c8ef146be00')
  })

  it('与哈希工具的文本 HMAC 结果一致（复用交叉验证）', () => {
    for (const alg of HMAC_ALGORITHMS.filter((a) => a !== 'SM3')) {
      expect(hmacHex(alg, utf8('hello 世界'), utf8('secret'))).toBe(computeHash(alg, 'hello 世界', { hmacKey: 'secret' }))
    }
  })

  it('HMAC-SM3 与 SM3 算法清单', () => {
    expect(HMAC_ALGORITHMS).toContain('SM3')
    expect(hmacHex('SM3', utf8('abc'), utf8('key'))).toMatch(/^[0-9a-f]{64}$/)
    expect(hmacBytes('SM3', utf8('abc'), utf8('key')).length).toBe(32)
  })

  it('长密钥（超过块大小）与二进制密钥', () => {
    const long = new Uint8Array(200).fill(0xaa)
    expect(hmacHex('SHA-256', utf8('Test Using Larger Than Block-Size Key - Hash Key First'), hexToBytes('aa'.repeat(131)))).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    )
    expect(hmacHex('SHA-256', utf8('x'), long)).toMatch(/^[0-9a-f]{64}$/)
  })
})
