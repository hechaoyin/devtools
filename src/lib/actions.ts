import { useAppsStore, APP_MANAGER_ID, SETTINGS_ID } from '@/stores/apps'
import { useGroupsStore } from '@/stores/groups'
import { useWindowsStore } from '@/stores/windows'
import { useUiStore, type MenuItem } from '@/stores/ui'

export function useActions() {
  const apps = useAppsStore()
  const windows = useWindowsStore()
  const ui = useUiStore()
  const groups = useGroupsStore()

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

  function deleteGroup(groupId: string) {
    const g = groups.get(groupId)
    if (!g) return
    const run = () => groups.remove(groupId)
    if (!g.appIds.length) return run()
    ui.askConfirm({
      title: `删除组「${g.name}」？`,
      message: `组内的 ${g.appIds.length} 个应用不会被卸载，仍可在 Launchpad 与 Dock 中使用。`,
      confirmLabel: '删除',
      danger: true,
      onConfirm: run,
    })
  }

  function groupContextMenu(groupId: string): MenuItem[] {
    return [
      { label: '添加应用…', action: () => groups.openPopover(groupId, 'picker') },
      { label: '重命名', action: () => groups.startRename(groupId) },
      { separator: true },
      { label: '删除组…', action: () => deleteGroup(groupId) },
    ]
  }

  function groupAppContextMenu(groupId: string, appId: string): MenuItem[] {
    return [
      {
        label: '打开',
        action: () => {
          groups.closePopover()
          launch(appId)
        },
      },
      { separator: true },
      { label: '从组中移除', action: () => groups.removeApp(groupId, appId) },
    ]
  }

  return { launch, openManager, openSettings, appContextMenu, deleteGroup, groupContextMenu, groupAppContextMenu }
}
