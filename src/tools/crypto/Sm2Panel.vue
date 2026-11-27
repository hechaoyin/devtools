<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleCheck, CircleX, KeyRound } from 'lucide-vue-next'
import { bytesToHex, decodeData, encodeData, hexToBytes } from './bytes'
import EncodingSelect from './EncodingSelect.vue'
import {
  SM2_DEFAULT_USER_ID,
  sm2Decrypt,
  sm2Encrypt,
  sm2GenerateKeyPair,
  sm2PublicKeyFromPrivate,
  sm2Sign,
  sm2Verify,
} from './sm'
import TextPane from './TextPane.vue'
import type { DataEncoding, Sm2CipherMode } from './types'
import { BINARY_ENCODINGS, emptyResult, errorMessage, guard, type PanelResult } from './ui'

type Op = 'encrypt' | 'decrypt' | 'sign' | 'verify'
const OPS: [Op, string][] = [
  ['encrypt', '公钥加密'],
  ['decrypt', '私钥解密'],
  ['sign', '私钥签名'],
  ['verify', '公钥验签'],
]

const publicKey = ref('')
const privateKey = ref('')
const keyMessage = ref('')
const keyError = ref(false)

const op = ref<Op>('encrypt')
const mode = ref<Sm2CipherMode>('C1C3C2')
const cipherFormat = ref<'raw' | 'asn1'>('raw')
const c1Prefix = ref(false)
const userId = ref(SM2_DEFAULT_USER_ID)
const der = ref(false)
const input = ref('Hello, SM2！')
const inputEncoding = ref<DataEncoding>('utf8')
const outputEncoding = ref<DataEncoding>('hex')
const signature = ref('')
const signatureEncoding = ref<DataEncoding>('hex')

function setOp(next: Op) {
  if (next === op.value) return
  op.value = next
  if (next === 'decrypt') {
    inputEncoding.value = 'hex'
    outputEncoding.value = 'utf8'
  } else {
    inputEncoding.value = 'utf8'
    outputEncoding.value = 'hex'
  }
}

function generate() {
  keyError.value = false
  const pair = sm2GenerateKeyPair()
  publicKey.value = pair.publicKey
  privateKey.value = pair.privateKey
  keyMessage.value = '已生成 SM2 密钥对（私钥 32 字节，公钥为 04 开头的非压缩点）'
}

function deriveFromPrivate() {
  keyError.value = false
  try {
    publicKey.value = sm2PublicKeyFromPrivate(privateKey.value)
    keyMessage.value = '已由私钥导出公钥'
  } catch (e) {
    keyError.value = true
    keyMessage.value = errorMessage(e)
  }
}

const cipherOptions = computed(() => ({ mode: mode.value, format: cipherFormat.value, c1Prefix: c1Prefix.value }))
const signOptions = computed(() => ({ userId: userId.value, der: der.value }))

const result = computed<PanelResult>(() => {
  if (!input.value) return emptyResult(op.value === 'decrypt' ? '请输入密文' : op.value === 'encrypt' ? '请输入明文' : '请输入消息')
  return guard(() => {
    if (op.value === 'encrypt') {
      const hex = sm2Encrypt(publicKey.value, decodeData(input.value, inputEncoding.value, '明文'), cipherOptions.value)
      return { value: encodeData(hexToBytes(hex), outputEncoding.value) }
    }
    if (op.value === 'decrypt') {
      const cipherHex = bytesToHex(decodeData(input.value, inputEncoding.value, '密文'))
      return { value: encodeData(sm2Decrypt(privateKey.value, cipherHex, cipherOptions.value), outputEncoding.value) }
    }
    if (op.value === 'sign') {
      const hex = sm2Sign(privateKey.value, decodeData(input.value, inputEncoding.value, '消息'), signOptions.value)
      return { value: encodeData(hexToBytes(hex), outputEncoding.value) }
    }
    if (!signature.value.trim()) return { value: '', hint: '请输入待验证的签名' }
    const ok = sm2Verify(
      publicKey.value,
      decodeData(input.value, inputEncoding.value, '消息'),
      bytesToHex(decodeData(signature.value, signatureEncoding.value, '签名')),
      signOptions.value,
    )
    return { value: ok ? '验签通过' : '验签失败', verdict: ok }
  })
})

const status = computed(() => {
  const r = result.value
  if (r.error) return { cls: 'error', text: r.error }
  if (r.hint) return { cls: '', text: r.hint }
  if (r.verdict !== undefined) return { cls: r.verdict ? 'ok' : 'error', text: r.verdict ? '签名有效' : '签名无效：消息、签名、公钥、User ID 或 DER 设置不匹配' }
  const label = OPS.find((o) => o[0] === op.value)![1]
  return { cls: 'ok', text: `${label}成功 · 输出 ${r.value.length} 个字符` }
})

