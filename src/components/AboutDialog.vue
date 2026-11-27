<script setup lang="ts">
import { LayoutGrid } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.aboutOpen" class="overlay" @mousedown.self="ui.aboutOpen = false">
      <div class="dialog glass" role="dialog" aria-label="关于工具箱">
        <AppIcon :icon="LayoutGrid" color="indigo" :size="72" />
        <h2>工具箱</h2>
        <p class="dim">仿 macOS 桌面的浏览器开发者工具箱</p>
        <p class="dim small">Vue 3 · TypeScript · Pinia · Vite<br />所有数据仅保存在你的浏览器本地</p>
        <button class="btn btn-primary" @click="ui.aboutOpen = false">好</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 99000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
}
.dialog {
  width: 300px;
  padding: 26px 24px 20px;
  border-radius: 14px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
h2 {
  margin: 8px 0 0;
  font-size: 18px;
}
p {
  margin: 0;
}
.dim {
  color: var(--text-dim);
}
.small {
  font-size: 11.5px;
  line-height: 1.6;
  margin-bottom: 10px;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
