// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clampGroupPos, findFreeSlot, useGroupsStore } from './groups'
import { useAppsStore } from './apps'
import { useUiStore } from './ui'
import { DOCK_RESERVED, GROUP_H, GROUP_W, MENU_BAR_HEIGHT } from '@/lib/layout'

const VP = { w: 1280, h: 800 }
const tick = () => new Promise((r) => setTimeout(r, 20))

function fresh() {
  setActivePinia(createPinia())
  const s = useGroupsStore()
  s.setViewport(VP)
  return s
}

beforeEach(() => {
  localStorage.clear()
})

describe('位置计算', () => {
  it('约束在菜单栏下方、Dock 上方、视口内', () => {
    expect(clampGroupPos(-50, -50, VP)).toEqual({ x: 0, y: MENU_BAR_HEIGHT + 4 })
    const p = clampGroupPos(9999, 9999, VP)
    expect(p.x).toBe(VP.w - GROUP_W)
    expect(p.y).toBe(VP.h - DOCK_RESERVED - GROUP_H)
  })

  it('空位从右上角开始，先纵向再向左，避开已占用的格子', () => {
    const first = findFreeSlot([], VP)
    expect(first.x).toBeGreaterThan(VP.w - GROUP_W * 1.5)
    const second = findFreeSlot([first], VP)
    expect(second.x).toBe(first.x)
    expect(second.y).toBeGreaterThan(first.y)
    const rows = Math.floor((VP.h - DOCK_RESERVED - MENU_BAR_HEIGHT - 12) / GROUP_H)
    const column = Array.from({ length: rows }, (_, i) => ({ x: first.x, y: first.y + i * GROUP_H }))
    expect(findFreeSlot(column, VP).x).toBeLessThan(first.x)
  })
})

