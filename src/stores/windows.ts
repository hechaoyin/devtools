import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import { loadJson, saveJson, STORAGE_KEYS } from '@/lib/storage'
import { DOCK_RESERVED, MENU_BAR_HEIGHT, MIN_VISIBLE_X } from '@/lib/layout'
import type { AppDef, WindowState } from '@/types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Viewport {
  w: number
  h: number
}

/** 约束窗口：不小于最小尺寸、不大于视口、标题栏始终位于菜单栏下方且至少有一部分可见 */
export function clampRect(rect: Rect, min: { w: number; h: number }, vp: Viewport): Rect {
  const maxH = Math.max(min.h, vp.h - MENU_BAR_HEIGHT)
  const w = Math.min(Math.max(rect.w, min.w), Math.max(min.w, vp.w))
  const h = Math.min(Math.max(rect.h, min.h), maxH)
  const x = Math.min(Math.max(rect.x, MIN_VISIBLE_X - w), vp.w - MIN_VISIBLE_X)
  const y = Math.min(Math.max(rect.y, MENU_BAR_HEIGHT), vp.h - 40)
  return { x, y, w, h }
}

export function maximizedRect(vp: Viewport): Rect {
  return { x: 0, y: MENU_BAR_HEIGHT, w: vp.w, h: Math.max(200, vp.h - MENU_BAR_HEIGHT - DOCK_RESERVED) }
}

interface PersistedWindows {
  windows: WindowState[]
  zCounter: number
  openCount: number
}

export const useWindowsStore = defineStore('windows', () => {
  const saved = loadJson<Partial<PersistedWindows> | null>(STORAGE_KEYS.windows, null)
  const windows = ref<WindowState[]>(Array.isArray(saved?.windows) ? saved.windows.filter(isWindowState) : [])
  const zCounter = ref(saved?.zCounter ?? windows.value.reduce((m, w) => Math.max(m, w.z), 0))
  const openCount = ref(saved?.openCount ?? 0)
  const viewport = ref<Viewport>({ w: 1280, h: 800 })

  const persist = useDebounceFn(() => {
    saveJson(STORAGE_KEYS.windows, { windows: windows.value, zCounter: zCounter.value, openCount: openCount.value })
  }, 150)
  watch([windows, zCounter, openCount], persist, { deep: true })

  const visible = computed(() => windows.value.filter((w) => !w.minimized))
  /** 最前面的未最小化窗口即为聚焦窗口 */
  const focusedId = computed(() => visible.value.reduce<WindowState | null>((top, w) => (!top || w.z > top.z ? w : top), null)?.appId ?? null)

  const get = (appId: string) => windows.value.find((w) => w.appId === appId)
  const isOpen = (appId: string) => !!get(appId)

  function setViewport(vp: Viewport) {
    viewport.value = vp
  }

  function bringToFront(w: WindowState) {
    w.z = ++zCounter.value
  }

  /** 打开应用；已打开则还原并聚焦（每个应用单实例） */
  function open(app: Pick<AppDef, 'id' | 'defaultSize' | 'minSize'>) {
    const existing = get(app.id)
    if (existing) {
      existing.minimized = false
      bringToFront(existing)
      return existing
    }
    const vp = viewport.value
    const w = Math.min(app.defaultSize.w, vp.w - 40)
    const h = Math.min(app.defaultSize.h, vp.h - MENU_BAR_HEIGHT - DOCK_RESERVED)
    const step = openCount.value++ % 8
    const rect = clampRect(
      {
        x: Math.round((vp.w - w) / 2) + (step - 3) * 28,
        y: Math.round((vp.h - h) / 2 - 24) + (step - 3) * 28,
        w,
        h,
      },
      app.minSize,
      vp,
    )
    const state: WindowState = { appId: app.id, ...rect, z: ++zCounter.value, minimized: false, maximized: false }
    windows.value.push(state)
    return state
  }

  function close(appId: string) {
    windows.value = windows.value.filter((w) => w.appId !== appId)
  }

  function closeAll() {
    windows.value = []
  }

  function minimize(appId: string) {
    const w = get(appId)
    if (w) w.minimized = true
  }

  function minimizeAll() {
    windows.value.forEach((w) => (w.minimized = true))
  }

  function restore(appId: string) {
    const w = get(appId)
    if (!w) return
    w.minimized = false
    bringToFront(w)
  }

  function focus(appId: string) {
    const w = get(appId)
    if (!w) return
    w.minimized = false
    if (focusedId.value !== appId) bringToFront(w)
  }

  function toggleMaximize(appId: string) {
    const w = get(appId)
    if (!w) return
    w.maximized = !w.maximized
    bringToFront(w)
  }

  function setRect(appId: string, rect: Rect, min: { w: number; h: number }) {
    const w = get(appId)
    if (!w) return
    Object.assign(w, clampRect(rect, min, viewport.value))
  }

  /** 视口变化后，重新约束所有未最大化窗口 */
  function reclampAll(minFor: (appId: string) => { w: number; h: number }) {
    for (const w of windows.value) {
      if (!w.maximized) Object.assign(w, clampRect(w, minFor(w.appId), viewport.value))
    }
  }

  /** 丢弃已不存在的应用对应的窗口 */
  function prune(isValid: (appId: string) => boolean) {
    const next = windows.value.filter((w) => isValid(w.appId))
    if (next.length !== windows.value.length) windows.value = next
  }

  return {
    windows,
    viewport,
    focusedId,
    get,
    isOpen,
    setViewport,
    open,
    close,
    closeAll,
    minimize,
    minimizeAll,
    restore,
    focus,
    toggleMaximize,
    setRect,
    reclampAll,
    prune,
  }
})

function isWindowState(w: unknown): w is WindowState {
  if (!w || typeof w !== 'object') return false
  const r = w as Record<string, unknown>
  return (
    typeof r.appId === 'string' &&
    ['x', 'y', 'w', 'h', 'z'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k] as number)) &&
    typeof r.minimized === 'boolean' &&
    typeof r.maximized === 'boolean'
  )
}
