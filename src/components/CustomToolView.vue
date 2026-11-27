<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, RefreshCw } from 'lucide-vue-next'
import { buildSandboxDoc, CODE_SANDBOX, URL_SANDBOX } from '@/lib/customTools'
import type { CustomTool } from '@/types'

const props = defineProps<{ tool: CustomTool }>()

const nonce = ref(0)
const srcdoc = computed(() => (props.tool.type === 'code' ? buildSandboxDoc(props.tool) : undefined))
</script>

<template>
  <div class="custom-view">
    <div v-if="tool.type === 'url'" class="bar">
      <span class="url selectable" :title="tool.url">{{ tool.url }}</span>
      <span class="hint">若页面空白，可能是目标站点禁止被嵌入</span>
      <button class="btn btn-icon" title="刷新" @click="nonce++"><RefreshCw :size="13" /></button>
      <a class="btn btn-icon" :href="tool.url" target="_blank" rel="noopener noreferrer" title="在新标签页打开"><ExternalLink :size="13" /></a>
    </div>
    <iframe
      v-if="tool.type === 'url'"
      :key="nonce"
      :src="tool.url"
      :sandbox="URL_SANDBOX"
      referrerpolicy="no-referrer"
      loading="lazy"
      :title="tool.name"
    />
    <iframe v-else :key="nonce" :srcdoc="srcdoc" :sandbox="CODE_SANDBOX" referrerpolicy="no-referrer" :title="tool.name" class="code" />
  </div>
</template>

<style scoped>
.custom-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--window-content);
  border-bottom: 0.5px solid var(--hairline);
}
.url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-dim);
  font-size: 12px;
}
.hint {
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
}
iframe {
  flex: 1;
  width: 100%;
  border: 0;
  background: #fff;
}
</style>
