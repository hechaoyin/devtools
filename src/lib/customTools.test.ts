import { describe, expect, it } from 'vitest'
import {
  buildConfig,
  buildSandboxDoc,
  CODE_SANDBOX,
  draftToTool,
  normalizeUrl,
  parseConfig,
  URL_SANDBOX,
  validateDraft,
} from './customTools'

describe('normalizeUrl', () => {
  it('自动补全 https', () => {
    expect(normalizeUrl('example.com/a')).toEqual({ url: 'https://example.com/a' })
    expect(normalizeUrl('http://localhost:3000')).toEqual({ url: 'http://localhost:3000/' })
    expect(normalizeUrl('localhost:3000')).toEqual({ url: 'https://localhost:3000/' })
  })
  it('拒绝危险协议与空值', () => {
    expect('error' in normalizeUrl('javascript:alert(1)')).toBe(true)
    expect('error' in normalizeUrl('data:text/html,<script>1</script>')).toBe(true)
    expect('error' in normalizeUrl('file:///etc/passwd')).toBe(true)
    expect('error' in normalizeUrl('JavaScript:alert(1)')).toBe(true)
    expect('error' in normalizeUrl('ftp://x.com')).toBe(true)
    expect('error' in normalizeUrl('  ')).toBe(true)
    expect('error' in normalizeUrl('http://')).toBe(true)
  })
  it('拒绝同源地址', () => {
    expect('error' in normalizeUrl('https://me.github.io/devtools/', 'https://me.github.io')).toBe(true)
    expect('url' in normalizeUrl('https://other.io/', 'https://me.github.io')).toBe(true)
  })
})

describe('沙箱', () => {
  it('代码工具的 sandbox 不含 allow-same-origin', () => {
    expect(CODE_SANDBOX).toContain('allow-scripts')
    expect(CODE_SANDBOX).not.toContain('allow-same-origin')
    expect(CODE_SANDBOX).not.toContain('allow-top-navigation')
    expect(URL_SANDBOX).not.toContain('allow-top-navigation')
  })
  it('生成文档含 CSP，并转义 </script>', () => {
    const doc = buildSandboxDoc({ html: '<b>x</b>', css: 'b{color:red}', js: 'const s="</script><img>"' })
    expect(doc).toContain('Content-Security-Policy')
    expect(doc).toContain('<b>x</b>')
    expect(doc.match(/<\/script>/g)).toHaveLength(1)
  })
})

describe('validateDraft', () => {
  it('url 类型', () => {
    expect(validateDraft({ name: '', icon: '', color: 'blue', type: 'url', url: 'x.com' }).errors.name).toBeTruthy()
    const ok = validateDraft({ name: 'X', icon: '', color: 'blue', type: 'url', url: 'x.com' })
    expect(ok.errors).toEqual({})
    expect(ok.url).toBe('https://x.com/')
  })
  it('code 类型至少需要内容', () => {
    expect(validateDraft({ name: 'A', icon: '', color: 'blue', type: 'code' }).errors.code).toBeTruthy()
    expect(validateDraft({ name: 'A', icon: '', color: 'blue', type: 'code', js: '1' }).errors).toEqual({})
  })
  it('draftToTool 生成完整对象', () => {
    const t = draftToTool({ name: ' A ', icon: '', color: 'red', type: 'code', html: '<p/>' }, undefined)
    expect(t.name).toBe('A')
    expect(t.icon).toBe('🧩')
    expect(t.id).toMatch(/^custom-/)
  })
})

describe('配置导入导出', () => {
  const tool = draftToTool({ name: 'T', icon: '🔧', color: 'green', type: 'code', html: '<p>1</p>', js: 'x' }, undefined)
  const urlTool = draftToTool({ name: 'U', icon: '🌐', color: 'blue', type: 'url', url: 'a.com' }, 'https://a.com/')

  it('导出再导入保持一致', () => {
    const text = JSON.stringify(buildConfig({ order: ['json', tool.id], pinned: [tool.id], customTools: [tool, urlTool] }))
    const r = parseConfig(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.config.customTools).toHaveLength(2)
      expect(r.config.order).toEqual(['json', tool.id])
      expect(r.skipped).toBe(0)
    }
  })

  it('拒绝非法文件', () => {
    expect(parseConfig('not json').ok).toBe(false)
    expect(parseConfig('{"app":"other","version":1}').ok).toBe(false)
    expect(parseConfig('{"app":"devtools-toolbox","version":99}').ok).toBe(false)
    expect(parseConfig('null').ok).toBe(false)
  })

  it('丢弃非法工具项与危险 URL', () => {
    const bad = {
      app: 'devtools-toolbox',
      version: 1,
      customTools: [
        { id: 'custom-1', name: 'ok', type: 'code', html: '<p/>' },
        { id: 'custom-2', name: 'evil', type: 'url', url: 'javascript:alert(1)' },
        { id: 'builtin', name: 'x', type: 'code' },
        { id: 'custom-1', name: 'dup', type: 'code' },
        { id: 'custom-3', name: '', type: 'code' },
        'str',
      ],
    }
    const r = parseConfig(JSON.stringify(bad))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.config.customTools.map((t) => t.id)).toEqual(['custom-1'])
      expect(r.skipped).toBe(5)
    }
  })
})
