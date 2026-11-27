<script setup lang="ts">
import { watchEffect } from 'vue'
import MenuBar from './components/MenuBar.vue'
import Dock from './components/Dock.vue'
import Launchpad from './components/Launchpad.vue'
import DesktopGroups from './components/DesktopGroups.vue'
import GroupPopover from './components/GroupPopover.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import WindowManager from './components/WindowManager.vue'
import ContextMenu from './components/ContextMenu.vue'
import AboutDialog from './components/AboutDialog.vue'
import { useSettingsStore } from './stores/settings'
import { useUiStore } from './stores/ui'
import { useGroupsStore } from './stores/groups'
import { useActions } from './lib/actions'

const settings = useSettingsStore()
const ui = useUiStore()
const groups = useGroupsStore()
const { openManager, openSettings } = useActions()

watchEffect(() => {
  document.documentElement.dataset.theme = settings.isDark ? 'dark' : 'light'
})

function desktopMenu(e: MouseEvent) {
  ui.showContextMenu(e.clientX, e.clientY, [
    { label: '新建应用组', action: () => groups.createAndRename({ x: e.clientX, y: e.clientY }) },
    { separator: true },
    { label: '打开 Launchpad', action: ui.openLaunchpad },
    { label: '应用管理器…', action: () => openManager() },
    { separator: true },
    { label: '更换壁纸…', action: openSettings },
    { label: settings.isDark ? '切换到浅色模式' : '切换到深色模式', action: settings.toggleTheme },
  ])
}
</script>

<template>
  <div class="desktop" data-testid="desktop" :style="{ background: settings.wallpaperCss }" @contextmenu.prevent="desktopMenu">
    <MenuBar />
    <DesktopGroups />
    <WindowManager />
    <Dock />
    <GroupPopover />
    <Launchpad />
    <ContextMenu />
    <AboutDialog />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.desktop {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background-size: cover;
  transition: background 0.4s;
}
</style>
