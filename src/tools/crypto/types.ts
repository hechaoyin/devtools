/** 数据在界面上的文本表示方式 */
export type DataEncoding = 'utf8' | 'hex' | 'base64'

/** 仅 Hex / Base64 的输出（密文、签名等二进制结果） */
export type BinaryEncoding = 'hex' | 'base64'

export type Direction = 'encrypt' | 'decrypt'

export type SymmetricAlgorithm = 'AES-128' | 'AES-192' | 'AES-256' | 'DES' | '3DES' | 'RC4' | 'SM4'

export type CipherMode = 'ECB' | 'CBC' | 'CTR' | 'CFB' | 'OFB' | 'GCM'

export type PaddingMode = 'pkcs7' | 'zero' | 'none'

export interface SymmetricInfo {
  label: string
  /** 块大小（字节）；流密码为 0 */
  blockSize: number
  /** 允许的密钥长度（字节） */
  keySizes: number[]
  modes: CipherMode[]
}

export interface SymmetricParams {
  algorithm: SymmetricAlgorithm
  mode: CipherMode
  padding: PaddingMode
  direction: Direction
  key: Uint8Array
  iv?: Uint8Array
  /** GCM 附加认证数据 */
  aad?: Uint8Array
  data: Uint8Array
}

export interface SymmetricTextParams {
  algorithm: SymmetricAlgorithm
  mode: CipherMode
  padding: PaddingMode
  direction: Direction
  key: string
  keyEncoding: DataEncoding
  iv: string
  ivEncoding: DataEncoding
  aad: string
  aadEncoding: DataEncoding
  input: string
  inputEncoding: DataEncoding
  outputEncoding: DataEncoding
}

export type HashName = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export type RsaKeyFormat = 'pkcs8' | 'pkcs1'

export interface RsaKeyPair {
  publicKey: string
  privateKey: string
}

export type RsaEncryptPadding =
  | { scheme: 'pkcs1' }
  | { scheme: 'oaep'; hash: HashName; mgf1Hash: HashName }

export type RsaSignScheme = { scheme: 'pkcs1'; hash: HashName } | { scheme: 'pss'; hash: HashName; saltLength?: number }

export type Sm2CipherMode = 'C1C3C2' | 'C1C2C3'

export interface Sm2CipherOptions {
  mode: Sm2CipherMode
  /** raw：C1||C3||C2 直接拼接；asn1：DER 编码 */
  format: 'raw' | 'asn1'
  /** 加密时是否在 C1 前补 04 前缀（BouncyCastle 等的输出形式） */
  c1Prefix?: boolean
}

export interface Sm2SignOptions {
  userId: string
  /** true 输出 DER 编码，false 输出 r||s */
  der: boolean
}
