import type { JsonNodeType } from './types'

export interface TreeNode {
  id: number
  /** 对象属性名或数组下标；根节点为 null */
  key: string | number | null
  type: JsonNodeType
  value: unknown
  depth: number
  /** 子节点数量（仅容器类型） */
  size: number
  expanded: boolean
  /** 首次展开时才创建，保证超大 JSON 也能快速建树 */
  children: TreeNode[] | null
}

/** “展开全部”最多物化的节点数，避免百万级节点拖垮页面 */
export const EXPAND_ALL_LIMIT = 50_000

const PREVIEW_MAX = 300

export function typeOf(value: unknown): JsonNodeType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'object'
  }
}

export const isContainer = (n: TreeNode) => n.type === 'object' || n.type === 'array'

let seq = 0

function makeNode(key: string | number | null, value: unknown, depth: number): TreeNode {
  const type = typeOf(value)
  const size = type === 'array' ? (value as unknown[]).length : type === 'object' ? Object.keys(value as object).length : 0
  return { id: ++seq, key, type, value, depth, size, expanded: false, children: null }
}

export function createRoot(value: unknown): TreeNode {
  const root = makeNode(null, value, 0)
  root.expanded = isContainer(root)
  return root
}

export function childrenOf(node: TreeNode): TreeNode[] {
  if (node.children) return node.children
  let list: TreeNode[] = []
  if (node.type === 'array') {
    const arr = node.value as unknown[]
    list = new Array<TreeNode>(arr.length)
    for (let i = 0; i < arr.length; i++) list[i] = makeNode(i, arr[i], node.depth + 1)
  } else if (node.type === 'object') {
    const obj = node.value as Record<string, unknown>
    list = Object.keys(obj).map((k) => makeNode(k, obj[k], node.depth + 1))
  }
  node.children = list
  return list
}

/** 按展开状态展平为可见行（迭代实现，深层嵌套不会爆栈） */
export function flatten(root: TreeNode): TreeNode[] {
  const rows: TreeNode[] = []
  const stack: TreeNode[] = [root]
  while (stack.length) {
    const node = stack.pop()!
    rows.push(node)
    if (node.expanded && isContainer(node)) {
      const kids = childrenOf(node)
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i])
    }
  }
  return rows
}

export function toggle(node: TreeNode) {
  if (isContainer(node)) node.expanded = !node.expanded
}

/** 由浅入深逐层展开；节点总数超过 limit 时停止，返回是否已完整展开 */
export function expandAll(root: TreeNode, limit = EXPAND_ALL_LIMIT): { complete: boolean; count: number } {
  let count = 1
  let level: TreeNode[] = [root]
  while (level.length) {
    const next: TreeNode[] = []
    for (const node of level) {
      if (!isContainer(node)) continue
      if (count >= limit) return { complete: false, count }
      node.expanded = true
      const kids = childrenOf(node)
      count += kids.length
      for (const k of kids) if (isContainer(k) && k.size) next.push(k)
    }
    level = next
  }
  return { complete: true, count }
}

/** 折叠所有后代，保留根节点展开以便看到第一层 */
export function collapseAll(root: TreeNode) {
  const stack: TreeNode[] = [root]
  while (stack.length) {
    const node = stack.pop()!
    node.expanded = node === root && isContainer(node)
    if (node.children) for (const k of node.children) stack.push(k)
  }
}

export function countNodes(value: unknown): number {
  let count = 0
  const stack: unknown[] = [value]
  while (stack.length) {
    const v = stack.pop()
    count++
    if (Array.isArray(v)) for (const x of v) stack.push(x)
    else if (v && typeof v === 'object') for (const x of Object.values(v)) stack.push(x)
  }
  return count
}

/** 叶子值的展示文本；超长字符串截断，完整内容可通过 title 查看 */
export function previewValue(node: TreeNode): string {
  switch (node.type) {
    case 'string': {
      const s = node.value as string
      return JSON.stringify(s.length > PREVIEW_MAX ? s.slice(0, PREVIEW_MAX) + '…' : s)
    }
    case 'null':
      return 'null'
    default:
      return String(node.value)
  }
}

export function summaryOf(node: TreeNode): string {
  if (node.type === 'array') return node.size ? `[ ${node.size} 项 ]` : '[]'
  if (node.type === 'object') return node.size ? `{ ${node.size} 个键 }` : '{}'
  return ''
}
