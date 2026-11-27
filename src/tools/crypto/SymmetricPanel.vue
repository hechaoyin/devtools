<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDownUp, Dices } from 'lucide-vue-next'
import { bytesToBase64, bytesToHex, decodeData, randomBytes } from './bytes'
import EncodingSelect from './EncodingSelect.vue'
import { PADDING_LABELS } from './padding'
import { modeNeedsIv, modeUsesPadding, runSymmetric, SYMMETRIC_ALGORITHMS } from './symmetric'
import TextPane from './TextPane.vue'
import type { CipherMode, DataEncoding, Direction, PaddingMode, SymmetricAlgorithm } from './types'
import { emptyResult, guard, type PanelResult } from './ui'

const props = defineProps<{ algorithm: SymmetricAlgorithm }>()

const info = computed(() => SYMMETRIC_ALGORITHMS[props.algorithm])
const isStream = computed(() => props.algorithm === 'RC4')

const direction = ref<Direction>('encrypt')
const mode = ref<CipherMode>('CBC')
const padding = ref<PaddingMode>('pkcs7')
const key = ref('')
const keyEncoding = ref<DataEncoding>('utf8')
const iv = ref('')
const ivEncoding = ref<DataEncoding>('utf8')
const aad = ref('')
const aadEncoding = ref<DataEncoding>('utf8')
const input = ref('Hello, 加解密工具！')
const inputEncoding = ref<DataEncoding>('utf8')
const outputEncoding = ref<DataEncoding>('base64')

watch(
  () => props.algorithm,
  () => {
    if (!isStream.value && !info.value.modes.includes(mode.value)) mode.value = info.value.modes.includes('CBC') ? 'CBC' : info.value.modes[0]
  },
  { immediate: true },
)

function setDirection(d: Direction) {
  if (d === direction.value) return
  direction.value = d
  inputEncoding.value = d === 'encrypt' ? 'utf8' : outputEncoding.value === 'utf8' ? 'base64' : outputEncoding.value
  outputEncoding.value = d === 'encrypt' ? 'base64' : 'utf8'
}

const showIv = computed(() => !isStream.value && modeNeedsIv(mode.value))
const showPadding = computed(() => !isStream.value && modeUsesPadding(mode.value))
const showAad = computed(() => !isStream.value && mode.value === 'GCM')
const ivSize = computed(() => (mode.value === 'GCM' ? 12 : info.value.blockSize))

function byteLength(value: string, encoding: DataEncoding): number | null {
  try {
    return decodeData(value, encoding).length
  } catch {
    return null
  }
}

const keyLen = computed(() => byteLength(key.value, keyEncoding.value))
const ivLen = computed(() => byteLength(iv.value, ivEncoding.value))
const keyNeed = computed(() => (isStream.value ? '1–256' : info.value.keySizes.join(' 或 ')))
const keyOk = computed(() => {
  if (keyLen.value === null || keyLen.value === 0) return false
  return isStream.value ? keyLen.value <= 256 : info.value.keySizes.includes(keyLen.value)
})
const ivOk = computed(() => (mode.value === 'GCM' ? (ivLen.value ?? 0) > 0 : ivLen.value === info.value.blockSize))

const result = computed<PanelResult>(() => {
  if (!key.value) return emptyResult(`请填写密钥（${info.value.label} 需要 ${keyNeed.value} 字节）`)
  if (!input.value) return emptyResult(direction.value === 'encrypt' ? '请输入明文' : '请输入密文')
  return guard(() => ({
    value: runSymmetric({
      algorithm: props.algorithm,
      mode: mode.value,
      padding: padding.value,
      direction: direction.value,
      key: key.value,
      keyEncoding: keyEncoding.value,
      iv: iv.value,
      ivEncoding: ivEncoding.value,
      aad: aad.value,
      aadEncoding: aadEncoding.value,
      input: input.value,
      inputEncoding: inputEncoding.value,
      outputEncoding: outputEncoding.value,
    }),
  }))
})

function swap() {
  if (result.value.error || !result.value.value) return
  const next = result.value.value
  const nextInEnc = outputEncoding.value
  direction.value = direction.value === 'encrypt' ? 'decrypt' : 'encrypt'
  input.value = next
  inputEncoding.value = nextInEnc
  outputEncoding.value = direction.value === 'encrypt' ? 'base64' : 'utf8'
}

function format(bytes: Uint8Array, encoding: DataEncoding): { text: string; encoding: DataEncoding } {
  return encoding === 'base64' ? { text: bytesToBase64(bytes), encoding } : { text: bytesToHex(bytes), encoding: 'hex' }
}

