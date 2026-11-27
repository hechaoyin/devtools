<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { LayoutGrid } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import { useAppsStore, SYSTEM_APPS } from '@/stores/apps'
import { useWindowsStore } from '@/stores/windows'
import { useUiStore } from '@/stores/ui'
import { useActions } from '@/lib/actions'
import type { AppDef } from '@/types'

const BASE = 52
const MAX_SCALE = 1.6
const RANGE = 130

const apps = useAppsStore()
const windows = useWindowsStore()
const ui = useUiStore()
const { launch, appContextMenu } = useActions()

const dockEl = ref<HTMLElement>()
const scales = reactive<Record<string, number>>({})
const bouncing = reactive<Record<string, boolean>>({})

const runningUnpinned = computed(() =>
  windows.windows
    .map((w) => w.appId)
    .filter((id) => !apps.isPinned(id) && !SYSTEM_APPS.some((s) => s.id === id))
    .map((id) => apps.resolve(id))
    .filter((a): a is AppDef => !!a),
)
const tools = computed(() => [...apps.pinnedApps, ...runningUnpinned.value])

function onMove(e: MouseEvent) {
  const els = dockEl.value?.querySelectorAll<HTMLElement>('.dock-item') ?? []
  for (const el of els) {
    const r = el.getBoundingClientRect()
    const dist = Math.abs(e.clientX - (r.left + r.width / 2))
    const t = Math.max(0, 1 - dist / RANGE)
    scales[el.dataset.id!] = 1 + (MAX_SCALE - 1) * Math.cos((1 - t) * (Math.PI / 2)) ** 1.5
  }
}
function onLeave() {
  for (const k of Object.keys(scales)) scales[k] = 1
}

const sizeOf = (id: string) => `${BASE * (scales[id] ?? 1)}px`

async function click(app: AppDef) {
  if (!windows.isOpen(app.id)) {
    bouncing[app.id] = true
    await nextTick()
    setTimeout(() => (bouncing[app.id] = false), 900)
  }
  launch(app.id)
}

function context(e: MouseEvent, id: string) {
  e.preventDefault()
  ui.showContextMenu(e.clientX, e.clientY - 120, appContextMenu(id))
}
</script>

<template>
  <div class="dock-wrap" @contextmenu.prevent>
    <div ref="dockEl" class="dock glass" data-testid="dock" @mousemove="onMove" @mouseleave="onLeave">
      <div class="dock-item" data-id="launchpad" :style="{ width: sizeOf('launchpad'), height: sizeOf('launchpad') }">
        <button class="hit" aria-label="Launchpad" data-testid="dock-launchpad" @click="ui.toggleLaunchpad">
          <AppIcon :icon="LayoutGrid" color="indigo" :size="BASE" class="ico" :style="{ transform: `scale(${scales['launchpad'] ?? 1})` }" />
        </button>
        <span class="tip">Launchpad</span>
      </div>
      <div class="divider" />
      <div
        v-for="app in tools"
        :key="app.id"
       
        class="dock-item"
        :data-id="app.id"
        :style="{ width: sizeOf(app.id), height: sizeOf(app.id) }"
        @contextmenu="context($event, app.id)"
      >
        <button class="hit" :aria-label="app.name" :data-testid="`dock-${app.id}`" @click="click(app)">
          <AppIcon :icon="app.icon" :color="app.color" :size="BASE" class="ico" :class="{ bounce: bouncing[app.id] }" :style="{ transform: `scale(${scales[app.id] ?? 1})` }" />
        </button>
        <span class="tip">{{ app.name }}</span>
        <i v-if="windows.isOpen(app.id)" class="dot" />
      </div>
      <div class="divider" />
      <div
        v-for="app in SYSTEM_APPS"
        :key="app.id"
       
        class="dock-item"
        :data-id="app.id"
        :style="{ width: sizeOf(app.id), height: sizeOf(app.id) }"
        @contextmenu="context($event, app.id)"
      >
        <button class="hit" :aria-label="app.name" :data-testid="`dock-${app.id}`" @click="click(app)">
          <AppIcon :icon="app.icon" :color="app.color" :size="BASE" class="ico" :class="{ bounce: bouncing[app.id] }" :style="{ transform: `scale(${scales[app.id] ?? 1})` }" />
        </button>
        <span class="tip">{{ app.name }}</span>
        <i v-if="windows.isOpen(app.id)" class="dot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dock-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 8px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 80000;
}
.dock {
  pointer-events: auto;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 6px 8px 8px;
  border-radius: 20px;
  background: var(--dock-bg);
  border: 0.5px solid var(--dock-border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  height: 52px;
  box-sizing: content-box;
}
.dock-item {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transition: width 0.06s linear, height 0.06s linear;
}
.hit {
  all: unset;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: default;
}
.ico {
  transform-origin: 50% 100%;
  pointer-events: none;
  position: absolute;
  bottom: 0;
}
.ico.bounce {
  animation: bounce 0.9s ease-in-out;
}
@keyframes bounce {
  0%, 100% { translate: 0 0; }
  25% { translate: 0 -22px; }
  50% { translate: 0 0; }
  70% { translate: 0 -12px; }
}
.dot {
  position: absolute;
  bottom: -6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text);
  opacity: 0.7;
}
.divider {
  width: 1px;
  align-self: stretch;
  margin: 2px 4px;
  background: var(--border);
}
.tip {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s;
  color: var(--text);
}
.dock-item:hover .tip {
  opacity: 1;
}
</style>
