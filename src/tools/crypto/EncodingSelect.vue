<script setup lang="ts">
import { ENCODING_LABELS } from './bytes'
import type { DataEncoding } from './types'

withDefaults(defineProps<{ modelValue: DataEncoding; options?: DataEncoding[]; testid?: string }>(), {
  options: () => ['utf8', 'hex', 'base64'],
  testid: undefined,
})
defineEmits<{ 'update:modelValue': [value: DataEncoding] }>()
</script>

<template>
  <select
    class="field cx-enc"
    :value="modelValue"
    :data-testid="testid"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as DataEncoding)"
  >
    <option v-for="o in options" :key="o" :value="o">{{ ENCODING_LABELS[o] }}</option>
  </select>
</template>
