<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Download,
  GripVertical,
  LayoutList,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Puzzle,
  Store,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import CustomToolDialog from './CustomToolDialog.vue'
import { useAppsStore } from '@/stores/apps'
import { useUiStore, type ManagerTab } from '@/stores/ui'
import { useActions } from '@/lib/actions'
import { useWindowsStore } from '@/stores/windows'
import type { CustomTool } from '@/types'

const apps = useAppsStore()
const ui = useUiStore()
const windows = useWindowsStore()
const { launch } = useActions()

const tab = ref<ManagerTab>('installed')
const dialog = ref<{ tool?: CustomTool; type?: 'url' | 'code' } | null>(null)
const fileInput = ref<HTMLInputElement>()
const toast = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

function notify(kind: 'ok' | 'error', text: string) {
  toast.value = { kind, text }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 4000)
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(apps.exportConfig(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'toolbox-config.json'
  a.click()
  URL.revokeObjectURL(url)
  notify('ok', '配置已导出')
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 5_000_000) return notify('error', '文件过大')
  const text = await file.text()
  if (!confirm('导入将覆盖当前的已安装工具、排序、Dock 与自定义工具。继续吗？')) return
  const r = apps.importConfig(text, location.origin)
  if (r.ok) notify('ok', r.skipped ? `导入成功，已跳过 ${r.skipped} 个无效工具` : '导入成功')
  else notify('error', `导入失败：${r.error}`)
}

let handled = 0
watch(
  () => ui.managerIntent,
  (intent) => {
    if (!intent || intent.nonce === handled) return
    handled = intent.nonce
    if (intent.tab) tab.value = intent.tab
    if (intent.action === 'new') dialog.value = { type: 'url' }
    else if (intent.action === 'import') fileInput.value?.click()
    else if (intent.action === 'export') exportConfig()
  },
  { immediate: true, flush: 'post' },
)

function saveCustom(tool: CustomTool) {
  const exists = apps.customTools.some((t) => t.id === tool.id)
  if (exists) apps.updateCustom(tool)
  else apps.addCustom(tool)
  dialog.value = null
  notify('ok', exists ? '已保存修改' : `已添加「${tool.name}」`)
}

function removeCustom(tool: CustomTool) {
  if (!confirm(`确定删除自定义工具「${tool.name}」吗？此操作无法撤销。`)) return
  apps.removeCustom(tool.id)
  windows.close(tool.id)
}

function uninstall(id: string, name: string) {
  if (!confirm(`卸载「${name}」？之后可在工具商店中重新安装。`)) return
  apps.uninstall(id)
  windows.close(id)
}

// 拖拽排序
const dragId = ref<string | null>(null)
const overId = ref<string | null>(null)
function onDrop(targetId: string) {
  if (dragId.value && dragId.value !== targetId) apps.move(dragId.value, apps.order.indexOf(targetId))
  dragId.value = overId.value = null
}

const customList = computed(() => apps.customTools)
const tabs: { id: ManagerTab; label: string; icon: typeof Store }[] = [
  { id: 'installed', label: '已安装', icon: LayoutList },
  { id: 'store', label: '工具商店', icon: Store },
  { id: 'custom', label: '自定义工具', icon: Puzzle },
]
</script>

