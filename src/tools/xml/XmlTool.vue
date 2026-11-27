<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import EditorPane from '@/components/EditorPane.vue'
import { pendingXmlInput } from './handoff'
import { formatXml, minifyXml, validateXml, type XmlResult } from './logic'

const SAMPLE = '<?xml version="1.0" encoding="UTF-8"?><catalog><book id="1"><title>Vue 3 设计与实现</title><price>79.00</price></book><book id="2"><title>TypeScript 入门</title><price>59.00</price></book></catalog>'

const input = ref(SAMPLE)
const output = ref('')
const indent = useLocalStorage<string>('toolbox:xml:indent', '2')
const status = ref<{ kind: 'ok' | 'error' | ''; message: string }>({ kind: '', message: '' })

const live = computed(() => (input.value.trim() ? validateXml(input.value) : null))
const indentValue = computed(() => (indent.value === 'tab' ? 'tab' : Number(indent.value)) as number | 'tab')

function apply(r: XmlResult, okMessage: string) {
  if (r.ok) {
    output.value = r.value
    status.value = { kind: 'ok', message: okMessage }
  } else {
    output.value = ''
    status.value = { kind: 'error', message: r.error }
  }
}
function takePending() {
  if (pendingXmlInput.value === null) return
  input.value = pendingXmlInput.value
  pendingXmlInput.value = null
  output.value = ''
  status.value = { kind: 'ok', message: '已接收来自其它工具的 XML' }
}
takePending()
watch(pendingXmlInput, takePending)

const format = () => apply(formatXml(input.value, indentValue.value), '格式化完成')
const minify = () => apply(minifyXml(input.value), '压缩完成')
function validate() {
  const r = validateXml(input.value)
  status.value = r.valid ? { kind: 'ok', message: '✓ 有效的 XML' } : { kind: 'error', message: r.error ?? '无效的 XML' }
}
</script>

<template>
  <div class="tool-root" data-testid="tool-xml">
    <div class="tool-bar">
      <button class="btn btn-primary" data-testid="xml-format" @click="format">格式化</button>
      <button class="btn" data-testid="xml-minify" @click="minify">压缩</button>
      <button class="btn" data-testid="xml-validate" @click="validate">校验</button>
      <span class="spacer" />
      <label class="opt">缩进
        <select v-model="indent" class="field">
          <option value="2">2 空格</option>
          <option value="4">4 空格</option>
          <option value="tab">Tab</option>
        </select>
      </label>
    </div>
    <div class="panes">
      <EditorPane v-model="input" title="输入" language="xml" placeholder="在此粘贴 XML…" />
      <EditorPane :model-value="output" title="输出" language="xml" read-only />
    </div>
    <div class="tool-status" :class="status.kind" data-testid="xml-status">
      <span>{{ status.message || '选择上方操作开始处理' }}</span>
      <span class="spacer" />
      <span v-if="live" :class="live.valid ? 'ok-text' : 'err-text'">{{ live.valid ? '输入：有效 XML' : '输入：无效 XML' }}</span>
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
</style>
