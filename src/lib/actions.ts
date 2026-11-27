import { useAppsStore, APP_MANAGER_ID, SETTINGS_ID } from '@/stores/apps'
import { useWindowsStore } from '@/stores/windows'
import { useUiStore, type MenuItem } from '@/stores/ui'

export function useActions() {
  const apps = useAppsStore()
  const windows = useWindowsStore()
  const ui = useUiStore()

  function launch(appId: string) {
    const app = apps.resolve(appId)
    if (!app) return
    ui.closeLaunchpad()
    windows.open(app)
  }

  function openManager(tab?: Parameters<typeof ui.requestManager>[0], action?: Parameters<typeof ui.requestManager>[1]) {
    ui.requestManager(tab, action)
    launch(APP_MANAGER_ID)
  }

  const openSettings = () => launch(SETTINGS_ID)

  function appContextMenu(appId: string): MenuItem[] {
    const app = apps.resolve(appId)
    if (!app) return []
    const open = windows.isOpen(appId)
    const isSystem = app.kind === 'system'
    const items: MenuItem[] = [
      { label: open ? '显示窗口' : '打开', action: () => launch(appId) },
    ]
    if (open) {
      items.push({ label: '退出', action: () => windows.close(appId) })
    }
    if (!isSystem) {
      items.push({ separator: true })
      items.push({
        label: apps.isPinned(appId) ? '从 Dock 中移除' : '保留在 Dock 中',
        action: () => apps.togglePin(appId),
      })
      items.push({
        label: '在应用管理器中显示',
        action: () => openManager('installed'),
      })
    }
    return items
  }

  return { launch, openManager, openSettings, appContextMenu }
}
