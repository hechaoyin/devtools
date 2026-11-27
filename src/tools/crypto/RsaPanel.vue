<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleCheck, CircleX, KeyRound } from 'lucide-vue-next'
import { decodeData, encodeData } from './bytes'
import EncodingSelect from './EncodingSelect.vue'
import { derivePublicKey, generateRsaKeyPair, RSA_HASHES, RSA_KEY_BITS, rsaDecrypt, rsaEncrypt, rsaSign, rsaVerify } from './rsa'
import TextPane from './TextPane.vue'
import type { DataEncoding, HashName, RsaEncryptPadding, RsaKeyFormat, RsaSignScheme } from './types'
import { BINARY_ENCODINGS, emptyResult, errorMessage, guard, type PanelResult } from './ui'

type Op = 'encrypt' | 'decrypt' | 'sign' | 'verify'
const OPS: [Op, string][] = [
  ['encrypt', '公钥加密'],
  ['decrypt', '私钥解密'],
  ['sign', '私钥签名'],
  ['verify', '公钥验签'],
]

const bits = ref<number>(2048)
const format = ref<RsaKeyFormat>('pkcs8')
const publicKey = ref('')
const privateKey = ref('')
const generating = ref(false)
const keyMessage = ref('')
const keyError = ref(false)

const op = ref<Op>('encrypt')
const encScheme = ref<'pkcs1' | 'oaep'>('pkcs1')
const oaepHash = ref<HashName>('SHA-256')
const mgf1Hash = ref<HashName>('SHA-256')
const signScheme = ref<'pkcs1' | 'pss'>('pkcs1')
const signHash = ref<HashName>('SHA-256')
const input = ref('Hello, RSA！')
const inputEncoding = ref<DataEncoding>('utf8')
const outputEncoding = ref<DataEncoding>('base64')
const signature = ref('')
const signatureEncoding = ref<DataEncoding>('base64')

function setOp(next: Op) {
  if (next === op.value) return
  op.value = next
  if (next === 'decrypt') {
    inputEncoding.value = 'base64'
    outputEncoding.value = 'utf8'
  } else {
    inputEncoding.value = 'utf8'
    outputEncoding.value = 'base64'
  }
}

async function generate() {
  generating.value = true
  keyMessage.value = ''
  keyError.value = false
  try {
    const pair = await generateRsaKeyPair(bits.value, format.value)
    publicKey.value = pair.publicKey
    privateKey.value = pair.privateKey
    keyMessage.value = `已生成 ${bits.value} 位 RSA 密钥对（${format.value === 'pkcs8' ? 'PKCS#8 / SPKI' : 'PKCS#1'}）`
  } catch (e) {
    keyError.value = true
    keyMessage.value = errorMessage(e)
  } finally {
    generating.value = false
  }
}

function deriveFromPrivate() {
  keyError.value = false
  try {
    publicKey.value = derivePublicKey(privateKey.value, format.value)
    keyMessage.value = '已由私钥导出公钥'
  } catch (e) {
    keyError.value = true
    keyMessage.value = errorMessage(e)
  }
}

const encPadding = computed<RsaEncryptPadding>(() =>
  encScheme.value === 'pkcs1' ? { scheme: 'pkcs1' } : { scheme: 'oaep', hash: oaepHash.value, mgf1Hash: mgf1Hash.value },
)
const sigScheme = computed<RsaSignScheme>(() => ({ scheme: signScheme.value, hash: signHash.value }))

const result = computed<PanelResult>(() => {
  if (!input.value) return emptyResult(op.value === 'decrypt' ? '请输入密文' : op.value === 'encrypt' ? '请输入明文' : '请输入消息')
  return guard(() => {
    if (op.value === 'encrypt') {
      const ct = rsaEncrypt(publicKey.value, decodeData(input.value, inputEncoding.value, '明文'), encPadding.value)
      return { value: encodeData(ct, outputEncoding.value) }
    }
    if (op.value === 'decrypt') {
      const pt = rsaDecrypt(privateKey.value, decodeData(input.value, inputEncoding.value, '密文'), encPadding.value)
      return { value: encodeData(pt, outputEncoding.value) }
    }
    if (op.value === 'sign') {
      const sig = rsaSign(privateKey.value, decodeData(input.value, inputEncoding.value, '消息'), sigScheme.value)
      return { value: encodeData(sig, outputEncoding.value) }
    }
    if (!signature.value.trim()) return { value: '', hint: '请输入待验证的签名' }
    const ok = rsaVerify(
      publicKey.value,
      decodeData(input.value, inputEncoding.value, '消息'),
      decodeData(signature.value, signatureEncoding.value, '签名'),
      sigScheme.value,
    )
    return { value: ok ? '验签通过' : '验签失败', verdict: ok }
  })
})

const status = computed(() => {
  const r = result.value
  if (r.error) return { cls: 'error', text: r.error }
  if (r.hint) return { cls: '', text: r.hint }
  if (r.verdict !== undefined) return { cls: r.verdict ? 'ok' : 'error', text: r.verdict ? '签名有效' : '签名无效：消息、签名、公钥、哈希或填充方式不匹配' }
  const label = OPS.find((o) => o[0] === op.value)![1]
  return { cls: 'ok', text: `${label}成功 · 输出 ${r.value.length} 个字符` }
})

