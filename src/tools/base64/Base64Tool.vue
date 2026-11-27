<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownUp } from 'lucide-vue-next'
import EditorPane from '@/components/EditorPane.vue'
import { decodeBase64, encodeBase64 } from './logic'

const mode = ref<'encode' | 'decode'>('encode')
const urlSafe = ref(false)
const input = ref('你好，Hello 🌍')

const result = computed(() => {
  if (!input.value) return { value: '', error: '' }
  if (mode.value === 'encode') return { value: encodeBase64(input.value, { urlSafe: urlSafe.value }), error: '' }
  const r = decodeBase64(input.value)
  return r.ok ? { value: r.value, error: '' } : { value: '', error: r.error }
})

function swap() {
  if (result.value.error) return
  const next = result.value.value
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  input.value = next
}
</script>

<template>
  <div class="tool-root" data-testid="tool-base64">
    <div class="tool-bar">
      <span class="seg" data-testid="b64-mode">
        <button :class="{ active: mode === 'encode' }" data-mode="encode" @click="mode = 'encode'">编码</button>
        <button :class="{ active: mode === 'decode' }" data-mode="decode" @click="mode = 'decode'">解码</button>
      </span>
      <label v-if="mode === 'encode'" class="opt"><input v-model="urlSafe" type="checkbox" /> URL-safe（-_ 且无填充）</label>
      <button class="btn" title="将输出作为输入并切换方向" @click="swap"><ArrowDownUp :size="13" /> 交换</button>
    </div>
    <div class="panes">
      <EditorPane v-model="input" :title="mode === 'encode' ? '原文' : 'Base64'" :placeholder="mode === 'encode' ? '输入要编码的文本…' : '输入 Base64…'" />
      <EditorPane :model-value="result.value" :title="mode === 'encode' ? 'Base64' : '原文'" read-only />
    </div>
    <div class="tool-status" :class="result.error ? 'error' : ''" data-testid="b64-status">
      {{ result.error || (input ? `输出 ${result.value.length} 个字符` : '输入内容后将实时转换') }}
    </div>
  </div>
</template>

<style scoped>
.panes {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.panes > :first-child {
  border-right: 0.5px solid var(--hairline);
}
.opt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-dim);
}
</style>