function randomKey() {
  const size = isStream.value ? 16 : info.value.keySizes[info.value.keySizes.length - 1]
  const r = format(randomBytes(size), keyEncoding.value)
  key.value = r.text
  keyEncoding.value = r.encoding
}

function randomIv() {
  const r = format(randomBytes(ivSize.value), ivEncoding.value)
  iv.value = r.text
  ivEncoding.value = r.encoding
}

const status = computed(() => {
  if (result.value.error) return { cls: 'error', text: result.value.error }
  if (result.value.hint) return { cls: '', text: result.value.hint }
  return { cls: 'ok', text: `${direction.value === 'encrypt' ? '加密' : '解密'}成功 · 输出 ${result.value.value.length} 个字符` }
})
</script>

<template>
  <div class="cx-panel" :data-testid="`panel-sym-${algorithm}`">
    <div class="tool-bar">
      <span class="seg" data-testid="sym-direction">
        <button :class="{ active: direction === 'encrypt' }" data-dir="encrypt" @click="setDirection('encrypt')">加密</button>
        <button :class="{ active: direction === 'decrypt' }" data-dir="decrypt" @click="setDirection('decrypt')">解密</button>
      </span>
      <button class="btn" title="将输出作为输入并切换方向" data-testid="sym-swap" @click="swap"><ArrowDownUp :size="13" /> 交换</button>
      <span v-if="isStream" class="cx-note">RC4 为流密码，无模式 / 填充 / IV；仅为兼容旧系统，不建议用于新场景</span>
    </div>

    <div class="cx-params">
      <div v-if="!isStream" class="cx-row">
        <span class="cx-label">模式</span>
        <select v-model="mode" class="field" data-testid="sym-mode">
          <option v-for="m in info.modes" :key="m" :value="m">{{ m }}</option>
        </select>
        <template v-if="showPadding">
          <span class="cx-label" style="width: auto; margin-left: 8px">填充</span>
          <select v-model="padding" class="field" data-testid="sym-padding">
            <option v-for="(label, p) in PADDING_LABELS" :key="p" :value="p">{{ label }}</option>
          </select>
        </template>
        <span v-if="mode === 'GCM'" class="cx-note">输出为 密文‖tag(16 字节)；解密时输入同样格式</span>
        <span v-else-if="!showPadding" class="cx-note">流式模式，无需填充</span>
      </div>

      <div class="cx-row">
        <span class="cx-label">密钥</span>
        <input v-model="key" class="field mono cx-grow" :placeholder="`${info.label} 需要 ${keyNeed} 字节`" spellcheck="false" data-testid="sym-key" />
        <EncodingSelect v-model="keyEncoding" testid="sym-key-enc" />
        <span class="cx-note" :class="{ bad: key && !keyOk }" data-testid="sym-key-len">{{ keyLen === null ? '编码无效' : `${keyLen} 字节` }}</span>
        <button class="btn btn-icon" title="随机生成密钥" @click="randomKey"><Dices :size="13" /></button>
      </div>

      <div v-if="showIv" class="cx-row">
        <span class="cx-label">IV</span>
        <input
          v-model="iv"
          class="field mono cx-grow"
          :placeholder="mode === 'GCM' ? 'Nonce，推荐 12 字节' : `需要 ${info.blockSize} 字节`"
          spellcheck="false"
          data-testid="sym-iv"
        />
        <EncodingSelect v-model="ivEncoding" testid="sym-iv-enc" />
        <span class="cx-note" :class="{ bad: iv && !ivOk }">{{ ivLen === null ? '编码无效' : `${ivLen} 字节` }}</span>
        <button class="btn btn-icon" title="随机生成 IV" @click="randomIv"><Dices :size="13" /></button>
      </div>

      <div v-if="showAad" class="cx-row">
        <span class="cx-label">AAD</span>
        <input v-model="aad" class="field mono cx-grow" placeholder="附加认证数据（可选）" spellcheck="false" data-testid="sym-aad" />
        <EncodingSelect v-model="aadEncoding" />
      </div>
    </div>

    <div class="cx-io">
      <TextPane v-model="input" :title="direction === 'encrypt' ? '明文' : '密文'" :placeholder="direction === 'encrypt' ? '输入要加密的内容…' : '输入要解密的密文…'" testid="sym-input">
        <template #head><EncodingSelect v-model="inputEncoding" testid="sym-input-enc" /></template>
      </TextPane>
      <TextPane :model-value="result.value" :title="direction === 'encrypt' ? '密文' : '明文'" readonly copyable placeholder="结果将显示在这里" testid="sym-output">
        <template #head><EncodingSelect v-model="outputEncoding" testid="sym-output-enc" /></template>
      </TextPane>
    </div>

    <div class="tool-status" :class="status.cls" data-testid="sym-status">{{ status.text }}</div>
  </div>
</template>
