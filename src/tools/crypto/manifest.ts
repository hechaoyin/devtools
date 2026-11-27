import { LockKeyhole } from 'lucide-vue-next'
import type { BuiltinToolManifest } from '@/types'

export const cryptoTool: BuiltinToolManifest = {
  id: 'crypto',
  name: '加解密',
  description: 'AES / DES / 3DES / RC4、RSA、HMAC 与国密 SM2 / SM3 / SM4，本地运算',
  category: '加密与编码',
  icon: LockKeyhole,
  color: 'red',
  defaultSize: { w: 980, h: 700 },
  minSize: { w: 700, h: 480 },
  component: () => import('./CryptoTool.vue'),
}
