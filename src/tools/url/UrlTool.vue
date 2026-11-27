<script setup lang="ts">
import { computed, ref } from 'vue'
import EditorPane from '@/components/EditorPane.vue'
import { decodeUrl, encodeUrl, parseQuery, type UrlMode } from './logic'

const direction = ref<'encode' | 'decode'>('encode')
const scope = ref<UrlMode>('component')
const input = ref('https://example.com/搜索?q=前端 工具&lang=zh-CN')

const result = computed(() => {
  if (!input.value) return { value: '', error: '' }
  if (direction.value === 'encode') return { value: encodeUrl(input.value, scope.value), error: '' }
  const r = decodeUrl(input.value, scope.value)
  return r.ok ? { value: r.value, error: '' } : { value: '', error: r.error }
})

const params = computed(() => parseQuery(direction.value === 'encode' ? input.value : result.value.value || input.value))
</script>

<template>
  <div class="tool-root" data-testid="tool-url">
    <div class="tool-bar">
      <span class="seg" data-testid="url-direction">
        <button :class="{ active: direction === 'encode' }" data-mode="encode" @click="direction = 'encode'">编码</button>
        <button :class="{ active: direction === 'decode' }" data-mode="decode" @click="direction = 'decode'">解码</button>
      </span>
      <span class="seg" data-testid="url-scope">
        <button :class="{ active: scope === 'component' }" data-scope="component" title="encodeURIComponent" @click="scope = 'component'">组件</button>
        <button :class="{ active: scope === 'full' }" data-scope="full" title="encodeURI" @click="scope = 'full'">完整 URL</button>
      </span>
      <span class="hint">{{ scope === 'component' ? 'encodeURIComponent：编码所有保留字符' : 'encodeURI：保留 : / ? # & = 等结构字符' }}</span>
    </div>
    <div class="panes">
      <EditorPane v-model="input" title="输入" placeholder="输入文本或 URL…" />
      <EditorPane :model-value="result.value" title="输出" read-only />
    </div>
    <div v-if="params.length" class="params" data-testid="url-params">
      <div class="pane-title"><span>查询参数（{{ params.length }}）</span></div>
      <table>
        <tbody>
          <tr v-for="(p, i) in params" :key="i">
            <td class="k mono selectable">{{ p.key }}</td>
            <td class="v mono selectable">{{ p.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="tool-status" :class="result.error ? 'error' : ''" data-testid="url-status">
      {{ result.error || (input ? '转换完成' : '输入内容后将实时转换') }}
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
.hint {
  font-size: 11.5px;
  color: var(--text-dim);
}
.params {
  max-height: 140px;
  overflow: auto;
  border-top: 0.5px solid var(--hairline);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
td {
  padding: 3px 12px;
  border-top: 0.5px solid var(--hairline);
  word-break: break-all;
}
.k {
  width: 30%;
  color: var(--accent);
}
</style>
