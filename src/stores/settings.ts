import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePreferredDark } from '@vueuse/core'
import { loadJson, saveJson, STORAGE_KEYS } from '@/lib/storage'
import { DEFAULT_WALLPAPER, getWallpaper } from '@/lib/wallpapers'

export type ThemeMode = 'light' | 'dark' | 'auto'

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadJson<{ theme?: ThemeMode; wallpaper?: string }>(STORAGE_KEYS.settings, {})
  const theme = ref<ThemeMode>(['light', 'dark', 'auto'].includes(saved.theme as string) ? (saved.theme as ThemeMode) : 'auto')
  const wallpaperId = ref<string>(getWallpaper(saved.wallpaper ?? DEFAULT_WALLPAPER).id)
  const prefersDark = usePreferredDark()

  watch([theme, wallpaperId], () => saveJson(STORAGE_KEYS.settings, { theme: theme.value, wallpaper: wallpaperId.value }))

  const isDark = computed(() => (theme.value === 'auto' ? prefersDark.value : theme.value === 'dark'))
  const wallpaper = computed(() => getWallpaper(wallpaperId.value))
  const wallpaperCss = computed(() => (isDark.value ? wallpaper.value.dark : wallpaper.value.light))

  function toggleTheme() {
    theme.value = isDark.value ? 'light' : 'dark'
  }

  return { theme, wallpaperId, isDark, wallpaperCss, toggleTheme }
})