const outputTitle = computed(() => ({ encrypt: '密文', decrypt: '明文', sign: '签名', verify: '验签结果' })[op.value])
const inputTitle = computed(() => ({ encrypt: '明文', decrypt: '密文', sign: '待签名消息', verify: '原始消息' })[op.value])
const outputEncodings = computed<DataEncoding[]>(() => (op.value === 'decrypt' ? ['utf8', 'hex', 'base64'] : BINARY_ENCODINGS))
const inputEncodings = computed<DataEncoding[]>(() => (op.value === 'decrypt' ? BINARY_ENCODINGS : ['utf8', 'hex', 'base64']))
</script>

<template>
  <div class="cx-panel" data-testid="panel-rsa">
    <div class="cx-split">
      <div class="cx-keys">
        <div class="tool-bar">
          <select v-model.number="bits" class="field" data-testid="rsa-bits" title="密钥长度">
            <option v-for="b in RSA_KEY_BITS" :key="b" :value="b">{{ b }} 位</option>
          </select>
          <select v-model="format" class="field" data-testid="rsa-format" title="PEM 格式">
            <option value="pkcs8">PKCS#8 / SPKI</option>
            <option value="pkcs1">PKCS#1</option>
          </select>
          <button class="btn btn-primary" :disabled="generating" data-testid="rsa-generate" @click="generate"><KeyRound :size="13" /> {{ generating ? '生成中…' : '生成密钥对' }}</button>
          <button class="btn" title="由私钥导出公钥" @click="deriveFromPrivate">导出公钥</button>
        </div>
        <div class="cx-note" :class="{ bad: keyError }" style="padding: 4px 12px 0" data-testid="rsa-key-msg">{{ keyMessage || '粘贴已有 PEM（含/不含头尾均可），或生成新密钥对' }}</div>
        <TextPane v-model="publicKey" title="公钥（PEM）" placeholder="-----BEGIN PUBLIC KEY-----" copyable testid="rsa-public" />
        <TextPane v-model="privateKey" title="私钥（PEM）" placeholder="-----BEGIN PRIVATE KEY-----" copyable testid="rsa-private" />
      </div>

      <div class="cx-right">
        <div class="tool-bar">
          <span class="seg" data-testid="rsa-op">
            <button v-for="[id, label] in OPS" :key="id" :class="{ active: op === id }" :data-op="id" @click="setOp(id)">{{ label }}</button>
          </span>
        </div>
        <div class="cx-params">
          <div v-if="op === 'encrypt' || op === 'decrypt'" class="cx-row">
            <span class="cx-label">填充</span>
            <select v-model="encScheme" class="field" data-testid="rsa-enc-scheme">
              <option value="pkcs1">PKCS#1 v1.5</option>
              <option value="oaep">OAEP</option>
            </select>
            <template v-if="encScheme === 'oaep'">
              <label class="cx-opt">哈希
                <select v-model="oaepHash" class="field" data-testid="rsa-oaep-hash"><option v-for="h in RSA_HASHES.filter((x) => x !== 'MD5')" :key="h" :value="h">{{ h }}</option></select>
              </label>
              <label class="cx-opt">MGF1
                <select v-model="mgf1Hash" class="field"><option v-for="h in RSA_HASHES.filter((x) => x !== 'MD5')" :key="h" :value="h">{{ h }}</option></select>
              </label>
            </template>
          </div>
          <div v-else class="cx-row">
            <span class="cx-label">签名</span>
            <select v-model="signScheme" class="field" data-testid="rsa-sign-scheme">
              <option value="pkcs1">PKCS#1 v1.5</option>
              <option value="pss">PSS</option>
            </select>
            <label class="cx-opt">哈希
              <select v-model="signHash" class="field" data-testid="rsa-sign-hash"><option v-for="h in RSA_HASHES" :key="h" :value="h">{{ h }}</option></select>
            </label>
            <span v-if="signScheme === 'pss'" class="cx-note">MGF1 同哈希，盐长度 = 摘要长度</span>
          </div>
        </div>

        <div class="cx-io">
          <TextPane v-model="input" :title="inputTitle" placeholder="输入内容…" testid="rsa-input">
            <template #head><EncodingSelect v-model="inputEncoding" :options="inputEncodings" testid="rsa-input-enc" /></template>
          </TextPane>
          <TextPane v-if="op === 'verify'" v-model="signature" title="签名" placeholder="输入待验证的签名…" testid="rsa-signature">
            <template #head><EncodingSelect v-model="signatureEncoding" :options="BINARY_ENCODINGS" /></template>
          </TextPane>
          <TextPane v-else :model-value="result.value" :title="outputTitle" readonly copyable placeholder="结果将显示在这里" testid="rsa-output">
            <template #head><EncodingSelect v-model="outputEncoding" :options="outputEncodings" testid="rsa-output-enc" /></template>
          </TextPane>
        </div>
        <div v-if="op === 'verify' && result.verdict !== undefined" class="cx-verdict" :class="result.verdict ? 'ok' : 'bad'" data-testid="rsa-verdict">
          <CircleCheck v-if="result.verdict" :size="16" /><CircleX v-else :size="16" /> {{ result.value }}
        </div>
      </div>
    </div>

    <div class="tool-status" :class="status.cls" data-testid="rsa-status">{{ status.text }}</div>
  </div>
</template>
