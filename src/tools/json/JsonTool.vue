<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import EditorPane from '@/components/EditorPane.vue'
import { escapeJsonString, formatJson, minifyJson, unescapeJsonString, validateJson, type JsonError, type JsonResult } from './logic'

const SAMPLE = '{"name":"工具箱","tags":["json","xml"],"nested":{"ok":true,"n":1.5,"empty":null}}'

const input = ref(SAMPLE)
const output = ref('')
const indent = useLocalStorage<string>('toolbox:json:indent', '2')
const sort = useLocalStorage('toolbox:json:sort', false)
const status = ref<{ kind: 'ok' | 'error' | ''; message: string }>({ kind: '', message: '' })

const live = computed(() => (input.value.trim() ? validateJson(input.value) : null))

const indentValue = computed(() => (indent.value === 'tab' ? 'tab' : Number(indent.value)) as number | 'tab')

function describe(e: JsonError) {
  return e.line ? `第 ${e.line} 行第 ${e.column} 列：${e.message}` : e.message
}

function apply(result: JsonResult, okMessage: string) {
  if (result.ok) {
    output.value = result.value
    status.value = { kind: 'ok', message: okMessage }
  } else {
    output.value = ''
    status.value = { kind: 'error', message: describe(result.error) }
  }
}

const format = () => apply(formatJson(input.value, { indent: indentValue.value, sortKeys: sort.value }), '格式化完成')
const minify = () => apply(minifyJson(input.value), '压缩完成')
const escape = () => {
  output.value = escapeJsonString(input.value)
  status.value = { kind: 'ok', message: '已转义（可直接放入 JSON 字符串中）' }
}
const unescape = () => apply(unescapeJsonString(input.value), '已反转义')
function validate() {
  const r = validateJson(input.value)
  status.value = r.valid ? { kind: 'ok', message: '✓ 有效的 JSON' } : { kind: 'error', message: describe(r.error!) }
}
const useOutput = () => {
  input.value = output.value
  output.value = ''
}
</script>

<template>
  <div class="tool-root" data-testid="tool-json">
    <div class="tool-bar">
      <button class="btn btn-primary" data-testid="json-format" @click="format">格式化</button>
      <button class="btn" data-testid="json-minify" @click="minify">压缩</button>
      <button class="btn" data-testid="json-validate" @click="validate">校验</button>
      <button class="btn" data-testid="json-escape" @click="escape">转义</button>
      <button class="btn" data-testid="json-unescape" @click="unescape">去转义</button>
      <span class="spacer" />
      <label class="opt">缩进
        <select v-model="indent" class="field">
          <option value="2">2 空格</option>
          <option value="4">4 空格</option>
          <option value="tab">Tab</option>
        </select>
      </label>
      <label class="opt"><input v-model="sort" type="checkbox" /> 键排序</label>
    </div>
    <div class="panes">
      <EditorPane v-model="input" title="输入" language="json" placeholder="在此粘贴 JSON…" />
      <EditorPane :model-value="output" title="输出" language="json" read-only>
        <template #actions>
          <button class="mini" :disabled="!output" data-testid="json-use-output" @click="useOutput">用作输入</button>
        </template>
      </EditorPane>
    </div>
    <div class="tool-status" :class="status.kind" data-testid="json-status">
      <span>{{ status.message || '选择上方操作开始处理' }}</span>
      <span class="spacer" />
      <span v-if="live" :class="live.valid ? 'ok-text' : 'err-text'" data-testid="json-live">
        {{ live.valid ? '输入：有效 JSON' : '输入：无效 JSON' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.panes {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
.panes > :first-child {
  border-right: 0.5px solid var(--hairline);
}
.spacer {
  flex: 1;
}
.opt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-dim);
}
.ok-text {
  color: #30a14e;
}
.err-text {
  color: #ff453a;
}
.mini {
  border: 0;
  background: transparent;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 4px;
}
.mini:hover:not(:disabled) {
  background: var(--control-hover);
  color: var(--text);
}
.mini:disabled {
  opacity: 0.4;
}
</style>
