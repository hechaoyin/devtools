<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside, useEventListener, useWindowSize } from '@vueuse/core'
import { Check } from 'lucide-vue-next'
import { useUiStore, type MenuItem } from '@/stores/ui'

const ui = useUiStore()
const el = ref<HTMLElement>()
const { width, height } = useWindowSize()

const pos = computed(() => {
  const m = ui.contextMenu
  if (!m) return { left: '0px', top: '0px' }
  const w = 220
  const h = m.items.length * 26 + 12
  return { left: `${Math.min(m.x, width.value - w - 8)}px`, top: `${Math.min(m.y, height.value - h - 8)}px` }
})

onClickOutside(el, () => ui.hideContextMenu(), { capture: true })
useEventListener(window, 'keydown', (e) => e.key === 'Escape' && ui.hideContextMenu())
useEventListener(window, 'blur', () => ui.hideContextMenu())

function run(item: MenuItem) {
  if (item.disabled || item.separator) return
  ui.hideContextMenu()
  item.action?.()
}
</script>

<template>
  <div v-if="ui.contextMenu" ref="el" class="ctx glass" :style="pos" @contextmenu.prevent>
    <template v-for="(item, i) in ui.contextMenu.items" :key="i">
      <div v-if="item.separator" class="sep" />
      <button v-else class="item" :disabled="item.disabled" @click="run(item)">
        <span class="check"><Check v-if="item.checked" :size="13" /></span>
        <span class="label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.ctx {
  position: fixed;
  z-index: 100000;
  min-width: 190px;
  padding: 5px;
  border-radius: 9px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
}
.item {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 3px 8px 3px 4px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: default;
}
.item:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}
.item:disabled {
  opacity: 0.4;
}
.check {
  width: 16px;
  display: inline-flex;
  justify-content: center;
}
.label {
  flex: 1;
}
.shortcut {
  color: var(--text-dim);
  margin-left: 18px;
  font-size: 12px;
}
.item:hover:not(:disabled) .shortcut {
  color: rgba(255, 255, 255, 0.8);
}
.sep {
  height: 0.5px;
  margin: 4px 8px;
  background: var(--border);
}
</style>
