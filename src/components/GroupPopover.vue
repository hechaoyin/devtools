<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { Check, Plus, X } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import { useAppsStore } from '@/stores/apps'
import { useGroupsStore } from '@/stores/groups'
import { useUiStore } from '@/stores/ui'
import { useActions } from '@/lib/actions'
import { DOCK_RESERVED, GROUP_H, GROUP_W } from '@/lib/layout'
import { LONG_PRESS_MS, idleDrag, pressDown, pressHold, pressMove, pressUp } from '@/lib/longPressDrag'
import type { DragState } from '@/lib/longPressDrag'

const POP_W = 316
const EDGE = 8
const NEEDED_BELOW = 330

const apps = useAppsStore()
const store = useGroupsStore()
const ui = useUiStore()
const { launch, groupAppContextMenu } = useActions()

const el = ref<HTMLElement>()
const group = computed(() => (store.popover ? store.get(store.popover.groupId) : undefined))
const mode = computed(() => store.popover?.mode ?? 'list')
const members = computed(() => (group.value?.appIds ?? []).map((id) => apps.resolve(id)).filter((a) => !!a))

const layout = computed(() => {
  const g = group.value
  if (!g) return null
  const vp = store.viewport
  const cx = g.x + GROUP_W / 2
  const left = Math.min(Math.max(cx - POP_W / 2, EDGE), Math.max(EDGE, vp.w - POP_W - EDGE))
  const above = vp.h - DOCK_RESERVED - (g.y + GROUP_H) < NEEDED_BELOW && g.y > NEEDED_BELOW
  const arrowX = Math.min(Math.max(cx - left, 22), POP_W - 22)
  const style: Record<string, string> = { left: `${left}px`, width: `${POP_W}px`, transformOrigin: `${arrowX}px ${above ? '100%' : '0'}`, '--arrow-x': `${arrowX}px` }
  if (above) style.bottom = `${vp.h - g.y + 2}px`
  else style.top = `${g.y + GROUP_H - 4}px`
  return { style, above }
})

onClickOutside(el, () => store.closePopover(), { ignore: ['[data-group-id]'] })

const gridEl = ref<HTMLElement | null>(null)
const press = ref<DragState>(idleDrag())
let activePointer: number | null = null
let captureEl: HTMLElement | null = null
let holdTimer: ReturnType<typeof setTimeout> | undefined
let scrollRaf = 0
let lastX = 0
let lastY = 0
let suppressClick = false
let blockMenuUntil = 0
let ignoreLeave = false
let ignoreLeaveTimer: ReturnType<typeof setTimeout> | undefined

const sortingId = computed(() => (press.value.phase === 'dragging' ? press.value.appId : null))
const overId = computed(() => (press.value.phase === 'dragging' ? press.value.overId : null))
const ghostApp = computed(() => (sortingId.value ? apps.resolve(sortingId.value) : undefined))

function appIdAt(x: number, y: number): string | null {
  if (typeof document.elementsFromPoint !== 'function') return null
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof Element) || node.closest('.group-app-ghost')) continue
    const id = node.closest('[data-group-app]')?.getAttribute('data-group-app')
    if (id) return id
  }
  return null
}

function stopScroll() {
  if (!scrollRaf) return
  cancelAnimationFrame(scrollRaf)
  scrollRaf = 0
}

function ensureScrollLoop() {
  if (scrollRaf) return
  const step = () => {
    scrollRaf = 0
    if (press.value.phase !== 'dragging') return
    const grid = gridEl.value
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const y = press.value.y
    const zone = 28
    const dir = y < rect.top + zone ? -1 : y > rect.bottom - zone ? 1 : 0
    if (!dir) return
    const prev = grid.scrollTop
    grid.scrollTop += dir * 14
    if (grid.scrollTop === prev) return
    press.value = pressMove(press.value, press.value.x, press.value.y, appIdAt(press.value.x, press.value.y))
    scrollRaf = requestAnimationFrame(step)
  }
  scrollRaf = requestAnimationFrame(step)
}

