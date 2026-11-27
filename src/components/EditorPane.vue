<script setup lang="ts">
import { Copy, Check, Eraser } from 'lucide-vue-next'
import { useClipboard } from '@vueuse/core'
import CodeEditor, { type EditorLanguage } from './CodeEditor.vue'

defineProps<{ title: string; modelValue: string; language?: EditorLanguage; readOnly?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })
</script>

<template>
  <div class="pane">
    <div class="pane-title">
      <span>{{ title }}</span>
      <span class="actions">
        <slot name="actions" />
        <button v-if="!readOnly && modelValue" class="mini" title="清空" @click="emit('update:modelValue', '')"><Eraser :size="12" /></button>
        <button class="mini" title="复制" :disabled="!modelValue" @click="copy(modelValue)">
          <Check v-if="copied" :size="12" />
          <Copy v-else :size="12" />
          {{ copied ? '已复制' : '复制' }}
        </button>
      </span>
    </div>
    <div class="editor">
      <CodeEditor :model-value="modelValue" :language="language" :read-only="readOnly" :placeholder="placeholder" @update:model-value="emit('update:modelValue', $event)" />
    </div>
  </div>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.editor {
  flex: 1;
  min-height: 0;
  border-top: 0.5px solid var(--hairline);
}
.actions {
  display: inline-flex;
  gap: 4px;
}
.mini {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-dim);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.mini:hover:not(:disabled) {
  background: var(--control-hover);
  color: var(--text);
}
.mini:disabled {
  opacity: 0.4;
}
</style>
