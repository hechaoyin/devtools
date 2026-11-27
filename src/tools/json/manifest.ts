import { Braces } from 'lucide-vue-next'
import type { BuiltinToolManifest } from '@/types'

export const jsonTool: BuiltinToolManifest = {
  id: 'json',
  name: 'JSON 工具',
  description: '格式化（容错定位）、树视图、压缩、校验、转义、转 XML',
  category: '数据格式',
  icon: Braces,
  color: 'orange',
  defaultSize: { w: 940, h: 600 },
  minSize: { w: 560, h: 380 },
  component: () => import('./JsonTool.vue'),
}
