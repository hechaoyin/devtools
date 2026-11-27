<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useResizeObserver, watchDebounced } from '@vueuse/core'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { formatLenient } from './lenient'
import { parseJsonError } from './logic'
import { collapseAll, createRoot, EXPAND_ALL_LIMIT, expandAll, flatten, isContainer, previewValue, summaryOf, toggle, type TreeNode } from './tree'
import type { JsonError } from './types'

const props = defineProps<{ text: string }>()

const ROW_HEIGHT = 22
const OVERSCAN = 10

const root = shallowRef<TreeNode | null>(null)
const rows = shallowRef<TreeNode[]>([])
const error = ref<JsonError | null>(null)
const scroller = ref<HTMLElement>()
const scrollTop = ref(0)
const viewHeight = ref(400)

useResizeObserver(scroller, (entries) => {
  viewHeight.value = entries[0]?.contentRect.height || 400
})

function refresh() {
  rows.value = root.value ? flatten(root.value) : []
}

function rebuild() {
  error.value = null
  root.value = null
  if (props.text.trim()) {
    try {
      root.value = createRoot(JSON.parse(props.text))
    } catch (err) {
      error.value = formatLenient(props.text).error ?? parseJsonError(props.text, err)
    }
  }
  refresh()
}

watchDebounced(() => props.text, rebuild, { debounce: 250, immediate: true })

const range = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(rows.value.length, Math.ceil((scrollTop.value + viewHeight.value) / ROW_HEIGHT) + OVERSCAN)
  return { start, end }
})
const visible = computed(() => rows.value.slice(range.value.start, range.value.end))

function onToggle(node: TreeNode) {
  if (!isContainer(node) || !node.size) return
  toggle(node)
  refresh()
}

function doExpandAll() {
  if (!root.value) return null
  const result = expandAll(root.value)
  refresh()
  return result
}

function doCollapseAll() {
  if (!root.value) return
  collapseAll(root.value)
  refresh()
  if (scroller.value) scroller.value.scrollTop = 0
}

const keyLabel = (n: TreeNode) => (typeof n.key === 'number' ? String(n.key) : JSON.stringify(n.key))

defineExpose({ expandAll: doExpandAll, collapseAll: doCollapseAll, limit: EXPAND_ALL_LIMIT })
</script>

<template>
  <div class="tree-wrap" data-testid="json-tree">
    <div v-if="!text.trim()" class="tree-empty">在左侧输入 JSON，这里会显示树形结构</div>
    <div v-else-if="error" class="tree-empty err" data-testid="json-tree-error">
      <strong>输入不是有效的 JSON，无法生成树</strong>
      <span>{{ error.line ? `第 ${error.line} 行第 ${error.column} 列：` : '' }}{{ error.message }}</span>
      <span class="hint">切换到「文本」视图并点击「格式化」，可查看错误位置</span>
    </div>
    <div v-else ref="scroller" class="tree-scroll" @scroll.passive="scrollTop = ($event.target as HTMLElement).scrollTop">
      <div class="tree-sizer" :style="{ height: rows.length * ROW_HEIGHT + 'px' }">
        <div class="tree-window" role="tree" :style="{ transform: `translateY(${range.start * ROW_HEIGHT}px)` }">
          <div
            v-for="node in visible"
            :key="node.id"
            class="row"
            :class="{ clickable: isContainer(node) && node.size > 0 }"
            :style="{ paddingLeft: node.depth * 16 + 6 + 'px', height: ROW_HEIGHT + 'px' }"
            role="treeitem"
            data-testid="json-tree-row"
            @click="onToggle(node)"
          >
            <span class="caret">
              <template v-if="isContainer(node) && node.size">
                <ChevronDown v-if="node.expanded" :size="13" />
                <ChevronRight v-else :size="13" />
              </template>
            </span>
            <template v-if="node.key !== null">
              <span class="key" :class="{ index: typeof node.key === 'number' }">{{ keyLabel(node) }}</span>
              <span class="colon">:</span>
            </template>
            <span v-if="isContainer(node)" class="summary">{{ summaryOf(node) }}</span>
            <span v-else class="val" :class="'t-' + node.type" :title="node.type === 'string' ? (node.value as string).slice(0, 2000) : undefined">{{ previewValue(node) }}</span>
            <span class="type" :class="'t-' + node.type">{{ node.type }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-wrap {
  --c-key: #a626a4;
  --c-string: #2a8f3e;
  --c-number: #c25b00;
  --c-boolean: #0a6bd6;
  --c-null: #8a8a92;
  --c-object: #b3265e;
  --c-array: #0e8a8a;
  height: 100%;
  min-height: 0;
  border-top: 0.5px solid var(--hairline);
  background: var(--window-content);
}
[data-theme='dark'] .tree-wrap {
  --c-key: #d98bf0;
  --c-string: #8fd16a;
  --c-number: #ffab5c;
  --c-boolean: #6cb6ff;
  --c-null: #9a9aa2;
  --c-object: #ff7aa8;
  --c-array: #4fd1c5;
}
.tree-scroll {
  height: 100%;
  overflow: auto;
  user-select: text;
}
.tree-sizer {
  position: relative;
  min-width: max-content;
}
.tree-window {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 100%;
  will-change: transform;
}
.row {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  white-space: nowrap;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12.5px;
}
.row.clickable {
  cursor: pointer;
}
.row:hover {
  background: var(--control-bg);
}
.caret {
  display: inline-flex;
  width: 14px;
  flex: none;
  color: var(--text-dim);
}
.key {
  color: var(--c-key);
}
.key.index {
  color: var(--text-dim);
}
.colon,
.summary {
  color: var(--text-dim);
}
.summary {
  font-size: 12px;
}
.type {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10.5px;
  line-height: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  background: var(--control-bg);
}
.t-string {
  color: var(--c-string);
}
.t-number {
  color: var(--c-number);
}
.t-boolean {
  color: var(--c-boolean);
}
.t-null {
  color: var(--c-null);
}
.t-object {
  color: var(--c-object);
}
.t-array {
  color: var(--c-array);
}
.tree-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 24px;
  text-align: center;
  color: var(--text-dim);
  font-size: 12.5px;
  user-select: text;
}
.tree-empty.err strong {
  color: #ff453a;
}
.hint {
  font-size: 12px;
}
</style>
