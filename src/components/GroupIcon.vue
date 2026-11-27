<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Folder } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import { useAppsStore } from '@/stores/apps'
import { useGroupsStore } from '@/stores/groups'
import { useActions } from '@/lib/actions'
import { useUiStore } from '@/stores/ui'
import { GROUP_H, GROUP_ICON, GROUP_NAME_MAX, GROUP_W } from '@/lib/layout'
import type { AppGroup } from '@/types'

const props = defineProps<{ group: AppGroup }>()

const apps = useAppsStore()
const store = useGroupsStore()
const ui = useUiStore()
const { groupContextMenu } = useActions()

const previews = computed(() =>
  props.group.appIds
    .slice(0, 9)
    .map((id) => apps.resolve(id))
    .filter((a) => !!a),
)
const isOpen = computed(() => store.popover?.groupId === props.group.id)
const renaming = computed(() => store.renamingId === props.group.id)

const input = ref<HTMLInputElement>()
const draft = ref('')
watch(
  renaming,
  async (on) => {
    if (!on) return
    draft.value = props.group.name
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
  { immediate: true },
)

const commit = () => store.finishRename(true, draft.value)
const cancel = () => store.finishRename(false)

const DRAG_THRESHOLD = 4
let drag: { sx: number; sy: number; ox: number; oy: number; active: boolean } | null = null

function onDown(e: PointerEvent) {
  if (e.button !== 0 || renaming.value) return
  drag = { sx: e.clientX, sy: e.clientY, ox: props.group.x, oy: props.group.y, active: false }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent) {
  if (!drag) return
  const dx = e.clientX - drag.sx
  const dy = e.clientY - drag.sy
  if (!drag.active) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.active = true
    store.draggingId = props.group.id
    store.closePopover()
  }
  store.moveTo(props.group.id, drag.ox + dx, drag.oy + dy)
}

function onUp(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  const wasDragging = drag?.active
  drag = null
  if (wasDragging) {
    store.draggingId = null
    store.pointerEnter(props.group.id)
  }
}

function onContextMenu(e: MouseEvent) {
  store.closePopover()
  ui.showContextMenu(e.clientX, e.clientY, groupContextMenu(props.group.id))
}
</script>

<template>
  <div
    class="group"
    :class="{ open: isOpen, dragging: store.draggingId === group.id }"
    :style="{ left: `${group.x}px`, top: `${group.y}px`, width: `${GROUP_W}px`, height: `${GROUP_H}px` }"
    :data-group-id="group.id"
    :data-testid="`group-${group.id}`"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerenter="store.pointerEnter(group.id)"
    @pointerleave="store.pointerLeave"
    @contextmenu.prevent.stop="onContextMenu"
  >
    <div class="tile" :style="{ width: `${GROUP_ICON}px`, height: `${GROUP_ICON}px` }">
      <div v-if="previews.length" class="minis">
        <AppIcon v-for="a in previews" :key="a!.id" :icon="a!.icon" :color="a!.color" :size="14" />
      </div>
      <Folder v-else :size="26" :stroke-width="1.6" class="empty-icon" />
    </div>
    <input
      v-if="renaming"
      ref="input"
      v-model="draft"
      class="rename"
      data-testid="group-rename-input"
      :maxlength="GROUP_NAME_MAX"
      spellcheck="false"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="cancel"
      @keydown.stop
      @blur="commit"
      @pointerdown.stop
    />
    <span v-else class="label" :title="group.name" data-testid="group-name" @dblclick.stop="store.startRename(group.id)">{{ group.name }}</span>
  </div>
</template>

<style scoped>
.group {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 4px;
  box-sizing: border-box;
  cursor: default;
  touch-action: none;
}
.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.28);
  border: 0.5px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.22),
    inset 0 0.5px 0 rgba(255, 255, 255, 0.6);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  transition:
    transform 0.15s,
    background 0.15s;
}
[data-theme='dark'] .tile {
  background: rgba(60, 60, 68, 0.42);
  border-color: rgba(255, 255, 255, 0.18);
}
.group:hover .tile,
.group.open .tile {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}
[data-theme='dark'] .group:hover .tile,
[data-theme='dark'] .group.open .tile {
  background: rgba(80, 80, 90, 0.55);
}
.group.dragging .tile {
  transform: scale(1.08);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
}
.minis {
  display: grid;
  grid-template-columns: repeat(3, 14px);
  grid-auto-rows: 14px;
  gap: 4px;
}
.empty-icon {
  color: rgba(255, 255, 255, 0.85);
}
.label,
.rename {
  max-width: 92px;
  font-size: 12px;
  line-height: 16px;
}
.label {
  padding: 0 6px;
  border-radius: 4px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group.open .label {
  background: var(--accent);
  text-shadow: none;
}
.rename {
  width: 88px;
  box-sizing: border-box;
  padding: 0 4px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  outline: 0;
  background: var(--input-bg);
  color: var(--text);
  font-family: inherit;
  text-align: center;
  user-select: text;
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
