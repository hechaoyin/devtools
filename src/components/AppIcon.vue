<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { resolveColor } from '@/lib/colors'

const props = withDefaults(defineProps<{ icon: Component | string; color: string; size?: number }>(), { size: 48 })

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.size * 0.225}px`,
  background: resolveColor(props.color),
}))
</script>

<template>
  <div class="app-icon" :style="style">
    <span v-if="typeof icon === 'string'" class="emoji" :style="{ fontSize: `${size * 0.52}px` }">{{ icon }}</span>
    <component :is="icon" v-else :size="size * 0.54" :stroke-width="1.9" color="#fff" />
  </div>
</template>

<style scoped>
.app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.25),
    inset 0 0.5px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12);
}
.emoji {
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}
</style>