<template>
  <div class="manager" data-testid="app-manager">
    <aside class="side">
      <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: tab === t.id }" :data-tab="t.id" @click="tab = t.id">
        <component :is="t.icon" :size="15" /> {{ t.label }}
      </button>
    </aside>

    <main class="main">
      <!-- 已安装 -->
      <template v-if="tab === 'installed'">
        <header class="head"><h2>已安装（{{ apps.installedApps.length }}）</h2><span class="dim">拖动行或使用箭头调整顺序，Dock 与 Launchpad 同步生效</span></header>
        <ul class="list" data-testid="installed-list">
          <li
            v-for="(app, i) in apps.installedApps"
            :key="app.id"
            class="item"
            :class="{ over: overId === app.id && dragId !== app.id }"
            :data-app="app.id"
            draggable="true"
            @dragstart="dragId = app.id"
            @dragover.prevent="overId = app.id"
            @dragleave="overId === app.id && (overId = null)"
            @drop.prevent="onDrop(app.id)"
            @dragend="dragId = overId = null"
          >
            <GripVertical :size="15" class="grip" />
            <AppIcon :icon="app.icon" :color="app.color" :size="34" />
            <div class="info">
              <div class="name">{{ app.name }} <span class="tag">{{ app.kind === 'builtin' ? '内置' : app.kind === 'url' ? '外链' : '代码' }}</span></div>
              <div class="desc">{{ app.description }}</div>
            </div>
            <div class="ops">
              <button class="btn btn-icon" title="上移" :disabled="i === 0" data-op="up" @click="apps.move(app.id, i - 1)"><ArrowUp :size="13" /></button>
              <button class="btn btn-icon" title="下移" :disabled="i === apps.installedApps.length - 1" data-op="down" @click="apps.move(app.id, i + 1)"><ArrowDown :size="13" /></button>
              <button class="btn btn-icon" :title="apps.isPinned(app.id) ? '从 Dock 取消固定' : '固定到 Dock'" data-op="pin" @click="apps.togglePin(app.id)">
                <Pin v-if="apps.isPinned(app.id)" :size="13" />
                <PinOff v-else :size="13" />
              </button>
              <button class="btn" @click="launch(app.id)">打开</button>
              <button v-if="app.kind === 'builtin'" class="btn btn-danger" data-op="uninstall" @click="uninstall(app.id, app.name)">卸载</button>
              <template v-else>
                <button class="btn btn-icon" title="编辑" @click="dialog = { tool: app.custom }"><Pencil :size="13" /></button>
                <button class="btn btn-icon btn-danger" title="删除" @click="removeCustom(app.custom!)"><Trash2 :size="13" /></button>
              </template>
            </div>
          </li>
          <li v-if="!apps.installedApps.length" class="empty">还没有安装任何工具，去「工具商店」看看吧。</li>
        </ul>
      </template>

      <!-- 商店 -->
      <template v-else-if="tab === 'store'">
        <header class="head"><h2>工具商店</h2><span class="dim">内置工具，随时安装或卸载</span></header>
        <div class="cards" data-testid="store-list">
          <div v-for="app in apps.allBuiltins" :key="app.id" class="card" :data-store-app="app.id">
            <AppIcon :icon="app.icon" :color="app.color" :size="46" />
            <div class="info">
              <div class="name">{{ app.name }}</div>
              <div class="desc">{{ app.description }}</div>
              <div class="cat">{{ app.category }}</div>
            </div>
            <button v-if="!apps.isInstalled(app.id)" class="btn btn-primary" data-op="install" @click="apps.install(app.id)">安装</button>
            <div v-else class="installed-ops">
              <button class="btn" @click="launch(app.id)">打开</button>
              <button class="btn btn-danger" data-op="uninstall" @click="uninstall(app.id, app.name)">卸载</button>
            </div>
          </div>
        </div>
      </template>

      <!-- 自定义 -->
      <template v-else>
        <header class="head">
          <h2>自定义工具</h2>
          <span class="spacer" />
          <button class="btn" data-op="import" @click="fileInput?.click()"><Upload :size="13" /> 导入配置</button>
          <button class="btn" data-op="export" @click="exportConfig"><Download :size="13" /> 导出配置</button>
          <button class="btn btn-primary" data-testid="add-custom" @click="dialog = { type: 'url' }"><Plus :size="13" /> 添加工具</button>
        </header>
        <p class="dim intro">支持两种方式：填写网址以 iframe 窗口打开；或自己编写 HTML / CSS / JS，在隔离的沙箱中运行。数据保存在浏览器本地。</p>
        <ul class="list" data-testid="custom-list">
          <li v-for="t in customList" :key="t.id" class="item" :data-custom="t.id">
            <AppIcon :icon="t.icon" :color="t.color" :size="34" />
            <div class="info">
              <div class="name">{{ t.name }} <span class="tag">{{ t.type === 'url' ? '外链' : '代码' }}</span></div>
              <div class="desc">{{ t.type === 'url' ? t.url : '沙箱运行的自定义代码' }}</div>
            </div>
            <div class="ops">
              <button class="btn" @click="launch(t.id)">打开</button>
              <button class="btn btn-icon" title="编辑" data-op="edit" @click="dialog = { tool: t }"><Pencil :size="13" /></button>
              <button class="btn btn-icon btn-danger" title="删除" data-op="delete" @click="removeCustom(t)"><Trash2 :size="13" /></button>
            </div>
          </li>
          <li v-if="!customList.length" class="empty">
            还没有自定义工具。
            <button class="link" @click="dialog = { type: 'url' }">添加外链网页</button> 或
            <button class="link" @click="dialog = { type: 'code' }">编写代码工具</button>
          </li>
        </ul>
      </template>

      <Transition name="toast">
        <div v-if="toast" class="toast" :class="toast.kind" data-testid="toast">{{ toast.text }}</div>
      </Transition>
    </main>

    <input ref="fileInput" type="file" accept="application/json,.json" hidden data-testid="import-input" @change="onFile" />
    <CustomToolDialog v-if="dialog" :tool="dialog.tool" :initial-type="dialog.type" @save="saveCustom" @cancel="dialog = null" />
  </div>
</template>

<style scoped>
.manager {
  position: relative;
  display: flex;
  height: 100%;
  background: var(--window-content);
}
.side {
  width: 160px;
  flex: none;
  padding: 12px 8px;
  background: var(--control-bg);
  border-right: 0.5px solid var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tab {
  all: unset;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: default;
  font-size: 13px;
}
.tab:hover {
  background: var(--control-bg);
}
.tab.on {
  background: var(--accent);
  color: #fff;
}
.main {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 8px;
}
.head h2 {
  margin: 0;
  font-size: 17px;
}
.spacer {
  flex: 1;
}
.dim {
  color: var(--text-dim);
  font-size: 12px;
}
.intro {
  margin: 0;
  padding: 0 18px 8px;
  line-height: 1.5;
}
.list {
  list-style: none;
  margin: 0;
  padding: 4px 12px 14px;
  overflow: auto;
  flex: 1;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  border-radius: 9px;
  border-top: 2px solid transparent;
}
.item + .item {
  border-top-color: transparent;
}
.item:hover {
  background: var(--control-bg);
}
.item.over {
  border-top-color: var(--accent);
}
.grip {
  color: var(--text-dim);
  cursor: grab;
  flex: none;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tag {
  font-weight: 400;
  font-size: 10.5px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
}
.desc {
  color: var(--text-dim);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ops {
  display: flex;
  gap: 5px;
  align-items: center;
  flex: none;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding: 8px 18px 18px;
  overflow: auto;
}
.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--control-bg);
  border: 0.5px solid var(--hairline);
}
.cat {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}
.installed-ops {
  display: flex;
  gap: 6px;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-dim);
}
.link {
  all: unset;
  color: var(--accent);
  cursor: pointer;
}
.toast {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 7px 14px;
  border-radius: 8px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  font-size: 12.5px;
  z-index: 30;
}
.toast.error {
  color: #ff453a;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
