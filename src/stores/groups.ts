import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { loadJson, saveJson, STORAGE_KEYS } from '@/lib/storage'
import { DOCK_RESERVED, GROUP_H, GROUP_NAME_MAX, GROUP_W, MENU_BAR_HEIGHT } from '@/lib/layout'
import { useAppsStore } from './apps'
import { useUiStore } from './ui'
import type { AppGroup } from '@/types'

export interface Viewport {
  w: number
  h: number
}

export type PopoverMode = 'list' | 'picker'

export interface GroupPopoverState {
  groupId: string
  mode: PopoverMode
  /** 通过菜单打开时保持展开，直到指针进入过弹层或点击外部 */
  sticky: boolean
}

const EDGE = 12
const CLOSE_DELAY = 180

/** 约束图标位置：整个图标位于菜单栏下方、Dock 上方、视口之内 */
export function clampGroupPos(x: number, y: number, vp: Viewport): { x: number; y: number } {
  const maxX = Math.max(0, vp.w - GROUP_W)
  const minY = MENU_BAR_HEIGHT + 4
  const maxY = Math.max(minY, vp.h - DOCK_RESERVED - GROUP_H)
  return { x: Math.round(Math.min(Math.max(x, 0), maxX)), y: Math.round(Math.min(Math.max(y, minY), maxY)) }
}

/** 类似 macOS 桌面：从右上角开始，先纵向后向左，找第一个未被占用的格子 */
export function findFreeSlot(occupied: { x: number; y: number }[], vp: Viewport): { x: number; y: number } {
  const taken = (x: number, y: number) => occupied.some((o) => Math.abs(o.x - x) < GROUP_W * 0.6 && Math.abs(o.y - y) < GROUP_H * 0.6)
  const rows = Math.max(1, Math.floor((vp.h - DOCK_RESERVED - MENU_BAR_HEIGHT - EDGE) / GROUP_H))
  const cols = Math.max(1, Math.floor((vp.w - EDGE) / GROUP_W))
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = vp.w - GROUP_W - EDGE - c * GROUP_W
      const y = MENU_BAR_HEIGHT + EDGE + r * GROUP_H
      if (!taken(x, y)) return clampGroupPos(x, y, vp)
    }
  }
  return clampGroupPos(vp.w - GROUP_W - EDGE, MENU_BAR_HEIGHT + EDGE, vp)
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, GROUP_NAME_MAX)
}