function teardown() {
  clearTimeout(holdTimer)
  holdTimer = undefined
  stopScroll()
  const target = captureEl
  const pointerId = activePointer
  captureEl = null
  if (target && pointerId !== null) {
    try {
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
    } catch {
      /* 部分环境没有指针捕获 */
    }
  }
  activePointer = null
  press.value = idleDrag()
  document.documentElement.classList.remove('is-group-app-sorting')
}

function syncPointer(x: number, y: number) {
  const current = group.value
  const root = el.value
  if (!store.popover || !current) return
  if (root) {
    const rect = root.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      store.pointerEnter(current.id)
      return
    }
  }
  const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : []
  for (const node of stack) {
    if (!(node instanceof Element) || node.closest('.group-app-ghost')) continue
    const hostId = node.closest('[data-group-id]')?.getAttribute('data-group-id')
    if (hostId) {
      store.pointerEnter(hostId)
      return
    }
  }
  store.pointerLeave()
}

function armIgnoreLeave() {
  ignoreLeave = true
  clearTimeout(ignoreLeaveTimer)
  ignoreLeaveTimer = setTimeout(() => {
    ignoreLeave = false
  }, 0)
}

function stopGesture(point: { clientX: number; clientY: number }, commit: boolean) {
  armIgnoreLeave()
  const phase = press.value.phase
  let state = press.value
  if (phase === 'dragging' && commit) state = pressMove(state, point.clientX, point.clientY, appIdAt(point.clientX, point.clientY))
  else if (phase === 'dragging') state = { ...state, overId: null }
  const result = pressUp(state)
  if (result.suppressClick || (!commit && phase !== 'idle')) {
    suppressClick = true
    blockMenuUntil = Date.now() + 600
  }
  teardown()
  if (commit && result.reorder && group.value) {
    const to = group.value.appIds.indexOf(result.reorder.overId)
    if (to >= 0) store.moveApp(group.value.id, result.reorder.appId, to)
  }
  store.releasePopover()
  syncPointer(point.clientX, point.clientY)
}

function cancelPress() {
  if (activePointer === null && press.value.phase === 'idle') return
  if (press.value.phase !== 'idle') suppressClick = true
  teardown()
  store.releasePopover()
}

function onHold() {
  const next = pressHold(press.value)
  if (next.phase !== 'dragging') return
  press.value = next
  blockMenuUntil = Date.now() + 800
  ui.hideContextMenu()
  document.documentElement.classList.add('is-group-app-sorting')
  ensureScrollLoop()
}

function onDown(e: PointerEvent, appId: string) {
  if (e.button !== 0 || activePointer !== null) return
  suppressClick = false
  activePointer = e.pointerId
  lastX = e.clientX
  lastY = e.clientY
  captureEl = e.currentTarget as HTMLElement
  try {
    captureEl.setPointerCapture(e.pointerId)
  } catch {
    /* jsdom 等环境可能没有指针捕获 */
  }
  press.value = pressDown(appId, e.clientX, e.clientY)
  store.holdPopover()
  clearTimeout(holdTimer)
  holdTimer = setTimeout(onHold, LONG_PRESS_MS)
}

function onMove(e: PointerEvent) {
  if (activePointer === null || e.pointerId !== activePointer) return
  lastX = e.clientX
  lastY = e.clientY
  const phase = press.value.phase
  press.value = pressMove(press.value, e.clientX, e.clientY, phase === 'dragging' ? appIdAt(e.clientX, e.clientY) : null)
  if (phase === 'pending' && press.value.phase === 'cancelled') clearTimeout(holdTimer)
  if (press.value.phase === 'dragging') ensureScrollLoop()
}

function onUp(e: PointerEvent) {
  if (activePointer === null || e.pointerId !== activePointer) return
  lastX = e.clientX
  lastY = e.clientY
  stopGesture(e, true)
}

function onCancel(e: PointerEvent) {
  if (activePointer === null || e.pointerId !== activePointer) return
  stopGesture(e, false)
}

