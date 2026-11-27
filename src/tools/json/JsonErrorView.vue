<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ good: string; bad: string }>()

/** 错误位置之后可能有数 MB 内容，只渲染前一段，避免整页卡顿 */
const MAX_BAD = 20_000
const shownBad = computed(() => props.bad.slice(0, MAX_BAD))
const hidden = computed(() => props.bad.length - shownBad.value.length)
const marker = ref<HTMLElement>()

watch(
  () => [props.good, props.bad],
  () => marker.value?.scrollIntoView({ block: 'center' }),
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <div class="err-view" data-testid="json-error-view">
    <pre><span data-testid="json-error-good">{{ good }}</span><span v-if="bad" ref="marker" class="bad" data-testid="json-error-bad">{{ shownBad }}</span><span v-else ref="marker" class="eof" data-testid="json-error-eof">⏎ 输入在此意外结束</span><span v-if="hidden > 0" class="more">{{ `\n…（其后还有 ${hidden} 个字符未显示）` }}</span></pre>
  </div>
</template>

<style scoped>
.err-view {
  height: 100%;
  overflow: auto;
  border-top: 0.5px solid var(--hairline);
  background: var(--window-content);
}
pre {
  margin: 0;
  padding: 8px 12px;
  min-height: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}
.bad {
  color: #ff453a;
  background: rgba(255, 69, 58, 0.12);
  border-radius: 2px;
}
.eof {
  color: #ff453a;
  background: rgba(255, 69, 58, 0.12);
  border-radius: 3px;
  padding: 0 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  font-size: 11.5px;
}
.more {
  color: var(--text-dim);
}
</style>
