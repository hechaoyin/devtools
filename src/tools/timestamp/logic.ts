export type TimeUnit = 's' | 'ms'

export interface ZoneOption {
  id: string
  label: string
  /** 固定偏移（分钟）；'local' 表示跟随浏览器当前时区 */
  offset: number | 'local'
}

export const ZONES: ZoneOption[] = [
  { id: 'local', label: '本地时区', offset: 'local' },
  { id: 'utc', label: 'UTC', offset: 0 },
  { id: 'cn', label: 'UTC+8 北京/上海', offset: 480 },
  { id: 'jp', label: 'UTC+9 东京', offset: 540 },
  { id: 'in', label: 'UTC+5:30 印度', offset: 330 },
  { id: 'eu', label: 'UTC+1 中欧', offset: 60 },
  { id: 'ny', label: 'UTC-5 纽约(标准时)', offset: -300 },
  { id: 'la', label: 'UTC-8 洛杉矶(标准时)', offset: -480 },
]

export function zoneOffset(zone: ZoneOption, at: Date): number {
  return zone.offset === 'local' ? -at.getTimezoneOffset() : zone.offset
}

/** 自动判断秒/毫秒：绝对值小于 1e11 视为秒（约 5138 年前的毫秒值与秒值不会混淆） */
export function detectUnit(value: number): TimeUnit {
  return Math.abs(value) < 1e11 ? 's' : 'ms'
}

export function timestampToDate(value: number, unit: TimeUnit = detectUnit(value)): Date | null {
  const ms = unit === 's' ? value * 1000 : value
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad = (n: number, len = 2) => String(Math.abs(n)).padStart(len, '0')

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** 以指定偏移格式化为 `YYYY-MM-DD HH:mm:ss(.SSS)` */
export function formatDate(date: Date, offsetMinutes: number, withMillis = false): string {
  const s = new Date(date.getTime() + offsetMinutes * 60_000)
  const base = `${pad(s.getUTCFullYear(), 4)}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())} ${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}`
  return withMillis ? `${base}.${pad(s.getUTCMilliseconds(), 3)}` : base
}

export function formatIso(date: Date, offsetMinutes: number): string {
  return `${formatDate(date, offsetMinutes, true).replace(' ', 'T')}${offsetMinutes === 0 ? 'Z' : formatOffset(offsetMinutes)}`
}

const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/

/** 将指定偏移下的 `YYYY-MM-DD[ HH:mm[:ss[.SSS]]]` 解析为 Date；非法输入返回 null */
export function parseDateString(input: string, zone: ZoneOption): Date | null {
  const m = DATE_RE.exec(input.trim())
  if (!m) return null
  const [y, mo, d, h = '0', mi = '0', s = '0', msRaw = '0'] = m.slice(1)
  const ms = Number(msRaw.padEnd(3, '0'))
  const parts = [Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s)]
  if (parts[1] < 1 || parts[1] > 12 || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) return null
  const asUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], ms)
  const check = new Date(asUtc)
  if (check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2]) return null
  if (zone.offset === 'local') {
    const local = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], ms)
    local.setFullYear(parts[0])
    return Number.isNaN(local.getTime()) ? null : local
  }
  return new Date(asUtc - zone.offset * 60_000)
}

export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diff)
  if (abs < 5) return '刚刚'
  const units: [number, string][] = [
    [31_536_000, '年'],
    [2_592_000, '个月'],
    [86_400, '天'],
    [3600, '小时'],
    [60, '分钟'],
    [1, '秒'],
  ]
  for (const [size, label] of units) {
    if (abs >= size) return `${Math.floor(abs / size)}${label}${diff < 0 ? '前' : '后'}`
  }
  return '刚刚'
}
