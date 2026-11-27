<script setup lang="ts">
import { computed, ref } from 'vue'
import { decodeData, encodeData, hexToBytes } from './bytes'
import EncodingSelect from './EncodingSelect.vue'
import { HMAC_ALGORITHMS, hmacBytes, type HmacAlgorithm } from './hmac'
import { sm3Hash } from './sm'
import TextPane from './TextPane.vue'
import type { DataEncoding } from './types'
import { BINARY_ENCODINGS, emptyResult, guard, type PanelResult } from './ui'

const props = defineProps<{ kind: 'hmac' | 'sm3' }>()

const algorithm = ref<HmacAlgorithm>(props.kind === 'sm3' ? 'SM3' : 'SHA-256')
const useHmac = ref(props.kind === 'hmac')
const key = ref('')
const keyEncoding = ref<DataEncoding>('utf8')
const input = ref('hello world')
const inputEncoding = ref<DataEncoding>('utf8')
const outputEncoding = ref<DataEncoding>('hex')
const upper = ref(false)

const result = computed<PanelResult>(() => {
  if (!input.value && !(useHmac.value && key.value)) return emptyResult('请输入要计算的消息')
  return guard(() => {
    const data = decodeData(input.value, inputEncoding.value, '消息')
    const bytes = useHmac.value
      ? hmacBytes(algorithm.value, data, decodeData(key.value, keyEncoding.value, '密钥'))
      : hexToBytes(sm3Hash(data))
    const out = encodeData(bytes, outputEncoding.value)
    return { value: outputEncoding.value === 'hex' && upper.value ? out.toUpperCase() : out }
  })
})

const title = computed(() => (useHmac.value ? `HMAC-${algorithm.value}` : 'SM3'))
const status = computed(() => {
  if (result.value.error) return { cls: 'error', text: result.value.error }
  if (result.value.hint) return { cls: '', text: result.value.hint }
  return { cls: 'ok', text: `${title.value} 计算完成 · ${result.value.value.length} 个字符` }
})
</script>

<template>
  <div class="cx-panel" :data-testid="`panel-${kind}`">
    <div class="tool-bar">
      <template v-if="kind === 'sm3'">
        <span class="seg" data-testid="sm3-mode">
          <button :class="{ active: !useHmac }" @click="useHmac = false">SM3 哈希</button>
          <button :class="{ active: useHmac }" data-mode="hmac" @click="useHmac = true">HMAC-SM3</button>
        </span>
      </template>
      <label v-else class="cx-opt">
        算法
        <select v-model="algorithm" class="field" data-testid="hmac-alg">
          <option v-for="a in HMAC_ALGORITHMS" :key="a" :value="a">HMAC-{{ a }}</option>
        </select>
      </label>
      <span v-if="kind === 'hmac'" class="cx-note">无密钥的摘要（MD5 / SHA 系列）请使用「哈希计算」工具</span>
    </div>

    <div class="cx-params">
      <div v-if="useHmac" class="cx-row">
        <span class="cx-label">密钥</span>
        <input v-model="key" class="field mono cx-grow" placeholder="HMAC 密钥（任意长度）" spellcheck="false" data-testid="hmac-key" />
        <EncodingSelect v-model="keyEncoding" />
      </div>
      <div class="cx-row">
        <span class="cx-label">输出</span>
        <EncodingSelect v-model="outputEncoding" :options="BINARY_ENCODINGS" testid="hmac-output-enc" />
        <label v-if="outputEncoding === 'hex'" class="cx-opt"><input v-model="upper" type="checkbox" /> 大写</label>
      </div>
    </div>

    <div class="cx-io">
      <TextPane v-model="input" title="消息" placeholder="输入消息…" testid="hmac-input">
        <template #head><EncodingSelect v-model="inputEncoding" /></template>
      </TextPane>
      <TextPane :model-value="result.value" :title="title" readonly copyable placeholder="结果将显示在这里" testid="hmac-output" />
    </div>

    <div class="tool-status" :class="status.cls" data-testid="hmac-status">{{ status.text }}</div>
  </div>
</template>
