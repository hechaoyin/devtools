import { Binary, Clock, FileCode2, Fingerprint, Link2 } from 'lucide-vue-next'
import type { BuiltinToolManifest } from '@/types'
import { jsonTool } from './json/manifest'

/** 内置工具注册表：新增工具只需在 src/tools/<id>/ 添加视图并在此追加一项 */
export const BUILTIN_TOOLS: BuiltinToolManifest[] = [
  jsonTool,
  {
    id: 'xml',
    name: 'XML 工具',
    description: 'XML 格式化、压缩与良构性校验',
    category: '数据格式',
    icon: FileCode2,
    color: 'teal',
    defaultSize: { w: 860, h: 560 },
    minSize: { w: 520, h: 360 },
    component: () => import('./xml/XmlTool.vue'),
  },
  {
    id: 'hash',
    name: '哈希计算',
    description: 'MD5 / SHA-1 / SHA-2 摘要与 HMAC',
    category: '加密与编码',
    icon: Fingerprint,
    color: 'purple',
    defaultSize: { w: 720, h: 560 },
    minSize: { w: 480, h: 400 },
    component: () => import('./hash/HashTool.vue'),
  },
  {
    id: 'base64',
    name: 'Base64',
    description: 'UTF-8 安全的 Base64 编解码，支持 URL-safe',
    category: '加密与编码',
    icon: Binary,
    color: 'indigo',
    defaultSize: { w: 760, h: 480 },
    minSize: { w: 480, h: 340 },
    component: () => import('./base64/Base64Tool.vue'),
  },
  {
    id: 'url',
    name: 'URL 编解码',
    description: 'encodeURIComponent / encodeURI 与查询参数解析',
    category: '加密与编码',
    icon: Link2,
    color: 'blue',
    defaultSize: { w: 760, h: 540 },
    minSize: { w: 480, h: 380 },
    component: () => import('./url/UrlTool.vue'),
  },
  {
    id: 'timestamp',
    name: '时间戳转换',
    description: '时间戳与日期互转，支持多时区',
    category: '时间日期',
    icon: Clock,
    color: 'green',
    defaultSize: { w: 700, h: 620 },
    minSize: { w: 480, h: 400 },
    component: () => import('./timestamp/TimestampTool.vue'),
  },
]

export const BUILTIN_IDS = BUILTIN_TOOLS.map((t) => t.id)
export const getBuiltin = (id: string) => BUILTIN_TOOLS.find((t) => t.id === id)