function sanitizeGroups(raw: unknown): AppGroup[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: AppGroup[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const g = item as Partial<AppGroup>
    if (typeof g.id !== 'string' || !g.id || seen.has(g.id)) continue
    if (typeof g.x !== 'number' || typeof g.y !== 'number' || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue
    seen.add(g.id)
    out.push({
      id: g.id,
      name: normalizeName(typeof g.name === 'string' ? g.name : '') || '未命名组',
      appIds: Array.isArray(g.appIds) ? [...new Set(g.appIds.filter((a): a is string => typeof a === 'string'))] : [],
      x: g.x,
      y: g.y,
    })
  }
  return out
}

const newId = () => `group-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const useGroupsStore = defineStore('groups', () => {
  const apps = useAppsStore()
  const ui = useUiStore()

  const groups = ref<AppGroup[]>(sanitizeGroups(loadJson<{ groups?: unknown } | null>(STORAGE_KEYS.groups, null)?.groups))
  const viewport = ref<Viewport>({ w: 1280, h: 800 })

  const popover = ref<GroupPopoverState | null>(null)
  const renamingId = ref<string | null>(null)
  const draggingId = ref<string | null>(null)
  /** 组内图标按下到松手期间为 true，避免拖出弹层时被收起或切到其他组 */
  const holding = ref(false)
  let pointerInside = false
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  watch(groups, () => saveJson(STORAGE_KEYS.groups, { groups: groups.value }), { deep: true })

  const get = (id: string) => groups.value.find((g) => g.id === id)

  /** 卸载/删除应用后，从所有组里移除失效的应用 */
  function pruneApps() {
    for (const g of groups.value) {
      const kept = g.appIds.filter((id) => apps.isInstalled(id))
      if (kept.length !== g.appIds.length) g.appIds = kept
    }
  }
  pruneApps()
  watch(() => [apps.order.length, apps.customTools.length, ...apps.order], pruneApps)

  function setViewport(vp: Viewport) {
    viewport.value = vp
    for (const g of groups.value) {
      const p = clampGroupPos(g.x, g.y, vp)
      if (p.x !== g.x || p.y !== g.y) {
        g.x = p.x
        g.y = p.y
      }
    }
  }

  function uniqueName(base: string): string {
    const names = new Set(groups.value.map((g) => g.name))
    if (!names.has(base)) return base
    let n = 2
    while (names.has(`${base} ${n}`)) n++
    return `${base} ${n}`
  }

  /** 创建组；传入 at 时以该点为图标中心，否则放到第一个空位 */
  function create(opts: { name?: string; at?: { x: number; y: number }; appIds?: string[] } = {}): string {
    const pos = opts.at
      ? clampGroupPos(opts.at.x - GROUP_W / 2, opts.at.y - GROUP_H / 3, viewport.value)
      : findFreeSlot(groups.value, viewport.value)
    const group: AppGroup = {
      id: newId(),
      name: normalizeName(opts.name ?? '') || uniqueName('新建组'),
      appIds: [...new Set((opts.appIds ?? []).filter((id) => apps.isInstalled(id)))],
      x: pos.x,
      y: pos.y,
    }
    groups.value.push(group)
    return group.id
  }

  /** 创建后立即进入重命名，类似 Finder 新建文件夹 */
  function createAndRename(at?: { x: number; y: number }): string {
    const id = create({ at })
    closePopover()
    renamingId.value = id
    return id
  }

  function rename(id: string, name: string): boolean {
    const g = get(id)
    const next = normalizeName(name)
    if (!g || !next) return false
    g.name = next
    return true
  }

  function remove(id: string) {
    groups.value = groups.value.filter((g) => g.id !== id)
    if (popover.value?.groupId === id) closePopover()
    if (renamingId.value === id) renamingId.value = null
  }

  function addApp(id: string, appId: string): boolean {
    const g = get(id)
    if (!g || !apps.isInstalled(appId) || g.appIds.includes(appId)) return false
    g.appIds.push(appId)
    return true
  }

  function removeApp(id: string, appId: string) {
    const g = get(id)
    if (g) g.appIds = g.appIds.filter((a) => a !== appId)
  }

  function toggleApp(id: string, appId: string) {
    const g = get(id)
    if (!g) return
    if (g.appIds.includes(appId)) removeApp(id, appId)
    else addApp(id, appId)
  }

  /** 将组内应用移到 toIndex。下标按移动前的顺序计算，应用最终落在该位置。 */
  function moveApp(id: string, appId: string, toIndex: number): boolean {
    const g = get(id)
    if (!g || !Number.isFinite(toIndex)) return false
    const from = g.appIds.indexOf(appId)
    if (from < 0) return false
    const to = Math.max(0, Math.min(Math.round(toIndex), g.appIds.length - 1))
    if (from === to) return false
    const next = g.appIds.slice()
    next.splice(from, 1)
    next.splice(to, 0, appId)
    g.appIds = next
    return true
  }

  function moveTo(id: string, x: number, y: number) {
    const g = get(id)
    if (!g) return
    const p = clampGroupPos(x, y, viewport.value)
    g.x = p.x
    g.y = p.y
  }

  function clearCloseTimer() {
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = undefined
  }

  function closePopover() {
    clearCloseTimer()
    pointerInside = false
    popover.value = null
  }

  function scheduleClose() {
    clearCloseTimer()
    closeTimer = setTimeout(() => {
      if (pointerInside || ui.contextMenu) return
      popover.value = null
    }, CLOSE_DELAY)
  }

  /** 指针进入组图标或弹层 */
  function pointerEnter(groupId: string) {
    if (draggingId.value || holding.value || renamingId.value === groupId || !get(groupId)) return
    clearCloseTimer()
    pointerInside = true
    if (popover.value?.groupId === groupId) {
      popover.value.sticky = false
    } else {
      popover.value = { groupId, mode: 'list', sticky: false }
    }
  }

  /** 指针离开组图标或弹层 */
  function pointerLeave() {
    pointerInside = false
    if (popover.value?.sticky || holding.value) return
    scheduleClose()
  }

  /** 组内图标按下：按住期间不收起、不切换弹层 */
  function holdPopover() {
    holding.value = true
    clearCloseTimer()
  }

  /** 松手后恢复悬停关闭；指针已在外面且非粘滞时再安排关闭 */
  function releasePopover() {
    if (!holding.value) return
    holding.value = false
    if (popover.value && !pointerInside && !popover.value.sticky) scheduleClose()
  }

  /** 右键菜单等入口：直接展开并保持，直到点击外部 */
  function openPopover(groupId: string, mode: PopoverMode = 'list') {
    if (!get(groupId)) return
    clearCloseTimer()
    pointerInside = false
    popover.value = { groupId, mode, sticky: true }
  }

  function setMode(mode: PopoverMode) {
    if (popover.value) popover.value.mode = mode
  }

  function startRename(id: string) {
    if (!get(id)) return
    closePopover()
    renamingId.value = id
  }

  function finishRename(commit: boolean, name?: string) {
    const id = renamingId.value
    if (!id) return
    renamingId.value = null
    if (commit && name !== undefined) rename(id, name)
  }

  watch(
    () => ui.contextMenu,
    (menu) => {
      if (!menu && popover.value && !holding.value && !pointerInside && !popover.value.sticky) scheduleClose()
    },
  )

  return {
    groups,
    viewport,
    popover,
    renamingId,
    draggingId,
    holding,
    get,
    setViewport,
    create,
    createAndRename,
    rename,
    remove,
    addApp,
    removeApp,
    toggleApp,
    moveApp,
    moveTo,
    closePopover,
    pointerEnter,
    pointerLeave,
    openPopover,
    holdPopover,
    releasePopover,
    setMode,
    startRename,
    finishRename,
  }
})
