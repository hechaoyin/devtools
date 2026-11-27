<script setup lang="ts">
import { watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import GroupIcon from './GroupIcon.vue'
import { useGroupsStore } from '@/stores/groups'

const store = useGroupsStore()
const size = useWindowSize()

watch([size.width, size.height], ([w, h]) => store.setViewport({ w, h }), { immediate: true })
</script>

<template>
  <div class="groups" data-testid="desktop-groups">
    <GroupIcon v-for="g in store.groups" :key="g.id" :group="g" />
  </div>
</template>

<style scoped>
.groups {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.groups > :deep(*) {
  pointer-events: auto;
}
</style>
