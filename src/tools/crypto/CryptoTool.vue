<script setup lang="ts">
import { computed, ref } from 'vue'
import { ShieldCheck } from 'lucide-vue-next'
import { CATEGORIES, type AlgoEntry } from './catalog'
import HmacPanel from './HmacPanel.vue'
import RsaPanel from './RsaPanel.vue'
import Sm2Panel from './Sm2Panel.vue'
import SymmetricPanel from './SymmetricPanel.vue'
import './crypto.css'

const categoryId = ref(CATEGORIES[0].id)
const selected = ref<Record<string, string>>(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.algos[0].id])))

const category = computed(() => CATEGORIES.find((c) => c.id === categoryId.value)!)
const entry = computed<AlgoEntry>(() => category.value.algos.find((a) => a.id === selected.value[categoryId.value]) ?? category.value.algos[0])
</script>

<template>
  <div class="tool-root" data-testid="tool-crypto">
    <div class="tool-bar cx-top">
      <span class="seg" data-testid="crypto-category">
        <button v-for="c in CATEGORIES" :key="c.id" :class="{ active: categoryId === c.id }" :data-category="c.id" @click="categoryId = c.id">{{ c.label }}</button>
      </span>
      <span v-if="category.algos.length > 1" class="seg" data-testid="crypto-algorithm">
        <button v-for="a in category.algos" :key="a.id" :class="{ active: entry.id === a.id }" :data-algo="a.id" @click="selected[categoryId] = a.id">{{ a.label }}</button>
      </span>
      <span class="cx-note">{{ entry.description }}</span>
    </div>

    <KeepAlive>
      <SymmetricPanel v-if="entry.panel === 'symmetric'" :key="entry.panelKey" :algorithm="entry.algorithm!" />
      <RsaPanel v-else-if="entry.panel === 'rsa'" key="rsa" />
      <HmacPanel v-else-if="entry.panel === 'hmac'" key="hmac" kind="hmac" />
      <Sm2Panel v-else-if="entry.panel === 'sm2'" key="sm2" />
      <HmacPanel v-else key="sm3" kind="sm3" />
    </KeepAlive>

    <div class="cx-privacy" data-testid="crypto-privacy"><ShieldCheck :size="13" /> 所有运算均在浏览器本地完成，密钥与数据不会上传到任何服务器</div>
  </div>
</template>

<style scoped>
.cx-top {
  gap: 10px;
}
.cx-privacy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-top: 0.5px solid var(--hairline);
  font-size: 11.5px;
  color: var(--text-dim);
}
</style>
