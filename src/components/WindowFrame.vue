<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { Minus, Plus, X } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import CustomToolView from './CustomToolView.vue'
import { useWindowsStore, maximizedRect, type Rect } from '@/stores/windows'
import { MENU_BAR_HEIGHT } from '@/lib/layout'
import type { AppDef, WindowState } from '@/types'

const props = defineProps<{ win: WindowState; app: AppDef; focused: boolean }>()
const store = useWindowsStore()

const content = computed(() => (props.app.loader ? defineAsyncComponent(props.app.loader) : null))

const interacting = ref(false)
const rect = computed<Rect>(() => (props.win.maximized ? maximizedRect(store.viewport) : props.win))

const style = computed(() => {
  const r = rect.value
  const base: Record<string, string | number> = {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
    zIndex: props.win.z,
  }
  if (props.win.minimized) {
    const vp = store.viewport
    const dx = vp.w / 2 - (r.x + r.w / 2)
    const dy = vp.h - (r.y + r.h / 2) - 24
    base.transform = `translate(${dx}px, ${dy}px) scale(0.12)`
  }
  return base
})

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const DIRS: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

let origin: { px: number; py: number; rect: Rect; dir: Dir | 'move' } | null = null

function begin(e: PointerEvent, dir: Dir | 'move') {
  if (e.button !== 0) return
  store.focus(props.win.appId)
  if (props.win.maximized) return
  origin = { px: e.clientX, py: e.clientY, rect: { x: props.win.x, y: props.win.y, w: props.win.w, h: props.win.h }, dir }
  interacting.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function move(e: PointerEvent) {
  if (!origin) return
  const dx = e.clientX - origin.px
  const dy = e.clientY - origin.py
  const { rect: s, dir } = origin
  const min = props.app.minSize
  let { x, y, w, h } = s
  if (dir === 'move') {
    x = s.x + dx
    y = s.y + dy
  } else {
    if (dir.includes('e')) w = Math.max(min.w, s.w + dx)
    if (dir.includes('w')) {
      w = Math.max(min.w, s.w - dx)
      x = s.x + s.w - w
    }
    if (dir.includes('s')) h = Math.max(min.h, s.h + dy)
    if (dir.includes('n')) {
      y = Math.max(MENU_BAR_HEIGHT, Math.min(s.y + dy, s.y + s.h - min.h))
      h = s.y + s.h - y
    }
  }
  store.setRect(props.win.appId, { x, y, w, h }, min)
}

function end(e: PointerEvent) {
  if (!origin) return
  origin = null
  interacting.value = false
  const el = e.currentTarget as HTMLElement
  if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
}
</script>

<template>
  <section
    class="window glass"
    :class="{ focused, minimized: win.minimized, maximized: win.maximized, interacting }"
    :style="style"
    :data-window="win.appId"
    role="dialog"
    :aria-label="app.name"
    @pointerdown.capture="store.focus(win.appId)"
    @contextmenu.self.prevent
  >
    <header
      class="titlebar"
      @pointerdown="begin($event, 'move')"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @dblclick="store.toggleMaximize(win.appId)"
    >
      <div class="lights" @pointerdown.stop @dblclick.stop>
        <button class="light close" aria-label="关闭" data-action="close" @click="store.close(win.appId)"><X :size="8" :stroke-width="3.2" /></button>
        <button class="light min" aria-label="最小化" data-action="minimize" @click="store.minimize(win.appId)"><Minus :size="8" :stroke-width="3.2" /></button>
        <button class="light max" aria-label="最大化" data-action="maximize" @click="store.toggleMaximize(win.appId)"><Plus :size="8" :stroke-width="3.2" /></button>
      </div>
      <div class="title">
        <AppIcon :icon="app.icon" :color="app.color" :size="15" />
        <span>{{ app.name }}</span>
      </div>
    </header>
    <div class="body">
      <CustomToolView v-if="app.custom" :tool="app.custom" />
      <component :is="content" v-else-if="content" />
      <div v-if="!focused || interacting" class="shield" />
    </div>
    <template v-if="!win.maximized && !win.minimized">
      <div
        v-for="d in DIRS"
        :key="d"
        class="handle"
        :class="`h-${d}`"
        @pointerdown.stop="begin($event, d)"
        @pointermove="move"
        @pointerup="end"
        @pointercancel="end"
      />
    </template>
  </section>
</template>

<style scoped>
.window {
  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: 11px;
  background: var(--window-bg);
  box-shadow: var(--shadow-window-inactive);
  transform-origin: 50% 100%;
  transition:
    left 0.24s ease,
    top 0.24s ease,
    width 0.24s ease,
    height 0.24s ease,
    transform 0.34s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease,
    visibility 0s linear 0s;
}
.window.interacting {
  transition: none;
}
.window.focused {
  box-shadow: var(--shadow-window);
}
.window.maximized {
  border-radius: 0;
}
.window.minimized {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    transform 0.34s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease,
    visibility 0s linear 0.34s;
}
.titlebar {
  position: relative;
  display: flex;
  align-items: center;
  height: 38px;
  flex: none;
  padding: 0 13px;
  border-radius: 11px 11px 0 0;
  background: var(--titlebar-inactive);
  border-bottom: 0.5px solid var(--hairline);
  touch-action: none;
}
.maximized .titlebar {
  border-radius: 0;
}
.focused .titlebar {
  background: var(--titlebar-bg);
}
.lights {
  display: flex;
  gap: 8px;
  z-index: 1;
}
.light {
  all: unset;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  background: #c8c8cc;
  border: 0.5px solid rgba(0, 0, 0, 0.15);
}
[data-theme='dark'] .light {
  background: #56565a;
}
.focused .light.close { background: #ff5f57; }
.focused .light.min { background: #febc2e; }
.focused .light.max { background: #28c840; }
.lights:hover .light {
  color: rgba(0, 0, 0, 0.55);
}
.title {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-dim);
  pointer-events: none;
}
.focused .title {
  color: var(--text);
}
.body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 0 0 11px 11px;
  background: var(--window-content);
}
.maximized .body {
  border-radius: 0;
}
.shield {
  position: absolute;
  inset: 0;
  z-index: 5;
}
.handle {
  position: absolute;
  z-index: 10;
  touch-action: none;
}
.h-n { top: -4px; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
.h-s { bottom: -4px; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
.h-e { right: -4px; top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
.h-w { left: -4px; top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
.h-ne { top: -5px; right: -5px; width: 14px; height: 14px; cursor: nesw-resize; }
.h-nw { top: -5px; left: -5px; width: 14px; height: 14px; cursor: nwse-resize; }
.h-se { bottom: -5px; right: -5px; width: 14px; height: 14px; cursor: nwse-resize; }
.h-sw { bottom: -5px; left: -5px; width: 14px; height: 14px; cursor: nesw-resize; }
</style>
