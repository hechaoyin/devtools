<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside, useDateFormat, useEventListener } from '@vueuse/core'
import { useClock } from '@/lib/useClock'
import { Search, Sun, Moon } from 'lucide-vue-next'
import { useWindowsStore } from '@/stores/windows'
import { useAppsStore } from '@/stores/apps'
import { useUiStore, type MenuItem } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { useActions } from '@/lib/actions'

const windows = useWindowsStore()
const apps = useAppsStore()
const ui = useUiStore()
const settings = useSettingsStore()
const { launch, openManager, openSettings } = useActions()

const now = useClock()
const clock = useDateFormat(now, 'M月D日 ddd HH:mm', { locales: 'zh-CN' })

const root = ref<HTMLElement>()
const openMenu = ref<string | null>(null)
onClickOutside(root, () => (openMenu.value = null))
useEventListener(window, 'keydown', (e) => e.key === 'Escape' && (openMenu.value = null))

const focusedApp = computed(() => (windows.focusedId ? apps.resolve(windows.focusedId) : undefined))
const appName = computed(() => focusedApp.value?.name ?? '工具箱')

function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}

const hasFocus = computed(() => !!focusedApp.value)

const menus = computed<{ id: string; label: string; bold?: boolean; items: MenuItem[] }[]>(() => [
  {
    id: 'apple',
    label: '',
    items: [
      { label: '关于工具箱', action: () => (ui.aboutOpen = true) },
      { separator: true },
      { label: '应用管理器…', action: () => openManager() },
      { label: '系统设置…', action: openSettings },
      { separator: true },
      { label: 'Launchpad', action: ui.toggleLaunchpad },
    ],
  },
  {
    id: 'app',
    label: appName.value,
    bold: true,
    items: [
      { label: '关于工具箱', action: () => (ui.aboutOpen = true) },
      { separator: true },
      {
        label: focusedApp.value ? `退出 ${focusedApp.value.name}` : '退出',
        disabled: !hasFocus.value,
        action: () => windows.focusedId && windows.close(windows.focusedId),
      },
    ],
  },
  {
    id: 'file',
    label: '文件',
    items: [
      { label: '新建自定义工具…', action: () => openManager('custom', 'new') },
      { separator: true },
      { label: '导入配置…', action: () => openManager('custom', 'import') },
      { label: '导出配置', action: () => openManager('custom', 'export') },
    ],
  },
  {
    id: 'window',
    label: '窗口',
    items: [
      { label: '最小化', disabled: !hasFocus.value, action: () => windows.focusedId && windows.minimize(windows.focusedId) },
      { label: '缩放', disabled: !hasFocus.value, action: () => windows.focusedId && windows.toggleMaximize(windows.focusedId) },
      { label: '关闭窗口', disabled: !hasFocus.value, action: () => windows.focusedId && windows.close(windows.focusedId) },
      { separator: true },
      { label: '全部最小化', disabled: !windows.windows.length, action: windows.minimizeAll },
      { label: '全部关闭', disabled: !windows.windows.length, action: windows.closeAll },
      ...(windows.windows.length
        ? [
            { separator: true } as MenuItem,
            ...windows.windows.map((w) => ({
              label: apps.resolve(w.appId)?.name ?? w.appId,
              checked: w.appId === windows.focusedId,
              action: () => launch(w.appId),
            })),
          ]
        : []),
    ],
  },
  {
    id: 'view',
    label: '视图',
    items: [
      { label: 'Launchpad', shortcut: 'Ctrl K', action: ui.toggleLaunchpad },
      { label: settings.isDark ? '切换到浅色模式' : '切换到深色模式', action: settings.toggleTheme },
      { label: '进入/退出全屏', action: fullscreen },
    ],
  },
])

function toggle(id: string) {
  openMenu.value = openMenu.value === id ? null : id
}
function hover(id: string) {
  if (openMenu.value) openMenu.value = id
}
function run(item: MenuItem) {
  if (item.disabled || item.separator) return
  openMenu.value = null
  item.action?.()
}
</script>

<template>
  <header ref="root" class="menubar glass" @contextmenu.prevent>
    <nav class="left">
      <div v-for="m in menus" :key="m.id" class="menu-wrap">
        <button
          class="menu-btn"
          :class="{ bold: m.bold, active: openMenu === m.id, logo: m.id === 'apple' }"
          :data-menu="m.id"
          @click="toggle(m.id)"
          @mouseenter="hover(m.id)"
        >
          <svg v-if="m.id === 'apple'" viewBox="0 0 64 64" width="15" height="15" aria-label="工具箱">
            <rect width="64" height="64" rx="15" fill="currentColor" opacity="0.9" />
            <path d="M20 24l-8 8 8 8M44 24l8 8-8 8M36 20l-8 24" fill="none" stroke="var(--menubar-glyph)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <template v-else>{{ m.label }}</template>
        </button>
        <div v-if="openMenu === m.id" class="dropdown glass">
          <template v-for="(item, i) in m.items" :key="i">
            <div v-if="item.separator" class="sep" />
            <button v-else class="item" :disabled="item.disabled" @click="run(item)">
              <span class="check">{{ item.checked ? '✓' : '' }}</span>
              <span class="label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
            </button>
          </template>
        </div>
      </div>
    </nav>
    <div class="right">
      <button class="icon-btn" title="搜索（Launchpad）" @click="ui.openLaunchpad"><Search :size="14" /></button>
      <button class="icon-btn" :title="settings.isDark ? '切换到浅色' : '切换到深色'" data-testid="theme-toggle" @click="settings.toggleTheme">
        <Moon v-if="!settings.isDark" :size="14" />
        <Sun v-else :size="14" />
      </button>
      <span class="clock">{{ clock }}</span>
    </div>
  </header>
</template>

<style scoped>
.menubar {
  --menubar-glyph: #fff;
  position: fixed;
  inset: 0 0 auto 0;
  height: 28px;
  z-index: 90000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: var(--menubar-bg);
  border-bottom: 0.5px solid var(--hairline);
  font-size: 13px;
  color: var(--text);
}
[data-theme='dark'] .menubar {
  --menubar-glyph: #1e1e22;
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: 2px;
}
.menu-wrap {
  position: relative;
}
.menu-btn {
  height: 22px;
  padding: 0 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: default;
  display: inline-flex;
  align-items: center;
}
.menu-btn.bold {
  font-weight: 700;
}
.menu-btn.logo {
  padding: 0 8px;
}
.menu-btn:hover,
.menu-btn.active {
  background: var(--control-hover);
}
.dropdown {
  position: absolute;
  top: 25px;
  left: 0;
  min-width: 210px;
  padding: 5px;
  border-radius: 9px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
}
.item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 3px 10px 3px 4px;
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
  text-align: center;
  font-size: 11px;
}
.label {
  flex: 1;
  white-space: nowrap;
}
.shortcut {
  margin-left: 22px;
  color: var(--text-dim);
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
.icon-btn {
  height: 22px;
  width: 26px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}
.icon-btn:hover {
  background: var(--control-hover);
}
.clock {
  padding: 0 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
