export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存储已满或被禁用时忽略，应用仍可在内存中运行
  }
}

export const STORAGE_KEYS = {
  apps: 'toolbox:apps:v1',
  windows: 'toolbox:windows:v1',
  settings: 'toolbox:settings:v1',
  groups: 'toolbox:groups:v1',
} as const
