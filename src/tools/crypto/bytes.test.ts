import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64, bytesToHex, CryptoError, decodeData, encodeData, hexToBytes } from './bytes'
import { pad, unpad } from './padding'

describe('编码转换', () => {
  it('Hex 往返，容忍空白与 0x 前缀、大小写', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
    expect([...hexToBytes('0x00 0F\nFf')]).toEqual([0, 15, 255])
  })

  it('Hex 非法输入给出明确错误', () => {
    expect(() => hexToBytes('abc', '密钥')).toThrow('密钥不是有效的 Hex：长度必须为偶数')
    expect(() => hexToBytes('zz', '密钥')).toThrow('非十六进制字符')
  })

  it('Base64 标准 / URL-safe / 缺失填充', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 1])
    expect(bytesToBase64(bytes)).toBe('+//+AQ==')
    expect([...base64ToBytes('+//+AQ==')]).toEqual([...bytes])
    expect([...base64ToBytes('-__-AQ')]).toEqual([...bytes])
    expect(() => base64ToBytes('a$b', '密文')).toThrow('密文不是有效的 Base64')
    expect(() => base64ToBytes('A', '密文')).toThrow('长度不正确')
  })

  it('UTF-8 往返与非法 UTF-8', () => {
    const b = decodeData('你好🌍', 'utf8')
    expect(encodeData(b, 'utf8')).toBe('你好🌍')
    expect(() => encodeData(new Uint8Array([0xff, 0xfe]), 'utf8')).toThrow(CryptoError)
  })
})

describe('填充', () => {
  const data = new Uint8Array([1, 2, 3])
  it('PKCS7', () => {
    const p = pad(data, 8, 'pkcs7')
    expect([...p]).toEqual([1, 2, 3, 5, 5, 5, 5, 5])
    expect([...unpad(p, 8, 'pkcs7')]).toEqual([1, 2, 3])
    expect(pad(new Uint8Array(8), 8, 'pkcs7').length).toBe(16)
  })

  it('PKCS7 非法填充报错', () => {
    expect(() => unpad(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9]), 8, 'pkcs7')).toThrow('PKCS7 去填充失败')
    expect(() => unpad(new Uint8Array([1, 2, 3, 4, 5, 6, 2, 3]), 8, 'pkcs7')).toThrow('PKCS7 去填充失败')
  })

  it('ZeroPadding', () => {
    expect([...pad(data, 4, 'zero')]).toEqual([1, 2, 3, 0])
    expect(pad(new Uint8Array(4), 4, 'zero').length).toBe(4)
    expect([...unpad(new Uint8Array([1, 2, 0, 0]), 4, 'zero')]).toEqual([1, 2])
  })

  it('NoPadding 要求对齐', () => {
    expect(() => pad(data, 8, 'none')).toThrow('NoPadding 要求数据长度为 8 字节的整数倍')
    expect(pad(new Uint8Array(8), 8, 'none').length).toBe(8)
  })
})
