import { describe, expect, it } from 'vitest'
import { computeAll, computeHash } from './logic'

describe('hash logic', () => {
  it('空字符串的标准摘要', () => {
    expect(computeHash('MD5', '')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(computeHash('SHA-1', '')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
    expect(computeHash('SHA-256', '')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('abc 的标准摘要', () => {
    expect(computeHash('MD5', 'abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(computeHash('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(computeHash('SHA-224', 'abc')).toBe('23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7')
    expect(computeHash('SHA-256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(computeHash('SHA-384', 'abc')).toBe(
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    )
    expect(computeHash('SHA-512', 'abc')).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    )
  })

  it('UTF-8 中文', () => {
    expect(computeHash('MD5', '你好')).toBe('7eca689f0d3389d9dea66ae112e5cfd7')
  })

  it('大写与 base64 输出', () => {
    expect(computeHash('MD5', 'abc', { upper: true })).toBe('900150983CD24FB0D6963F7D28E17F72')
    expect(computeHash('MD5', 'abc', { encoding: 'base64' })).toBe('kAFQmDzST7DWlj99KOF/cg==')
  })

  it('HMAC', () => {
    expect(computeHash('MD5', 'what do ya want for nothing?', { hmacKey: 'Jefe' })).toBe('750c783e6ab0b503eaa86e310a5db738')
    expect(computeHash('SHA-256', 'what do ya want for nothing?', { hmacKey: 'Jefe' })).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    )
  })

  it('computeAll 返回全部算法', () => {
    const all = computeAll('abc')
    expect(Object.keys(all)).toHaveLength(6)
    expect(all.MD5).toBe('900150983cd24fb0d6963f7d28e17f72')
  })
})
