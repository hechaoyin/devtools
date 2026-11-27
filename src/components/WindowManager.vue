<script setup lang="ts">
import { computed, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import WindowFrame from './WindowFrame.vue'
import { useWindowsStore } from '@/stores/windows'
import { useAppsStore } from '@/stores/apps'

const windows = useWindowsStore()
const apps = useAppsStore()
const size = useWindowSize()

watch(
  [size.width, size.height],
  ([w, h]) => {
    windows.setViewport({ w, h })
    windows.reclampAll((id) => apps.resolve(id)?.minSize ?? { w: 360, h: 240 })
  },
  { immediate: true },
)

const frames = computed(() =>
  windows.windows.flatMap((win) => {
    const app = apps.resolve(win.appId)
    return app ? [{ win, app }] : []
  }),
)

// 卸载/删除应用后关闭其残留窗口
watch(
  () => apps.order.length + apps.customTools.length,
  () => windows.prune((id) => !!apps.resolve(id)),
)
windows.prune((id) => !!apps.resolve(id))
</script>

<template>
  <TransitionGroup name="win" tag="div" class="windows" appear>
    <WindowFrame v-for="f in frames" :key="f.app.id" :win="f.win" :app="f.app" :focused="windows.focusedId === f.app.id" />
  </TransitionGroup>
</template>

<style scoped>
.windows {
  z-index: 1;
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.windows > :deep(*) {
  pointer-events: auto;
}
.win-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease !important;
}
.win-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease !important;
}
.win-enter-from,
.win-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
