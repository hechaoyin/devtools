import type { CustomTool } from '@/types'
import { COLOR_IDS } from './colors'

export const CONFIG_APP_ID = 'devtools-toolbox'
export const CONFIG_VERSION = 1

/** 自定义代码工具的 iframe sandbox：不含 allow-same-origin，页面运行在独立的不透明源中，无法访问宿主的 localStorage、Cookie 与 DOM */
export const CODE_SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups allow-downloads'
/** 外链网页：允许其自身正常工作（其源与本站不同，不构成逃逸） */
export const URL_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads allow-popups-to-escape-sandbox'

const CSP =
  "default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; connect-src https:"

export const CODE_TEMPLATE = {
  html: '<h2>Hello 工具箱</h2>\n<input id="n" placeholder="输入数字" />\n<button id="go">平方</button>\n<p id="out"></p>',
  css: 'body { font: 14px system-ui, sans-serif; padding: 16px; color: #222; }\ninput, button { padding: 6px 10px; margin-right: 6px; }',
  js: "document.getElementById('go').onclick = () => {\n  const n = Number(document.getElementById('n').value)\n  document.getElementById('out').textContent = n + ' 的平方是 ' + n * n\n}",
}

const escapeScript = (s: string) => s.replace(/<\/(script)/gi, '<\\/$1')
const escapeStyle = (s: string) => s.replace(/<\/(style)/gi, '<\\/$1')

export function buildSandboxDoc(tool: Pick<CustomTool, 'html' | 'css' | 'js'>): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${escapeStyle(tool.css ?? '')}</style></head><body>${tool.html ?? ''}<script>${escapeScript(tool.js ?? '')}<\/script></body></html>`
}

/** 自动补全协议；仅允许 http/https。返回 null 表示非法 */
export function normalizeUrl(input: string, currentOrigin?: string): { url: string } | { error: string } {
  const raw = input.trim()
  if (!raw) return { error: '请输入网址' }
  if (/^(javascript|data|file|vbscript|blob|about|mailto|tel|ftp|ws|wss):/i.test(raw)) return { error: '仅支持 http / https 网址' }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    return { error: '网址格式不正确' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: '仅支持 http / https 网址' }
  if (currentOrigin && parsed.origin === currentOrigin) {
    return { error: '不能嵌入本站自身（同源页面会破坏沙箱隔离）' }
  }
  return { url: parsed.toString() }
}

export interface CustomToolDraft {
  name: string
  icon: string
  color: string
  type: 'url' | 'code'
  url?: string
  html?: string
  css?: string
  js?: string
}

export function validateDraft(draft: CustomToolDraft, currentOrigin?: string): { errors: Record<string, string>; url?: string } {
  const errors: Record<string, string> = {}
  if (!draft.name.trim()) errors.name = '请输入名称'
  else if (draft.name.trim().length > 24) errors.name = '名称不能超过 24 个字符'
  if (draft.type === 'url') {
    const r = normalizeUrl(draft.url ?? '', currentOrigin)
    if ('error' in r) errors.url = r.error
    else return { errors, url: r.url }
  } else if (!(draft.html ?? '').trim() && !(draft.js ?? '').trim()) {
    errors.code = 'HTML 与 JS 不能同时为空'
  }
  return { errors }
}

export function newToolId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function draftToTool(draft: CustomToolDraft, normalizedUrl: string | undefined, existing?: CustomTool): CustomTool {
  const now = Date.now()
  const base = {
    id: existing?.id ?? newToolId(),
    name: draft.name.trim(),
    icon: draft.icon.trim().slice(0, 2) || '🧩',
    color: draft.color,
    type: draft.type,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return draft.type === 'url'
    ? { ...base, url: normalizedUrl }
    : { ...base, html: draft.html ?? '', css: draft.css ?? '', js: draft.js ?? '' }
}

export function toolToDraft(tool: CustomTool): CustomToolDraft {
  return {
    name: tool.name,
    icon: tool.icon,
    color: tool.color,
    type: tool.type,
    url: tool.url ?? '',
    html: tool.html ?? '',
    css: tool.css ?? '',
    js: tool.js ?? '',
  }
}

export interface ToolboxConfig {
  app: typeof CONFIG_APP_ID
  version: number
  exportedAt: string
  order: string[]
  pinned: string[]
  customTools: CustomTool[]
}

export function buildConfig(state: { order: string[]; pinned: string[]; customTools: CustomTool[] }): ToolboxConfig {
  return {
    app: CONFIG_APP_ID,
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    order: [...state.order],
    pinned: [...state.pinned],
    customTools: state.customTools.map((t) => ({ ...t })),
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const MAX_CODE = 500_000

function sanitizeTool(raw: unknown, currentOrigin?: string): CustomTool | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id, 80)
  const name = str(r.name, 24)?.trim()
  if (!id || !/^custom-[\w-]+$/.test(id) || !name) return null
  if (r.type !== 'url' && r.type !== 'code') return null
  const now = Date.now()
  const base = {
    id,
    name,
    icon: (str(r.icon, 2) || '🧩').slice(0, 2),
    color: COLOR_IDS.includes(r.color as string) ? (r.color as string) : 'blue',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
  if (r.type === 'url') {
    const n = normalizeUrl(str(r.url, 2048) ?? '', currentOrigin)
    if ('error' in n) return null
    return { ...base, type: 'url', url: n.url }
  }
  return {
    ...base,
    type: 'code',
    html: str(r.html, MAX_CODE) ?? '',
    css: str(r.css, MAX_CODE) ?? '',
    js: str(r.js, MAX_CODE) ?? '',
  }
}

export type ParsedConfig =
  | { ok: true; config: Pick<ToolboxConfig, 'order' | 'pinned' | 'customTools'>; skipped: number }
  | { ok: false; error: string }

/** 解析并校验导入的配置，丢弃非法工具项；不会信任文件中的任何字段 */
export function parseConfig(text: string, currentOrigin?: string): ParsedConfig {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件' }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: '配置格式不正确' }
  const d = data as Record<string, unknown>
  if (d.app !== CONFIG_APP_ID) return { ok: false, error: '这不是本工具箱导出的配置文件' }
  if (typeof d.version !== 'number' || d.version > CONFIG_VERSION) return { ok: false, error: '配置版本不受支持' }

  const rawTools = Array.isArray(d.customTools) ? d.customTools : []
  const seen = new Set<string>()
  const customTools: CustomTool[] = []
  let skipped = 0
  for (const raw of rawTools) {
    const tool = sanitizeTool(raw, currentOrigin)
    if (!tool || seen.has(tool.id)) {
      skipped++
      continue
    }
    seen.add(tool.id)
    customTools.push(tool)
  }
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return { ok: true, config: { order: ids(d.order), pinned: ids(d.pinned), customTools }, skipped }
}
