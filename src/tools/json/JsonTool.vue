<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard, useLocalStorage } from '@vueuse/core'
import { Check, Copy } from 'lucide-vue-next'
import EditorPane from '@/components/EditorPane.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import { useActions } from '@/lib/actions'
import { sendToXmlTool } from '@/tools/xml/handoff'
import JsonErrorView from './JsonErrorView.vue'
import JsonTree from './JsonTree.vue'
import { formatLenient } from './lenient'
import { escapeJsonString, formatJson, minifyJson, unescapeJsonString, validateJson } from './logic'
import { jsonToXml } from './toXml'
import type { JsonError, JsonResult, LenientFormat } from './types'

const SAMPLE = '{"name":"工具箱","tags":["json","xml"],"nested":{"ok":true,"n":1.5,"empty":null}}'

const { launch } = useActions()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })

const input = ref(SAMPLE)
const output = ref('')
const outputLang = ref<'json' | 'xml'>('json')
const errorView = ref<LenientFormat | null>(null)
const indent = useLocalStorage<string>('toolbox:json:indent', '2')
const sort = useLocalStorage('toolbox:json:sort', false)
const view = useLocalStorage<'text' | 'tree'>('toolbox:json:view', 'text')
const rootName = useLocalStorage('toolbox:json:xml-root', 'root')
const status = ref<{ kind: 'ok' | 'error' | ''; message: string }>({ kind: '', message: '' })
const tree = ref<InstanceType<typeof JsonTree>>()

const live = computed(() => (input.value.trim() ? validateJson(input.value) : null))
const indentValue = computed(() => (indent.value === 'tab' ? 'tab' : Number(indent.value)) as number | 'tab')
const copyText = computed(() => (errorView.value ? errorView.value.good + errorView.value.bad : output.value))

function describe(e: JsonError) {
  if (!e.line) return e.message
  return `第 ${e.line} 行第 ${e.column} 列（位置 ${e.position ?? '?'}）：${e.message}`
}

function setOk(value: string, message: string, lang: 'json' | 'xml' = 'json') {
  view.value = 'text'
  errorView.value = null
  output.value = value
  outputLang.value = lang
  status.value = { kind: 'ok', message }
}

/** 输入非法时：错误位置之前的内容照常格式化，错误位置及其后的字符标红，并提示行列号 */
function showError(fallback?: JsonError) {
  view.value = 'text'
  output.value = ''
  outputLang.value = 'json'
  const lenient = formatLenient(input.value, indentValue.value)
  const error = lenient.error ?? fallback ?? { message: '无效的 JSON' }
  errorView.value = lenient.error && (lenient.good || lenient.bad || lenient.error.position !== undefined) ? lenient : null
  status.value = { kind: 'error', message: describe(error) }
}

function apply(result: JsonResult, okMessage: string, lang: 'json' | 'xml' = 'json') {
  if (result.ok) setOk(result.value, okMessage, lang)
  else showError(result.error)
}

const format = () => apply(formatJson(input.value, { indent: indentValue.value, sortKeys: sort.value }), '格式化完成')
const minify = () => apply(minifyJson(input.value), '压缩完成')
const toXml = () => apply(jsonToXml(input.value, { rootName: rootName.value, indent: indentValue.value }), '已转换为 XML', 'xml')
function escape() {
  setOk(escapeJsonString(input.value), '已转义（可直接放入 JSON 字符串中）')
}
function unescape() {
  const r = unescapeJsonString(input.value)
  if (r.ok) setOk(r.value, '已反转义')
  else {
    view.value = 'text'
    errorView.value = null
    output.value = ''
    status.value = { kind: 'error', message: r.error.message }
  }
}
function validate() {
  const r = validateJson(input.value)
  if (r.valid) status.value = { kind: 'ok', message: '✓ 有效的 JSON' }
  else showError(r.error)
}
function useOutput() {
  input.value = output.value
  output.value = ''
}
function sendToXml() {
  sendToXmlTool(output.value)
  launch('xml')
}

function expandAll() {
  const r = tree.value?.expandAll()
  if (!r) return
  status.value = r.complete
    ? { kind: 'ok', message: `已展开全部（共 ${r.count} 个节点）` }
    : { kind: '', message: `节点过多，已展开前 ${r.count} 个节点（上限 ${tree.value?.limit}），其余保持折叠` }
}
function collapseAll() {
  tree.value?.collapseAll()
  status.value = { kind: '', message: '已折叠全部' }
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
      <span class="group">
        <button class="btn" data-testid="json-to-xml" @click="toXml">转 XML</button>
        <input v-model="rootName" class="field root-input" placeholder="root" title="XML 根节点名称" data-testid="json-xml-root" />
      </span>
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
      <div class="out-pane">
        <div class="pane-title">
          <span class="title-left">
            输出
            <span class="seg">
              <button :class="{ active: view === 'text' }" data-testid="json-view-text" @click="view = 'text'">文本</button>
              <button :class="{ active: view === 'tree' }" data-testid="json-view-tree" @click="view = 'tree'">树</button>
            </span>
          </span>
          <span class="actions">
            <template v-if="view === 'tree'">
              <button class="mini" data-testid="json-expand-all" @click="expandAll">展开全部</button>
              <button class="mini" data-testid="json-collapse-all" @click="collapseAll">折叠全部</button>
            </template>
            <template v-else>
              <button v-if="outputLang === 'xml' && output" class="mini" data-testid="json-send-xml" @click="sendToXml">发送到 XML 工具</button>
              <button v-if="outputLang === 'json'" class="mini" :disabled="!output" data-testid="json-use-output" @click="useOutput">用作输入</button>
              <button class="mini" :disabled="!copyText" data-testid="json-copy" @click="copy(copyText)">
                <Check v-if="copied" :size="12" />
                <Copy v-else :size="12" />
                {{ copied ? '已复制' : '复制' }}
              </button>
            </template>
          </span>
        </div>
        <div class="out-body">
          <div class="fill">
            <JsonTree v-if="view === 'tree'" ref="tree" :text="input" />
            <JsonErrorView v-else-if="errorView" :good="errorView.good" :bad="errorView.bad" />
            <div v-else class="editor">
              <CodeEditor :model-value="output" :language="outputLang" read-only />
            </div>
          </div>
        </div>
      </div>
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
.out-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.out-body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.fill {
  position: absolute;
  inset: 0;
}
.editor {
  height: 100%;
  border-top: 0.5px solid var(--hairline);
}
.title-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.seg button {
  padding: 0 9px;
  font-size: 11px;
}
.actions {
  display: inline-flex;
  gap: 4px;
}
.group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.root-input {
  width: 74px;
  padding: 3px 7px;
  font-size: 12px;
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
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 0;
  background: transparent;
  color: var(--text-dim);
  font: inherit;
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