const outputTitle = computed(() => ({ encrypt: '密文', decrypt: '明文', sign: '签名', verify: '验签结果' })[op.value])
const inputTitle = computed(() => ({ encrypt: '明文', decrypt: '密文', sign: '待签名消息', verify: '原始消息' })[op.value])
const outputEncodings = computed<DataEncoding[]>(() => (op.value === 'decrypt' ? ['utf8', 'hex', 'base64'] : BINARY_ENCODINGS))
const inputEncodings = computed<DataEncoding[]>(() => (op.value === 'decrypt' ? BINARY_ENCODINGS : ['utf8', 'hex', 'base64']))
</script>

<template>
  <div class="cx-panel" data-testid="panel-sm2">
    <div class="cx-split">
      <div class="cx-keys">
        <div class="tool-bar">
          <button class="btn btn-primary" data-testid="sm2-generate" @click="generate"><KeyRound :size="13" /> 生成密钥对</button>
          <button class="btn" title="由私钥导出公钥" @click="deriveFromPrivate">导出公钥</button>
        </div>
        <div class="cx-note" :class="{ bad: keyError }" style="padding: 4px 12px 0" data-testid="sm2-key-msg">{{ keyMessage || '密钥均为 Hex；公钥支持 04 / 无前缀 / 压缩形式' }}</div>
        <TextPane v-model="publicKey" title="公钥（Hex）" placeholder="04 + x(32 字节) + y(32 字节)" copyable testid="sm2-public" />
        <TextPane v-model="privateKey" title="私钥（Hex）" placeholder="32 字节（64 位 Hex）" copyable testid="sm2-private" />
      </div>

      <div class="cx-right">
        <div class="tool-bar">
          <span class="seg" data-testid="sm2-op">
            <button v-for="[id, label] in OPS" :key="id" :class="{ active: op === id }" :data-op="id" @click="setOp(id)">{{ label }}</button>
          </span>
        </div>
        <div class="cx-params">
          <div v-if="op === 'encrypt' || op === 'decrypt'" class="cx-row">
            <span class="cx-label">密文</span>
            <select v-model="mode" class="field" data-testid="sm2-mode">
              <option value="C1C3C2">C1C3C2（新标准）</option>
              <option value="C1C2C3">C1C2C3（旧标准）</option>
            </select>
            <select v-model="cipherFormat" class="field" data-testid="sm2-format">
              <option value="raw">原始拼接</option>
              <option value="asn1">ASN.1 DER</option>
            </select>
            <label v-if="op === 'encrypt' && cipherFormat === 'raw'" class="cx-opt"><input v-model="c1Prefix" type="checkbox" data-testid="sm2-c1prefix" /> C1 带 04 前缀</label>
            <span v-if="op === 'decrypt' && cipherFormat === 'raw'" class="cx-note">C1 的 04 前缀自动识别</span>
          </div>
          <div v-else class="cx-row">
            <span class="cx-label">User ID</span>
            <input v-model="userId" class="field mono cx-grow" data-testid="sm2-userid" spellcheck="false" />
            <label class="cx-opt"><input v-model="der" type="checkbox" data-testid="sm2-der" /> DER 编码</label>
          </div>
        </div>

        <div class="cx-io">
          <TextPane v-model="input" :title="inputTitle" placeholder="输入内容…" testid="sm2-input">
            <template #head><EncodingSelect v-model="inputEncoding" :options="inputEncodings" testid="sm2-input-enc" /></template>
          </TextPane>
          <TextPane v-if="op === 'verify'" v-model="signature" title="签名" placeholder="输入待验证的签名…" testid="sm2-signature">
            <template #head><EncodingSelect v-model="signatureEncoding" :options="BINARY_ENCODINGS" /></template>
          </TextPane>
          <TextPane v-else :model-value="result.value" :title="outputTitle" readonly copyable placeholder="结果将显示在这里" testid="sm2-output">
            <template #head><EncodingSelect v-model="outputEncoding" :options="outputEncodings" testid="sm2-output-enc" /></template>
          </TextPane>
        </div>
        <div v-if="op === 'verify' && result.verdict !== undefined" class="cx-verdict" :class="result.verdict ? 'ok' : 'bad'" data-testid="sm2-verdict">
          <CircleCheck v-if="result.verdict" :size="16" /><CircleX v-else :size="16" /> {{ result.value }}
        </div>
      </div>
    </div>

    <div class="tool-status" :class="status.cls" data-testid="sm2-status">{{ status.text }}</div>
  </div>
</template>