describe('groups store', () => {
  it('创建组：默认名称不重复，位置不重叠', () => {
    const s = fresh()
    const a = s.create()
    const b = s.create()
    expect(s.get(a)!.name).toBe('新建组')
    expect(s.get(b)!.name).toBe('新建组 2')
    expect([s.get(a)!.x, s.get(a)!.y]).not.toEqual([s.get(b)!.x, s.get(b)!.y])
  })

  it('在指定位置创建时以该点为中心并被约束', () => {
    const s = fresh()
    const id = s.create({ at: { x: 400, y: 300 } })
    expect(s.get(id)!.x).toBe(400 - GROUP_W / 2)
    const edge = s.create({ at: { x: 5000, y: 5000 } })
    expect(s.get(edge)!.x).toBe(VP.w - GROUP_W)
  })

  it('重命名：去除首尾空白，空名称被拒绝', () => {
    const s = fresh()
    const id = s.create()
    expect(s.rename(id, '  开发  工具 ')).toBe(true)
    expect(s.get(id)!.name).toBe('开发 工具')
    expect(s.rename(id, '   ')).toBe(false)
    expect(s.get(id)!.name).toBe('开发 工具')
  })

  it('进入重命名后可提交或取消', () => {
    const s = fresh()
    const id = s.createAndRename()
    expect(s.renamingId).toBe(id)
    s.finishRename(false)
    expect(s.get(id)!.name).toBe('新建组')
    s.startRename(id)
    s.finishRename(true, 'Web')
    expect(s.get(id)!.name).toBe('Web')
    expect(s.renamingId).toBeNull()
  })

  it('组内增删应用：只能添加已安装且不重复的应用', () => {
    const s = fresh()
    const id = s.create()
    expect(s.addApp(id, 'json')).toBe(true)
    expect(s.addApp(id, 'json')).toBe(false)
    expect(s.addApp(id, 'not-installed')).toBe(false)
    s.toggleApp(id, 'xml')
    expect(s.get(id)!.appIds).toEqual(['json', 'xml'])
    s.toggleApp(id, 'json')
    s.removeApp(id, 'xml')
    expect(s.get(id)!.appIds).toEqual([])
  })

  it('删除组', () => {
    const s = fresh()
    const a = s.create()
    const b = s.create()
    s.openPopover(a)
    s.remove(a)
    expect(s.groups.map((g) => g.id)).toEqual([b])
    expect(s.popover).toBeNull()
  })

  it('组内应用可调整顺序，结果会持久化', async () => {
    const s = fresh()
    const id = s.create({ appIds: ['json', 'xml', 'hash', 'url'] })
    expect(s.moveApp(id, 'json', 2)).toBe(true)
    expect(s.get(id)!.appIds).toEqual(['xml', 'hash', 'json', 'url'])
    expect(s.moveApp(id, 'url', 0)).toBe(true)
    expect(s.get(id)!.appIds).toEqual(['url', 'xml', 'hash', 'json'])
    expect(s.moveApp(id, 'xml', 99)).toBe(true)
    expect(s.get(id)!.appIds).toEqual(['url', 'hash', 'json', 'xml'])
    expect(s.moveApp(id, 'xml', 3)).toBe(false)
    expect(s.moveApp(id, 'nope', 0)).toBe(false)
    expect(s.moveApp('missing', 'url', 0)).toBe(false)
    await tick()
    expect(fresh().get(id)!.appIds).toEqual(['url', 'hash', 'json', 'xml'])
  })

  it('按住组内应用时移开指针不会收起，松手且已离开后才收起', async () => {
    const s = fresh()
    const id = s.create()
    s.pointerEnter(id)
    s.holdPopover()
    s.pointerLeave()
    await new Promise((r) => setTimeout(r, 260))
    expect(s.popover?.groupId).toBe(id)
    s.releasePopover()
    await new Promise((r) => setTimeout(r, 260))
    expect(s.popover).toBeNull()
  })

  it('按住期间关掉右键菜单不会收起弹层', async () => {
    const s = fresh()
    const ui = useUiStore()
    const id = s.create()
    s.pointerEnter(id)
    s.holdPopover()
    s.pointerLeave()
    ui.showContextMenu(0, 0, [{ label: '打开' }])
    ui.hideContextMenu()
    await new Promise((r) => setTimeout(r, 260))
    expect(s.popover?.groupId).toBe(id)
    s.releasePopover()
  })

  it('按住组内应用时不会切换到其他组', () => {
    const s = fresh()
    const a = s.create()
    const b = s.create()
    s.pointerEnter(a)
    s.holdPopover()
    s.pointerEnter(b)
    expect(s.popover?.groupId).toBe(a)
    s.releasePopover()
    expect(s.holding).toBe(false)
  })

  it('菜单打开的弹层在按住松开后仍保持，直到点击外部', async () => {
    const s = fresh()
    const id = s.create()
    s.openPopover(id)
    s.holdPopover()
    s.pointerLeave()
    s.releasePopover()
    await new Promise((r) => setTimeout(r, 260))
    expect(s.popover?.groupId).toBe(id)
  })

  it('拖动位置受约束', () => {
    const s = fresh()
    const id = s.create()
    s.moveTo(id, -10, -10)
    expect(s.get(id)).toMatchObject({ x: 0, y: MENU_BAR_HEIGHT + 4 })
  })

  it('卸载应用后自动从组内移除', async () => {
    const s = fresh()
    const apps = useAppsStore()
    const id = s.create({ appIds: ['json', 'hash'] })
    apps.uninstall('hash')
    await tick()
    expect(s.get(id)!.appIds).toEqual(['json'])
  })

  it('悬浮展开与移开关闭', async () => {
    const s = fresh()
    const id = s.create()
    s.pointerEnter(id)
    expect(s.popover).toMatchObject({ groupId: id, mode: 'list' })
    s.pointerLeave()
    expect(s.popover).not.toBeNull()
    await new Promise((r) => setTimeout(r, 260))
    expect(s.popover).toBeNull()
  })

  it('移开后重新进入弹层不会关闭', async () => {
    const s = fresh()
    const id = s.create()
    s.pointerEnter(id)
    s.pointerLeave()
    s.pointerEnter(id)
    await new Promise((r) => setTimeout(r, 260))
    expect(s.popover).not.toBeNull()
  })

  it('配置（名称、应用、位置）持久化并可恢复', async () => {
    const s = fresh()
    const id = s.create({ name: '常用', appIds: ['json', 'url'], at: { x: 600, y: 400 } })
    const { x, y } = s.get(id)!
    await tick()
    const raw = JSON.parse(localStorage.getItem('toolbox:groups:v1')!)
    expect(raw.groups[0]).toMatchObject({ id, name: '常用', appIds: ['json', 'url'], x, y })
    const restored = fresh()
    expect(restored.get(id)).toMatchObject({ name: '常用', appIds: ['json', 'url'], x, y })
    expect(restored.popover).toBeNull()
  })

  it('损坏的持久化数据被清洗', () => {
    localStorage.setItem(
      'toolbox:groups:v1',
      JSON.stringify({
        groups: [
          null,
          'x',
          { id: 1 },
          { id: 'ok', name: '', appIds: ['json', 'json', 7, 'ghost'], x: 10, y: 80 },
          { id: 'ok', name: 'dup', appIds: [], x: 1, y: 1 },
          { id: 'nopos', name: 'n', appIds: [] },
        ],
      }),
    )
    const s = fresh()
    expect(s.groups).toHaveLength(1)
    expect(s.groups[0]).toMatchObject({ id: 'ok', name: '未命名组', appIds: ['json'] })
    localStorage.setItem('toolbox:groups:v1', '{not json')
    expect(fresh().groups).toEqual([])
  })

  it('视口变小后图标被拉回可见区域', () => {
    const s = fresh()
    const id = s.create({ at: { x: 1200, y: 700 } })
    s.setViewport({ w: 800, h: 600 })
    expect(s.get(id)!.x).toBeLessThanOrEqual(800 - GROUP_W)
    expect(s.get(id)!.y).toBeLessThanOrEqual(600 - DOCK_RESERVED - GROUP_H)
  })
})
