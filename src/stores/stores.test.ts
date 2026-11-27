// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clampRect, maximizedRect, useWindowsStore } from './windows'
import { useAppsStore } from './apps'
import { draftToTool } from '@/lib/customTools'
import { MENU_BAR_HEIGHT } from '@/lib/layout'

const VP = { w: 1280, h: 800 }
const MIN = { w: 300, h: 200 }
const app = (id: string) => ({ id, defaultSize: { w: 600, h: 400 }, minSize: MIN })

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('clampRect', () => {
  it('不允许窗口顶部进入菜单栏', () => {
    expect(clampRect({ x: 10, y: -50, w: 500, h: 400 }, MIN, VP).y).toBe(MENU_BAR_HEIGHT)
  })
  it('至少保留一部分在屏幕内', () => {
    const r = clampRect({ x: 5000, y: 5000, w: 500, h: 400 }, MIN, VP)
    expect(r.x).toBeLessThan(VP.w)
    expect(r.y).toBeLessThan(VP.h)
    const l = clampRect({ x: -5000, y: 100, w: 500, h: 400 }, MIN, VP)
    expect(l.x + l.w).toBeGreaterThan(0)
  })
  it('遵守最小尺寸与视口上限', () => {
    const r = clampRect({ x: 0, y: 100, w: 10, h: 10 }, MIN, VP)
    expect([r.w, r.h]).toEqual([300, 200])
    const big = clampRect({ x: 0, y: 100, w: 9999, h: 9999 }, MIN, VP)
    expect(big.w).toBe(VP.w)
    expect(big.h).toBe(VP.h - MENU_BAR_HEIGHT)
  })
  it('最大化矩形从菜单栏下方开始', () => {
    expect(maximizedRect(VP)).toMatchObject({ x: 0, y: MENU_BAR_HEIGHT, w: VP.w })
  })
})

describe('windows store', () => {
  it('打开、层级与聚焦', () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.open(app('b'))
    expect(s.windows).toHaveLength(2)
    expect(s.focusedId).toBe('b')
    s.focus('a')
    expect(s.focusedId).toBe('a')
    expect(s.get('a')!.z).toBeGreaterThan(s.get('b')!.z)
  })

  it('重复打开同一应用只保留一个窗口并还原', () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.minimize('a')
    expect(s.focusedId).toBeNull()
    s.open(app('a'))
    expect(s.windows).toHaveLength(1)
    expect(s.get('a')!.minimized).toBe(false)
  })

  it('最小化后焦点切换到下一个窗口', () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.open(app('b'))
    s.minimize('b')
    expect(s.focusedId).toBe('a')
  })

  it('最大化切换与关闭', () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.toggleMaximize('a')
    expect(s.get('a')!.maximized).toBe(true)
    s.toggleMaximize('a')
    expect(s.get('a')!.maximized).toBe(false)
    s.close('a')
    expect(s.isOpen('a')).toBe(false)
  })

  it('移动/缩放会被约束', () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.setRect('a', { x: 0, y: -100, w: 50, h: 50 }, MIN)
    expect(s.get('a')).toMatchObject({ y: MENU_BAR_HEIGHT, w: 300, h: 200 })
  })

  it('状态持久化并可恢复', async () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.open(app('b'))
    s.minimize('b')
    await new Promise((r) => setTimeout(r, 400))
    setActivePinia(createPinia())
    const restored = useWindowsStore()
    expect(restored.windows.map((w) => w.appId)).toEqual(['a', 'b'])
    expect(restored.get('b')!.minimized).toBe(true)
    expect(restored.focusedId).toBe('a')
  })

  it('损坏的持久化数据被忽略', () => {
    localStorage.setItem('toolbox:windows:v1', JSON.stringify({ windows: [{ appId: 1 }, null, 'x'] }))
    setActivePinia(createPinia())
    expect(useWindowsStore().windows).toEqual([])
  })

  it('prune 移除失效应用的窗口', () => {
    const s = useWindowsStore()
    s.open(app('a'))
    s.open(app('b'))
    s.prune((id) => id === 'a')
    expect(s.windows.map((w) => w.appId)).toEqual(['a'])
  })
})

describe('apps store', () => {
  it('默认安装全部内置工具并固定到 Dock', () => {
    const s = useAppsStore()
    expect(s.installedApps.map((a) => a.id)).toEqual(['json', 'xml', 'hash', 'crypto', 'base64', 'url', 'timestamp'])
    expect(s.pinnedApps).toHaveLength(7)
  })

  it('卸载与重新安装内置工具', () => {
    const s = useAppsStore()
    s.uninstall('xml')
    expect(s.isInstalled('xml')).toBe(false)
    expect(s.availableBuiltins.map((a) => a.id)).toEqual(['xml'])
    expect(s.pinnedApps.find((a) => a.id === 'xml')).toBeUndefined()
    s.install('xml')
    expect(s.installedApps.at(-1)!.id).toBe('xml')
    s.install('nope')
    expect(s.isInstalled('nope')).toBe(false)
  })

  it('排序同步影响 Dock', () => {
    const s = useAppsStore()
    s.move('timestamp', 0)
    expect(s.order[0]).toBe('timestamp')
    expect(s.pinned[0]).toBe('timestamp')
    s.togglePin('json')
    expect(s.isPinned('json')).toBe(false)
  })

  it('自定义工具增删改', () => {
    const s = useAppsStore()
    const t = draftToTool({ name: 'My', icon: '🔥', color: 'red', type: 'code', html: '<p/>' }, undefined)
    s.addCustom(t)
    expect(s.resolve(t.id)).toMatchObject({ name: 'My', kind: 'code', icon: '🔥' })
    s.updateCustom({ ...t, name: 'Renamed' })
    expect(s.resolve(t.id)!.name).toBe('Renamed')
    s.removeCustom(t.id)
    expect(s.resolve(t.id)).toBeUndefined()
    expect(s.order).not.toContain(t.id)
  })

  it('配置导出后可导入恢复', () => {
    const s = useAppsStore()
    const t = draftToTool({ name: 'Web', icon: '🌐', color: 'blue', type: 'url', url: 'a.com' }, 'https://a.com/')
    s.addCustom(t)
    s.uninstall('json')
    const text = JSON.stringify(s.exportConfig())
    s.resetDefaults()
    expect(s.customTools).toHaveLength(0)
    const r = s.importConfig(text)
    expect(r).toEqual({ ok: true, skipped: 0 })
    expect(s.customTools.map((x) => x.id)).toEqual([t.id])
    expect(s.isInstalled('json')).toBe(false)
    expect(s.isInstalled(t.id)).toBe(true)
  })

  it('导入非法文件不改变状态', () => {
    const s = useAppsStore()
    const before = [...s.order]
    expect(s.importConfig('garbage').ok).toBe(false)
    expect(s.order).toEqual(before)
  })

  it('持久化到 localStorage', async () => {
    const s = useAppsStore()
    s.uninstall('url')
    await new Promise((r) => setTimeout(r, 20))
    setActivePinia(createPinia())
    expect(useAppsStore().isInstalled('url')).toBe(false)
  })
})
