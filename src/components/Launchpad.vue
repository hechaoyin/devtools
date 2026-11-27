<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import { useAppsStore, SYSTEM_APPS } from '@/stores/apps'
import { useUiStore } from '@/stores/ui'
import { useActions } from '@/lib/actions'

const apps = useAppsStore()
const ui = useUiStore()
const { launch } = useActions()

const query = ref('')
const input = ref<HTMLInputElement>()
const active = ref(0)

const all = computed(() => [...apps.installedApps, ...SYSTEM_APPS])
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return all.value
  return all.value.filter((a) => `${a.name} ${a.description} ${a.category}`.toLowerCase().includes(q))
})

watch(
  () => ui.launchpadOpen,
  async (open) => {
    if (open) {
      query.value = ''
      active.value = 0
      await nextTick()
      input.value?.focus()
    }
  },
)
watch(query, () => (active.value = 0))

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    ui.toggleLaunchpad()
    return
  }
  if (!ui.launchpadOpen) return
  if (e.key === 'Escape') ui.closeLaunchpad()
  else if (e.key === 'Enter' && results.value[active.value]) launch(results.value[active.value].id)
  else if (e.key === 'ArrowRight') active.value = Math.min(results.value.length - 1, active.value + 1)
  else if (e.key === 'ArrowLeft') active.value = Math.max(0, active.value - 1)
})
</script>

<template>
  <Transition name="lp">
    <div v-if="ui.launchpadOpen" class="launchpad glass" data-testid="launchpad" @mousedown.self="ui.closeLaunchpad" @contextmenu.prevent>
      <div class="search" @mousedown.stop>
        <Search :size="15" />
        <input ref="input" v-model="query" placeholder="搜索工具" data-testid="launchpad-search" />
      </div>
      <div class="grid" @mousedown.self="ui.closeLaunchpad">
        <button
          v-for="(app, i) in results"
          :key="app.id"
          class="cell"
          :class="{ active: i === active }"
          :data-testid="`lp-${app.id}`"
          @click="launch(app.id)"
        >
          <AppIcon :icon="app.icon" :color="app.color" :size="84" />
          <span class="name">{{ app.name }}</span>
        </button>
        <p v-if="!results.length" class="empty">没有找到匹配的工具</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.launchpad {
  position: fixed;
  inset: 0;
  z-index: 95000;
  background: rgba(20, 22, 30, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 56px;
  -webkit-backdrop-filter: blur(40px) saturate(150%);
  backdrop-filter: blur(40px) saturate(150%);
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 260px;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  border: 0.5px solid rgba(255, 255, 255, 0.25);
  color: #fff;
}
.search input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  color: #fff;
  font: inherit;
  font-size: 14px;
  user-select: text;
}
.search input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
.grid {
  flex: 1;
  width: min(1100px, 92vw);
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  align-content: start;
  justify-items: center;
  gap: 32px 12px;
  padding: 54px 20px 140px;
}
.cell {
  all: unset;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 130px;
  padding: 10px 0;
  border-radius: 16px;
  cursor: default;
  color: #fff;
  transition: transform 0.15s;
}
.cell:hover {
  transform: scale(1.06);
}
.cell.active {
  background: rgba(255, 255, 255, 0.14);
}
.name {
  font-size: 13px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  text-align: center;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  grid-column: 1 / -1;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 60px;
}
.lp-enter-active,
.lp-leave-active {
  transition: opacity 0.22s, transform 0.22s;
}
.lp-enter-from,
.lp-leave-to {
  opacity: 0;
  transform: scale(1.06);
}
</style>