function onPopoverPointerLeave() {
  if (activePointer !== null || ignoreLeave) return
  store.pointerLeave()
}

useEventListener(window, 'pointermove', onMove)
useEventListener(window, 'pointerup', onUp)
useEventListener(window, 'pointercancel', onCancel)
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && activePointer !== null) {
    stopGesture({ clientX: lastX, clientY: lastY }, false)
    return
  }
  if (e.key !== 'Escape' || !store.popover || store.renamingId) return
  if (store.popover.mode === 'picker') store.setMode('list')
  else store.closePopover()
})
watch(
  () => store.popover,
  (val) => {
    if (!val) cancelPress()
  },
)
onBeforeUnmount(() => {
  clearTimeout(ignoreLeaveTimer)
  cancelPress()
})

function open(appId: string) {
  store.closePopover()
  launch(appId)
}

function onCellClick(appId: string) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  open(appId)
}

function appMenu(e: MouseEvent, appId: string) {
  if (!group.value || press.value.phase !== 'idle' || Date.now() < blockMenuUntil) return
  ui.showContextMenu(e.clientX, e.clientY, groupAppContextMenu(group.value.id, appId))
}
</script>

<template>
  <Transition name="gp">
    <div
      v-if="store.popover && group && layout"
      :key="group.id"
      ref="el"
      class="popover glass"
      :class="{ above: layout.above }"
      :style="layout.style"
      :data-testid="`group-popover`"
      @pointerenter="store.pointerEnter(group.id)"
      @pointerleave="onPopoverPointerLeave"
      @contextmenu.prevent.stop
    >
      <template v-if="mode === 'list'">
        <div class="head">
          <span class="title" data-testid="popover-title">{{ group.name }}</span>
          <span class="count" data-testid="group-app-count">
            <template v-if="sortingId">松手完成排序</template>
            <template v-else-if="members.length > 1">{{ members.length }} 个应用 · 长按排序</template>
            <template v-else>{{ members.length }} 个应用</template>
          </span>
        </div>
        <div ref="gridEl" class="grid" :class="{ sorting: !!sortingId }" data-testid="group-apps">
          <div v-for="a in members" :key="a!.id" class="cell-wrap" :class="{ source: sortingId === a!.id, over: overId === a!.id }" :data-group-app="a!.id">
            <button
              class="cell"
              :data-testid="`group-app-${a!.id}`"
              :title="a!.name"
              draggable="false"
              @click="onCellClick(a!.id)"
              @pointerdown="onDown($event, a!.id)"
              @contextmenu.prevent.stop="appMenu($event, a!.id)"
              @dragstart.prevent
            >
              <AppIcon :icon="a!.icon" :color="a!.color" :size="52" />
              <span class="name">{{ a!.name }}</span>
            </button>
            <button class="rm" :data-testid="`group-remove-${a!.id}`" :title="`从组中移除 ${a!.name}`" @click.stop="store.removeApp(group.id, a!.id)">
              <X :size="11" :stroke-width="3" />
            </button>
          </div>
          <button class="cell add" data-testid="group-add" title="添加应用" @click="store.setMode('picker')">
            <span class="add-tile"><Plus :size="22" :stroke-width="2" /></span>
            <span class="name">添加应用</span>
          </button>
        </div>
        <p v-if="!members.length" class="hint">这个组还是空的，点击「+」从已安装工具中添加</p>
      </template>

      <template v-else>
        <div class="head">
          <span class="title">添加应用到「{{ group.name }}」</span>
          <button class="btn btn-primary done" data-testid="picker-done" @click="store.setMode('list')">完成</button>
        </div>
        <div class="picker" data-testid="group-picker">
          <button
            v-for="a in apps.installedApps"
            :key="a.id"
            class="row"
            :class="{ on: group.appIds.includes(a.id) }"
            :data-testid="`picker-${a.id}`"
            @click="store.toggleApp(group.id, a.id)"
          >
            <AppIcon :icon="a.icon" :color="a.color" :size="30" />
            <span class="row-name">{{ a.name }}</span>
            <span class="check"><Check v-if="group.appIds.includes(a.id)" :size="13" :stroke-width="3" /></span>
          </button>
          <p v-if="!apps.installedApps.length" class="hint">还没有已安装的工具</p>
        </div>
      </template>
    </div>
  </Transition>
  <Teleport to="body">
    <div v-if="ghostApp" class="group-app-ghost" data-testid="group-app-ghost" :style="{ left: `${press.x}px`, top: `${press.y}px` }" aria-hidden="true">
      <AppIcon :icon="ghostApp.icon" :color="ghostApp.color" :size="52" />
      <span class="name">{{ ghostApp.name }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
.popover {
  position: fixed;
  z-index: 85000;
  box-sizing: border-box;
  padding: 12px 14px 14px;
  border-radius: 18px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.38);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
}
.popover::before {
  content: '';
  position: absolute;
  left: calc(var(--arrow-x) - 7px);
  top: -6px;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  background: var(--menu-bg);
  border-left: 0.5px solid var(--border);
  border-top: 0.5px solid var(--border);
  border-top-left-radius: 3px;
}
.popover.above::before {
  top: auto;
  bottom: -6px;
  transform: rotate(225deg);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 8px;
}
.title {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  flex: none;
  font-size: 11.5px;
  color: var(--text-dim);
  white-space: nowrap;
}
.done {
  flex: none;
  padding: 2px 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 72px);
  gap: 6px 0;
  max-height: 300px;
  overflow-y: auto;
}
.cell-wrap {
  position: relative;
}
.cell {
  all: unset;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 72px;
  padding: 6px 0 5px;
  border-radius: 12px;
  cursor: default;
  color: var(--text);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition:
    background 0.12s,
    box-shadow 0.12s,
    transform 0.12s;
}
.cell:hover {
  background: var(--control-hover);
}
.cell:active {
  transition:
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    background 0.12s,
    box-shadow 0.12s;
  transform: scale(0.92);
}
.cell:focus-visible {
  outline: 2px solid var(--accent);
}
.name {
  max-width: 66px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
}
.add-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  border: 1.5px dashed var(--text-dim);
  color: var(--text-dim);
}
.add:hover .add-tile {
  color: var(--accent);
  border-color: var(--accent);
}
.rm {
  position: absolute;
  top: 2px;
  left: 6px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(90, 90, 96, 0.92);
  color: #fff;
  cursor: default;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.rm:hover {
  background: #ff453a;
}
.cell-wrap:hover .rm {
  display: flex;
}
@media (hover: none) {
  .rm {
    display: flex;
  }
}
.cell-wrap.source .cell {
  opacity: 0.28;
}
.grid.sorting .cell:hover,
.grid.sorting .cell:active {
  background: transparent;
  transform: none;
}
.grid.sorting .cell-wrap.over .cell,
.grid.sorting .cell-wrap.over .cell:hover,
.grid.sorting .cell-wrap.over .cell:active {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 2px var(--accent);
}
.grid.sorting .rm {
  display: none;
}
.group-app-ghost {
  position: fixed;
  z-index: 86000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 72px;
  pointer-events: none;
  transform: translate(-50%, -28px) scale(1.08);
  filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.35));
}
.group-app-ghost .name {
  color: #fff;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.85),
    0 0 4px rgba(0, 0, 0, 0.45);
}
.hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
}
.picker {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 300px;
  overflow-y: auto;
}
.row {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 8px;
  cursor: default;
  color: var(--text);
}
.row:hover {
  background: var(--control-hover);
}
.row-name {
  flex: 1;
  font-size: 13px;
}
.check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--text-dim);
  color: #fff;
}
.row.on .check {
  background: var(--accent);
  border-color: var(--accent);
}
.gp-enter-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.gp-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.gp-enter-from,
.gp-leave-to {
  opacity: 0;
  transform: scale(0.88);
}
</style>

<style>
html.is-group-app-sorting,
html.is-group-app-sorting * {
  cursor: grabbing !important;
  user-select: none !important;
}
</style>
