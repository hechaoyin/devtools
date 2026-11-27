import type { Component } from 'vue'

export type CustomToolType = 'url' | 'code'

export interface CustomTool {
  id: string
  name: string
  /** 单个 emoji 或最多 2 个字符 */
  icon: string
  /** 图标底板渐变色 id，见 lib/colors */
  color: string
  type: CustomToolType
  url?: string
  html?: string
  css?: string
  js?: string
  createdAt: number
  updatedAt: number
}

export interface BuiltinToolManifest {
  id: string
  name: string
  description: string
  category: string
  icon: Component
  color: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  component: () => Promise<{ default: Component }>
}

/** 运行时统一的应用描述（内置工具 / 自定义工具 / 系统应用） */
export interface AppDef {
  id: string
  name: string
  description: string
  category: string
  kind: 'builtin' | 'url' | 'code' | 'system'
  /** lucide 图标组件或 emoji 文本 */
  icon: Component | string
  color: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  loader?: () => Promise<{ default: Component }>
  custom?: CustomTool
}

export interface WindowState {
  appId: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
}

/** 桌面应用组：名称、包含的应用 id、桌面位置 */
export interface AppGroup {
  id: string
  name: string
  appIds: string[]
  x: number
  y: number
}
