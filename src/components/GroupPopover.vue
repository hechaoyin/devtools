<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { Check, Plus, X } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import { useAppsStore } from '@/stores/apps'
import { useGroupsStore } from '@/stores/groups'
import { useUiStore } from '@/stores/ui'
import { useActions } from '@/lib/actions'
import { DOCK_RESERVED, GROUP_H, GROUP_W } from '@/lib/layout'

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
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !store.popover || store.renamingId) return
  if (store.popover.mode === 'picker') store.setMode('list')
  else store.closePopover()
})

function open(appId: string) {
  store.closePopover()
  launch(appId)
}

function appMenu(e: MouseEvent, appId: string) {
  if (!group.value) return
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
      @pointerleave="store.pointerLeave"
      @contextmenu.prevent.stop
    >
      <template v-if="mode === 'list'">
        <div class="head">
          <span class="title" data-testid="popover-title">{{ group.name }}</span>
          <span class="count">{{ members.length }} 个应用</span>
        </div>
        <div class="grid" data-testid="group-apps">
          <div v-for="a in members" :key="a!.id" class="cell-wrap">
            <button class="cell" :data-testid="`group-app-${a!.id}`" :title="a!.name" @click="open(a!.id)" @contextmenu.prevent.stop="appMenu($event, a!.id)">
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
}
.cell:hover {
  background: var(--control-hover);
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
