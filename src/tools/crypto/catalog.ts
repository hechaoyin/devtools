import type { SymmetricAlgorithm } from './types'

export type PanelKind = 'symmetric' | 'rsa' | 'hmac' | 'sm2' | 'sm3'

export interface AlgoEntry {
  id: string
  label: string
  panel: PanelKind
  /** 同一 key 的面板共享状态（如 AES-128 → AES-256 保留输入与密钥） */
  panelKey: string
  algorithm?: SymmetricAlgorithm
  description: string
}

export interface CategoryEntry {
  id: string
  label: string
  algos: AlgoEntry[]
}

const sym = (algorithm: SymmetricAlgorithm, description: string, panelKey = 'symmetric'): AlgoEntry => ({
  id: algorithm,
  label: algorithm,
  panel: 'symmetric',
  panelKey,
  algorithm,
  description,
})

export const CATEGORIES: CategoryEntry[] = [
  {
    id: 'symmetric',
    label: '对称加密',
    algos: [
      sym('AES-128', 'ECB / CBC / CTR / CFB / OFB / GCM'),
      sym('AES-192', 'ECB / CBC / CTR / CFB / OFB / GCM'),
      sym('AES-256', 'ECB / CBC / CTR / CFB / OFB / GCM'),
      sym('DES', 'ECB / CBC / CTR / CFB / OFB（已不安全，仅用于兼容）'),
      sym('3DES', 'ECB / CBC / CTR / CFB / OFB，16 或 24 字节密钥'),
      sym('RC4', '流密码，已不安全，仅用于兼容'),
    ],
  },
  {
    id: 'asymmetric',
    label: '非对称加密',
    algos: [{ id: 'RSA', label: 'RSA', panel: 'rsa', panelKey: 'rsa', description: '密钥对生成、加解密、签名验签' }],
  },
  {
    id: 'mac',
    label: '消息认证',
    algos: [{ id: 'HMAC', label: 'HMAC', panel: 'hmac', panelKey: 'hmac', description: 'HMAC-MD5 / SHA 系列 / SM3' }],
  },
  {
    id: 'gm',
    label: '国密',
    algos: [
      { id: 'SM2', label: 'SM2', panel: 'sm2', panelKey: 'sm2', description: '椭圆曲线：密钥对、加解密、签名验签' },
      { id: 'SM3', label: 'SM3', panel: 'sm3', panelKey: 'sm3', description: '杂凑算法与 HMAC-SM3' },
      sym('SM4', 'ECB / CBC / CTR / GCM', 'sm4'),
    ],
  },
]
