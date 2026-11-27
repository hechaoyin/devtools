<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import { WALLPAPERS } from '@/lib/wallpapers'
import { useAppsStore } from '@/stores/apps'
import { useWindowsStore } from '@/stores/windows'

const settings = useSettingsStore()
const apps = useAppsStore()
const windows = useWindowsStore()

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'auto', label: '跟随系统' },
]

function reset() {
  if (confirm('将恢复默认的已安装工具、Dock 与窗口布局，并删除所有自定义工具。继续吗？')) {
    apps.resetDefaults()
    windows.closeAll()
  }
}
</script>

<template>
  <div class="settings">
    <section>
      <h3>外观</h3>
      <div class="seg" data-testid="theme-seg">
        <button v-for="t in THEMES" :key="t.id" :class="{ active: settings.theme === t.id }" :data-theme-option="t.id" @click="settings.theme = t.id">
          {{ t.label }}
        </button>
      </div>
    </section>
    <section>
      <h3>桌面壁纸</h3>
      <div class="walls">
        <button
          v-for="w in WALLPAPERS"
          :key="w.id"
          class="wall"
          :class="{ on: settings.wallpaperId === w.id }"
          :data-wallpaper="w.id"
          :style="{ background: settings.isDark ? w.dark : w.light }"
          @click="settings.wallpaperId = w.id"
        >
          <span class="badge" v-if="settings.wallpaperId === w.id"><Check :size="12" /></span>
          <span class="name">{{ w.name }}</span>
        </button>
      </div>
    </section>
    <section>
      <h3>数据</h3>
      <p class="dim">所有设置、窗口布局与自定义工具都保存在浏览器 localStorage 中。</p>
      <button class="btn btn-danger" @click="reset">恢复默认设置…</button>
    </section>
  </div>
</template>

<style scoped>
.settings {
  height: 100%;
  overflow: auto;
  padding: 18px 22px;
  background: var(--window-content);
  display: flex;
  flex-direction: column;
  gap: 22px;
}
h3 {
  margin: 0 0 10px;
  font-size: 13px;
}
.dim {
  color: var(--text-dim);
  margin: 0 0 10px;
}
.walls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.wall {
  all: unset;
  position: relative;
  height: 92px;
  border-radius: 10px;
  box-sizing: border-box;
  border: 2px solid transparent;
  box-shadow: 0 0 0 0.5px var(--border);
  cursor: pointer;
  display: flex;
  align-items: flex-end;
  padding: 8px 10px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.wall.on {
  border-color: var(--accent);
}
.badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
