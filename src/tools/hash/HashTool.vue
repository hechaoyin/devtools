<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { Check, Copy } from 'lucide-vue-next'
import { computeAll, HASH_ALGORITHMS, type HashEncoding } from './logic'

const text = ref('hello world')
const hmacKey = ref('')
const upper = ref(false)
const encoding = ref<HashEncoding>('hex')
const { copy, copied } = useClipboard({ copiedDuring: 1200 })
const copiedKey = ref('')

const results = computed(() => computeAll(text.value, { upper: upper.value, encoding: encoding.value, hmacKey: hmacKey.value || undefined }))
const bytes = computed(() => new TextEncoder().encode(text.value).length)

function doCopy(alg: string, value: string) {
  copiedKey.value = alg
  copy(value)
}
</script>

<template>
  <div class="tool-root" data-testid="tool-hash">
    <div class="area">
      <div class="pane-title"><span>输入文本（UTF-8）</span><span>{{ text.length }} 字符 · {{ bytes }} 字节</span></div>
      <textarea v-model="text" class="field input" placeholder="输入要计算摘要的文本…" data-testid="hash-input" spellcheck="false" />
    </div>
    <div class="tool-bar">
      <label class="opt">HMAC 密钥
        <input v-model="hmacKey" class="field key" placeholder="留空则计算普通摘要" data-testid="hash-key" />
      </label>
      <span class="seg">
        <button :class="{ active: encoding === 'hex' }" @click="encoding = 'hex'">Hex</button>
        <button :class="{ active: encoding === 'base64' }" @click="encoding = 'base64'">Base64</button>
      </span>
      <label v-if="encoding === 'hex'" class="opt"><input v-model="upper" type="checkbox" /> 大写</label>
    </div>
    <div class="results">
      <div v-for="alg in HASH_ALGORITHMS" :key="alg" class="row">
        <span class="alg">{{ hmacKey ? `HMAC-${alg}` : alg }}</span>
        <code class="val selectable mono" :data-testid="`hash-${alg}`">{{ results[alg] }}</code>
        <button class="btn btn-icon" :title="`复制 ${alg}`" @click="doCopy(alg, results[alg])">
          <Check v-if="copied && copiedKey === alg" :size="13" />
          <Copy v-else :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.area {
  display: flex;
  flex-direction: column;
  padding-bottom: 8px;
}
.input {
  margin: 0 12px;
  width: calc(100% - 24px);
  height: 120px;
}
.key {
  width: 220px;
}
.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
}
.results {
  flex: 1;
  overflow: auto;
  padding: 6px 12px 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 0.5px solid var(--hairline);
}
.alg {
  width: 100px;
  flex: none;
  font-weight: 600;
  font-size: 12px;
}
.val {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  font-size: 12px;
}
</style>
