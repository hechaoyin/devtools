<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { Check, Copy } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  modelValue: string
  readonly?: boolean
  placeholder?: string
  testid?: string
  /** 为 true 时标题栏显示复制按钮 */
  copyable?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { copy, copied } = useClipboard({ copiedDuring: 1200 })
</script>

<template>
  <div class="cx-pane">
    <div class="pane-title">
      <span>{{ title }}</span>
      <span class="cx-head">
        <slot name="head" />
        <button v-if="copyable" class="btn btn-icon" :disabled="!props.modelValue" title="复制" :data-testid="testid ? `${testid}-copy` : undefined" @click="copy(props.modelValue)">
          <Check v-if="copied" :size="13" />
          <Copy v-else :size="13" />
        </button>
      </span>
    </div>
    <textarea
      class="field cx-text selectable"
      spellcheck="false"
      :readonly="readonly"
      :placeholder="placeholder"
      :value="modelValue"
      :data-testid="testid"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>
