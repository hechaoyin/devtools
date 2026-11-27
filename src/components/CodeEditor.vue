<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { useSettingsStore } from '@/stores/settings'

export type EditorLanguage = 'json' | 'xml' | 'html' | 'css' | 'js' | 'text'

const props = withDefaults(
  defineProps<{ modelValue: string; language?: EditorLanguage; readOnly?: boolean; placeholder?: string; wrap?: boolean }>(),
  { language: 'text', readOnly: false, placeholder: '', wrap: true },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const settings = useSettingsStore()
const host = ref<HTMLElement>()
let view: EditorView | null = null

const languageC = new Compartment()
const themeC = new Compartment()
const readOnlyC = new Compartment()
const wrapC = new Compartment()

const baseTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--window-content)', fontSize: '12.5px' },
  '.cm-scroller': { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--text-dim)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--control-bg)' },
  '&.cm-focused': { outline: 'none' },
})

function languageExt(l: EditorLanguage): Extension {
  switch (l) {
    case 'json':
      return json()
    case 'xml':
      return xml()
    case 'html':
      return html()
    case 'css':
      return css()
    case 'js':
      return javascript()
    default:
      return []
  }
}

const themeExt = (dark: boolean): Extension => (dark ? oneDark : [])
const readOnlyExt = (ro: boolean): Extension => [EditorState.readOnly.of(ro), EditorView.editable.of(!ro)]

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        languageC.of(languageExt(props.language)),
        themeC.of(themeExt(settings.isDark)),
        baseTheme,
        readOnlyC.of(readOnlyExt(props.readOnly)),
        wrapC.of(props.wrap ? EditorView.lineWrapping : []),
        props.placeholder ? cmPlaceholder(props.placeholder) : [],
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
})

onBeforeUnmount(() => view?.destroy())

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  },
)
watch(() => props.language, (l) => view?.dispatch({ effects: languageC.reconfigure(languageExt(l)) }))
watch(
  () => settings.isDark,
  (d) => view?.dispatch({ effects: themeC.reconfigure(themeExt(d)) }),
)
watch(() => props.readOnly, (ro) => view?.dispatch({ effects: readOnlyC.reconfigure(readOnlyExt(ro)) }))
watch(() => props.wrap, (w) => view?.dispatch({ effects: wrapC.reconfigure(w ? EditorView.lineWrapping : []) }))

defineExpose({ focus: () => view?.focus() })
</script>

<template>
  <div ref="host" class="code-editor" />
</template>

<style scoped>
.code-editor {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
