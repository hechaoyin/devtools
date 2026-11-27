import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface MenuItem {
  label?: string
  action?: () => void
  disabled?: boolean
  separator?: boolean
  checked?: boolean
  shortcut?: string
}

export type ManagerTab = 'installed' | 'store' | 'custom'

export const useUiStore = defineStore('ui', () => {
  const launchpadOpen = ref(false)
  const aboutOpen = ref(false)
  const contextMenu = ref<{ x: number; y: number; items: MenuItem[] } | null>(null)
  /** 供应用管理器消费的一次性意图（例如菜单栏触发“新建自定义工具”） */
  const managerIntent = ref<{ tab?: ManagerTab; action?: 'new' | 'import' | 'export'; nonce: number } | null>(null)

  const openLaunchpad = () => (launchpadOpen.value = true)
  const closeLaunchpad = () => (launchpadOpen.value = false)
  const toggleLaunchpad = () => (launchpadOpen.value = !launchpadOpen.value)

  function showContextMenu(x: number, y: number, items: MenuItem[]) {
    contextMenu.value = { x, y, items }
  }
  const hideContextMenu = () => (contextMenu.value = null)

  function requestManager(tab?: ManagerTab, action?: 'new' | 'import' | 'export') {
    managerIntent.value = { tab, action, nonce: Date.now() }
  }

  return {
    launchpadOpen,
    aboutOpen,
    contextMenu,
    managerIntent,
    openLaunchpad,
    closeLaunchpad,
    toggleLaunchpad,
    showContextMenu,
    hideContextMenu,
    requestManager,
  }
})
