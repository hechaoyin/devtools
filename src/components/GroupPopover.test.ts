// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import GroupPopover from './GroupPopover.vue'
import { useGroupsStore } from '@/stores/groups'
import { useWindowsStore } from '@/stores/windows'

const VP = { w: 1280, h: 800 }

function pointer(type: string, x: number, y: number, target: EventTarget = window) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }))
}

async function mountGroup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const groups = useGroupsStore()
  groups.setViewport(VP)
  const id = groups.create({ name: '常用', appIds: ['json', 'xml', 'hash', 'url'], at: { x: 640, y: 280 } })
  groups.pointerEnter(id)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(GroupPopover)
  app.use(pinia)
  app.mount(host)
  await nextTick()
  return {
    groups,
    id,
    async unmount() {
      app.unmount()
      host.remove()
    },
  }
}

function appOrder() {
  return [...document.querySelectorAll('[data-group-app]')].map((el) => el.getAttribute('data-group-app'))
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('组弹层长按排序', () => {
  it('短按打开应用，不改变顺序', async () => {
    const { groups, id, unmount } = await mountGroup()
    const before = groups.get(id)!.appIds.slice()
    const button = document.querySelector('[data-testid="group-app-json"]') as HTMLElement
    pointer('pointerdown', 20, 20, button)
    pointer('pointerup', 22, 21)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(useWindowsStore().isOpen('json')).toBe(true)
    expect(groups.get(id)!.appIds).toEqual(before)
    await unmount()
  })

  it('按住未到时间就移动，松手不打开也不排序', async () => {
    const { groups, id, unmount } = await mountGroup()
    const before = groups.get(id)!.appIds.slice()
    const button = document.querySelector('[data-testid="group-app-json"]') as HTMLElement
    pointer('pointerdown', 20, 20, button)
    pointer('pointermove', 40, 20)
    pointer('pointerup', 40, 20)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(useWindowsStore().isOpen('json')).toBe(false)
    expect(groups.get(id)!.appIds).toEqual(before)
    expect(document.querySelector('[data-testid="group-app-ghost"]')).toBeNull()
    await unmount()
  })

  it('长按后拖到另一应用上松手，组内顺序改变且不打开', async () => {
    const { groups, id, unmount } = await mountGroup()
    const button = document.querySelector('[data-testid="group-app-json"]') as HTMLElement
    const hit = document.querySelector('[data-group-app="hash"]')!
    const proto = Document.prototype
    const prev = proto.elementsFromPoint
    proto.elementsFromPoint = function (x: number) {
      return x >= 50 ? [hit] : []
    }
    try {
      pointer('pointerdown', 20, 20, button)
      await new Promise((r) => setTimeout(r, 600))
      await nextTick()
      expect(document.querySelector('[data-testid="group-app-ghost"]')).not.toBeNull()
      expect(document.querySelector('[data-testid="group-app-count"]')?.textContent).toContain('松手完成排序')
      pointer('pointermove', 80, 30)
      pointer('pointerup', 80, 30)
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(groups.get(id)!.appIds).toEqual(['xml', 'hash', 'json', 'url'])
      expect(appOrder()).toEqual(['xml', 'hash', 'json', 'url'])
      expect(useWindowsStore().isOpen('json')).toBe(false)
    } finally {
      proto.elementsFromPoint = prev
      await unmount()
    }
  })

  it('长按后按 Esc 取消，顺序不变', async () => {
    const { groups, id, unmount } = await mountGroup()
    const before = groups.get(id)!.appIds.slice()
    const button = document.querySelector('[data-testid="group-app-json"]') as HTMLElement
    pointer('pointerdown', 20, 20, button)
    await new Promise((r) => setTimeout(r, 600))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(groups.get(id)!.appIds).toEqual(before)
    expect(document.querySelector('[data-testid="group-app-ghost"]')).toBeNull()
    expect(useWindowsStore().isOpen('json')).toBe(false)
    await unmount()
  })
})
