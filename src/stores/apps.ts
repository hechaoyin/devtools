import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { Settings, Store } from 'lucide-vue-next'
import { BUILTIN_IDS, BUILTIN_TOOLS, getBuiltin } from '@/tools/registry'
import { loadJson, saveJson, STORAGE_KEYS } from '@/lib/storage'
import { buildConfig, parseConfig, type ToolboxConfig } from '@/lib/customTools'
import type { AppDef, CustomTool } from '@/types'

export const APP_MANAGER_ID = 'system.apps'
export const SETTINGS_ID = 'system.settings'

const DEFAULT_MIN = { w: 360, h: 240 }

export const SYSTEM_APPS: AppDef[] = [
  {
    id: APP_MANAGER_ID,
    name: '应用管理器',
    description: '安装、卸载、排序与自定义工具',
    category: '系统',
    kind: 'system',
    icon: Store,
    color: 'blue',
    defaultSize: { w: 880, h: 580 },
    minSize: { w: 640, h: 420 },
    loader: () => import('@/components/AppManager.vue'),
  },
  {
    id: SETTINGS_ID,
    name: '系统设置',
    description: '外观与壁纸',
    category: '系统',
    kind: 'system',
    icon: Settings,
    color: 'graphite',
    defaultSize: { w: 640, h: 480 },
    minSize: { w: 520, h: 380 },
    loader: () => import('@/components/SettingsPanel.vue'),
  },
]

interface PersistedApps {
  order: string[]
  pinned: string[]
  customTools: CustomTool[]
}

const dedupe = (ids: string[]) => [...new Set(ids)]

function builtinToDef(id: string): AppDef | undefined {
  const t = getBuiltin(id)
  if (!t) return undefined
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    kind: 'builtin',
    icon: t.icon,
    color: t.color,
    defaultSize: t.defaultSize,
    minSize: t.minSize ?? DEFAULT_MIN,
    loader: t.component,
  }
}

function customToDef(t: CustomTool): AppDef {
  return {
    id: t.id,
    name: t.name,
    description: t.type === 'url' ? (t.url ?? '') : '自定义代码工具（沙箱运行）',
    category: '自定义',
    kind: t.type,
    icon: t.icon,
    color: t.color,
    defaultSize: t.type === 'url' ? { w: 960, h: 620 } : { w: 760, h: 520 },
    minSize: { w: 360, h: 260 },
    custom: t,
  }
}

export const useAppsStore = defineStore('apps', () => {
  const saved = loadJson<Partial<PersistedApps> | null>(STORAGE_KEYS.apps, null)
  const customTools = ref<CustomTool[]>(Array.isArray(saved?.customTools) ? saved.customTools : [])
  const order = ref<string[]>(saved?.order ? dedupe(saved.order) : [...BUILTIN_IDS])
  const pinned = ref<string[]>(saved?.pinned ? dedupe(saved.pinned) : [...BUILTIN_IDS])

  function sanitize() {
    const customIds = new Set(customTools.value.map((t) => t.id))
    const valid = (id: string) => BUILTIN_IDS.includes(id) || customIds.has(id)
    order.value = dedupe(order.value.filter(valid))
    for (const id of customIds) if (!order.value.includes(id)) order.value.push(id)
    pinned.value = dedupe(pinned.value.filter((id) => order.value.includes(id)))
  }
  sanitize()

  watch(
    [order, pinned, customTools],
    () => saveJson(STORAGE_KEYS.apps, { order: order.value, pinned: pinned.value, customTools: customTools.value }),
    { deep: true },
  )

  const customMap = computed(() => new Map(customTools.value.map((t) => [t.id, t])))

  function resolve(id: string): AppDef | undefined {
    const sys = SYSTEM_APPS.find((a) => a.id === id)
    if (sys) return sys
    const custom = customMap.value.get(id)
    return custom ? customToDef(custom) : builtinToDef(id)
  }

  /** 已安装的工具（按用户排序），不含系统应用 */
  const installedApps = computed(() => order.value.map(resolve).filter((a): a is AppDef => !!a))
  /** Dock 中固定的工具 */
  const pinnedApps = computed(() => pinned.value.map(resolve).filter((a): a is AppDef => !!a))
  /** 内置商店中尚未安装的内置工具 */
  const availableBuiltins = computed(() => BUILTIN_TOOLS.filter((t) => !order.value.includes(t.id)).map((t) => builtinToDef(t.id)!))
  const allBuiltins = computed(() => BUILTIN_TOOLS.map((t) => builtinToDef(t.id)!))

  const isInstalled = (id: string) => order.value.includes(id)
  const isPinned = (id: string) => pinned.value.includes(id)

  function install(id: string) {
    if (!getBuiltin(id) || isInstalled(id)) return
    order.value.push(id)
    pinned.value.push(id)
  }

  /** 卸载内置工具；自定义工具请用 removeCustom */
  function uninstall(id: string) {
    order.value = order.value.filter((x) => x !== id)
    pinned.value = pinned.value.filter((x) => x !== id)
  }

  function togglePin(id: string) {
    if (!isInstalled(id)) return
    pinned.value = isPinned(id) ? pinned.value.filter((x) => x !== id) : [...pinned.value, id]
  }

  function move(id: string, toIndex: number) {
    const from = order.value.indexOf(id)
    if (from === -1) return
    const next = [...order.value]
    next.splice(from, 1)
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id)
    order.value = next
    // Dock 中固定项跟随总体顺序
    pinned.value = next.filter((x) => pinned.value.includes(x))
  }

  function addCustom(tool: CustomTool) {
    customTools.value.push(tool)
    order.value.push(tool.id)
    pinned.value.push(tool.id)
  }

  function updateCustom(tool: CustomTool) {
    const i = customTools.value.findIndex((t) => t.id === tool.id)
    if (i !== -1) customTools.value[i] = tool
  }

  function removeCustom(id: string) {
    customTools.value = customTools.value.filter((t) => t.id !== id)
    uninstall(id)
  }

  function exportConfig(): ToolboxConfig {
    return buildConfig({ order: order.value, pinned: pinned.value, customTools: customTools.value })
  }

  /** 覆盖导入；返回被跳过的非法工具数 */
  function importConfig(text: string, origin?: string): { ok: true; skipped: number } | { ok: false; error: string } {
    const parsed = parseConfig(text, origin)
    if (!parsed.ok) return parsed
    customTools.value = parsed.config.customTools
    order.value = parsed.config.order
    pinned.value = parsed.config.pinned
    sanitize()
    return { ok: true, skipped: parsed.skipped }
  }

  function resetDefaults() {
    customTools.value = []
    order.value = [...BUILTIN_IDS]
    pinned.value = [...BUILTIN_IDS]
  }

  return {
    customTools,
    order,
    pinned,
    installedApps,
    pinnedApps,
    availableBuiltins,
    allBuiltins,
    resolve,
    isInstalled,
    isPinned,
    install,
    uninstall,
    togglePin,
    move,
    addCustom,
    updateCustom,
    removeCustom,
    exportConfig,
    importConfig,
    resetDefaults,
  }
})
