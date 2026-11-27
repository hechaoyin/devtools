<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useClock } from '@/lib/useClock'
import { Copy } from 'lucide-vue-next'
import {
  detectUnit,
  formatDate,
  formatIso,
  formatOffset,
  parseDateString,
  relativeTime,
  timestampToDate,
  zoneOffset,
  ZONES,
  type TimeUnit,
} from './logic'

const now = useClock()
const { copy } = useClipboard()

const zoneOf = (id: string) => ZONES.find((z) => z.id === id) ?? ZONES[0]

// 时间戳 → 日期
const tsInput = ref(String(Math.floor(Date.now() / 1000)))
const unitMode = ref<'auto' | TimeUnit>('auto')
const outZoneId = ref('local')

const tsDate = computed(() => {
  const raw = tsInput.value.trim()
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null
  const n = Number(raw)
  return timestampToDate(n, unitMode.value === 'auto' ? detectUnit(n) : unitMode.value)
})
const detected = computed(() => {
  const raw = tsInput.value.trim()
  return /^-?\d+(\.\d+)?$/.test(raw) ? (detectUnit(Number(raw)) === 's' ? '秒' : '毫秒') : ''
})
const tsRows = computed(() => {
  const d = tsDate.value
  if (!d) return []
  const out = zoneOf(outZoneId.value)
  const off = zoneOffset(out, d)
  return [
    { label: `${out.label}（UTC${formatOffset(off)}）`, value: formatDate(d, off, true), id: 'main' },
    { label: 'UTC', value: formatDate(d, 0, true), id: 'utc' },
    { label: 'ISO 8601', value: formatIso(d, off), id: 'iso' },
    { label: '相对现在', value: relativeTime(d, now.value), id: 'rel' },
  ]
})

// 日期 → 时间戳
const pad = (n: number) => String(n).padStart(2, '0')
const initial = new Date()
const dateInput = ref(
  `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())} ${pad(initial.getHours())}:${pad(initial.getMinutes())}:${pad(initial.getSeconds())}`,
)
const inZoneId = ref('local')
const parsed = computed(() => parseDateString(dateInput.value, zoneOf(inZoneId.value)))

function useNowTs() {
  tsInput.value = String(Math.floor(Date.now() / 1000))
}
</script>

<template>
  <div class="tool-root" data-testid="tool-timestamp">
    <div class="scroll">
      <section class="card">
        <h4>当前时间</h4>
        <div class="now">
          <div>
            <span class="lbl">秒</span>
            <code class="mono big selectable" data-testid="ts-now-s">{{ Math.floor(now.getTime() / 1000) }}</code>
            <button class="btn btn-icon" @click="copy(String(Math.floor(now.getTime() / 1000)))"><Copy :size="12" /></button>
          </div>
          <div>
            <span class="lbl">毫秒</span>
            <code class="mono big selectable">{{ now.getTime() }}</code>
            <button class="btn btn-icon" @click="copy(String(now.getTime()))"><Copy :size="12" /></button>
          </div>
          <div class="dim mono">{{ formatDate(now, -now.getTimezoneOffset()) }} （本地）</div>
        </div>
      </section>

      <section class="card">
        <h4>时间戳 → 日期</h4>
        <div class="line">
          <input v-model="tsInput" class="field mono" placeholder="输入秒或毫秒时间戳" data-testid="ts-input" spellcheck="false" />
          <select v-model="unitMode" class="field" data-testid="ts-unit">
            <option value="auto">自动{{ detected ? `（${detected}）` : '' }}</option>
            <option value="s">秒</option>
            <option value="ms">毫秒</option>
          </select>
          <select v-model="outZoneId" class="field" data-testid="ts-out-zone">
            <option v-for="z in ZONES" :key="z.id" :value="z.id">{{ z.label }}</option>
          </select>
          <button class="btn" @click="useNowTs">此刻</button>
        </div>
        <div v-if="tsDate" class="rows" data-testid="ts-result">
          <div v-for="r in tsRows" :key="r.id" class="r">
            <span class="lbl">{{ r.label }}</span>
            <code class="mono selectable" :data-testid="`ts-out-${r.id}`">{{ r.value }}</code>
            <button v-if="r.id !== 'rel'" class="btn btn-icon" @click="copy(r.value)"><Copy :size="12" /></button>
          </div>
        </div>
        <p v-else class="err" data-testid="ts-error">{{ tsInput.trim() ? '无法识别的时间戳' : '请输入时间戳' }}</p>
      </section>

      <section class="card">
        <h4>日期 → 时间戳</h4>
        <div class="line">
          <input v-model="dateInput" class="field mono" placeholder="YYYY-MM-DD HH:mm:ss" data-testid="date-input" spellcheck="false" />
          <select v-model="inZoneId" class="field" data-testid="date-zone">
            <option v-for="z in ZONES" :key="z.id" :value="z.id">{{ z.label }}</option>
          </select>
        </div>
        <div v-if="parsed" class="rows">
          <div class="r">
            <span class="lbl">秒</span>
            <code class="mono selectable" data-testid="date-out-s">{{ Math.floor(parsed.getTime() / 1000) }}</code>
            <button class="btn btn-icon" @click="copy(String(Math.floor(parsed.getTime() / 1000)))"><Copy :size="12" /></button>
          </div>
          <div class="r">
            <span class="lbl">毫秒</span>
            <code class="mono selectable" data-testid="date-out-ms">{{ parsed.getTime() }}</code>
            <button class="btn btn-icon" @click="copy(String(parsed.getTime()))"><Copy :size="12" /></button>
          </div>
        </div>
        <p v-else class="err" data-testid="date-error">格式应为 YYYY-MM-DD HH:mm:ss（时间部分可省略）</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.scroll {
  flex: 1;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  border: 0.5px solid var(--hairline);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--control-bg);
}
h4 {
  margin: 0 0 10px;
  font-size: 12.5px;
}
.line {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.line .field.mono {
  flex: 1;
  min-width: 180px;
}
.now {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.now > div {
  display: flex;
  align-items: center;
  gap: 8px;
}
.big {
  font-size: 16px;
  font-weight: 600;
}
.lbl {
  width: 120px;
  flex: none;
  color: var(--text-dim);
  font-size: 12px;
}
.now .lbl {
  width: 36px;
}
.rows {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.r {
  display: flex;
  align-items: center;
  gap: 8px;
}
.r code {
  flex: 1;
  font-size: 12.5px;
}
.dim {
  color: var(--text-dim);
  font-size: 12px;
}
.err {
  color: #ff453a;
  margin: 10px 0 0;
  font-size: 12px;
}
</style>
