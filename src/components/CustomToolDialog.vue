<script setup lang="ts">
import { reactive, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import AppIcon from './AppIcon.vue'
import CodeEditor from './CodeEditor.vue'
import { COLOR_IDS, resolveColor } from '@/lib/colors'
import {
  buildSandboxDoc,
  CODE_SANDBOX,
  CODE_TEMPLATE,
  draftToTool,
  toolToDraft,
  validateDraft,
  type CustomToolDraft,
} from '@/lib/customTools'
import type { CustomTool } from '@/types'

const props = defineProps<{ tool?: CustomTool; initialType?: 'url' | 'code' }>()
const emit = defineEmits<{ save: [tool: CustomTool]; cancel: [] }>()

const draft = reactive<CustomToolDraft>(
  props.tool
    ? toolToDraft(props.tool)
    : {
        name: '',
        icon: props.initialType === 'url' ? '🌐' : '🧪',
        color: props.initialType === 'url' ? 'teal' : 'orange',
        type: props.initialType ?? 'url',
        url: '',
        ...(props.initialType === 'code' ? CODE_TEMPLATE : { html: CODE_TEMPLATE.html, css: CODE_TEMPLATE.css, js: CODE_TEMPLATE.js }),
      },
)
const codeTab = ref<'html' | 'css' | 'js'>('html')
const errors = ref<Record<string, string>>({})
const previewDoc = ref(buildSandboxDoc(draft))
watchDebounced(() => [draft.html, draft.css, draft.js], () => (previewDoc.value = buildSandboxDoc(draft)), { debounce: 350 })
const previewKey = ref(0)

function submit() {
  const r = validateDraft(draft, location.origin)
  errors.value = r.errors
  if (Object.keys(r.errors).length) return
  emit('save', draftToTool(draft, r.url, props.tool))
}
</script>

<template>
  <div class="overlay" @mousedown.self="emit('cancel')" data-testid="custom-dialog">
    <form class="dialog" @submit.prevent="submit" @keydown.esc="emit('cancel')">
      <h3>{{ tool ? '编辑自定义工具' : '添加自定义工具' }}</h3>

      <div class="row">
        <label class="lbl">类型</label>
        <span class="seg">
          <button type="button" :class="{ active: draft.type === 'url' }" data-type="url" :disabled="!!tool" @click="draft.type = 'url'">外链网页（iframe）</button>
          <button type="button" :class="{ active: draft.type === 'code' }" data-type="code" :disabled="!!tool" @click="draft.type = 'code'">自写代码（沙箱）</button>
        </span>
      </div>

      <div class="row">
        <label class="lbl">名称</label>
        <div class="grow">
          <input v-model="draft.name" class="field" maxlength="24" placeholder="例如：我的小工具" data-testid="custom-name" />
          <p v-if="errors.name" class="err">{{ errors.name }}</p>
        </div>
      </div>

      <div class="row">
        <label class="lbl">图标</label>
        <div class="icon-line">
          <AppIcon :icon="draft.icon || '🧩'" :color="draft.color" :size="38" />
          <input v-model="draft.icon" class="field emoji" maxlength="2" placeholder="🧩" data-testid="custom-icon" />
          <span class="swatches">
            <button
              v-for="c in COLOR_IDS"
              :key="c"
              type="button"
              class="swatch"
              :class="{ on: draft.color === c }"
              :style="{ background: resolveColor(c) }"
              :aria-label="c"
              @click="draft.color = c"
            />
          </span>
        </div>
      </div>

      <template v-if="draft.type === 'url'">
        <div class="row">
          <label class="lbl">网址</label>
          <div class="grow">
            <input v-model="draft.url" class="field" placeholder="https://example.com" data-testid="custom-url" spellcheck="false" />
            <p v-if="errors.url" class="err" data-testid="custom-url-error">{{ errors.url }}</p>
            <p v-else class="hint">在窗口内以 iframe 打开。部分网站（设置了 X-Frame-Options）禁止被嵌入，此时窗口会显示空白。</p>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="code-area">
          <div class="code-col">
            <div class="seg small">
              <button v-for="t in (['html', 'css', 'js'] as const)" :key="t" type="button" :class="{ active: codeTab === t }" @click="codeTab = t">
                {{ t.toUpperCase() }}
              </button>
            </div>
            <div class="editor">
              <CodeEditor
                v-for="t in (['html', 'css', 'js'] as const)"
                v-show="codeTab === t"
                :key="t"
                :model-value="draft[t] ?? ''"
                :language="t"
                :wrap="false"
                @update:model-value="draft[t] = $event"
              />
            </div>
            <p v-if="errors.code" class="err">{{ errors.code }}</p>
          </div>
          <div class="code-col">
            <div class="preview-head">
              <span>实时预览</span>
              <button type="button" class="btn btn-icon" @click="previewKey++">刷新</button>
            </div>
            <iframe :key="previewKey" class="preview" :srcdoc="previewDoc" :sandbox="CODE_SANDBOX" title="预览" data-testid="custom-preview" />
          </div>
        </div>
        <p class="hint">代码运行在隔离的沙箱 iframe 中（无法访问本站数据、Cookie 与存储），并受内容安全策略限制，仅允许 HTTPS 资源。</p>
      </template>

      <div class="foot">
        <button type="button" class="btn" @click="emit('cancel')">取消</button>
        <button type="submit" class="btn btn-primary" data-testid="custom-save">{{ tool ? '保存' : '添加' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}
.dialog {
  width: 100%;
  max-width: 780px;
  max-height: 100%;
  overflow: auto;
  background: var(--window-content);
  border: 0.5px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h3 {
  margin: 0;
  font-size: 15px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.lbl {
  width: 40px;
  flex: none;
  padding-top: 6px;
  color: var(--text-dim);
  font-size: 12px;
}
.grow {
  flex: 1;
}
.icon-line {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.emoji {
  width: 56px;
  text-align: center;
  font-size: 16px;
}
.swatches {
  display: flex;
  gap: 5px;
}
.swatch {
  all: unset;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.2);
}
.swatch.on {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.err {
  color: #ff453a;
  margin: 4px 0 0;
  font-size: 12px;
}
.hint {
  color: var(--text-dim);
  margin: 4px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
}
.code-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  height: 250px;
}
.code-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  min-height: 0;
}
.editor {
  flex: 1;
  min-height: 0;
  border: 0.5px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg.small {
  align-self: flex-start;
}
.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-dim);
  font-size: 12px;
  height: 25px;
}
.preview {
  flex: 1;
  min-height: 0;
  border: 0.5px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
