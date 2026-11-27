import { describe, expect, it } from 'vitest'
import {
  detectUnit,
  formatDate,
  formatIso,
  formatOffset,
  parseDateString,
  relativeTime,
  timestampToDate,
  ZONES,
} from './logic'

const zone = (id: string) => ZONES.find((z) => z.id === id)!

describe('timestamp logic', () => {
  it('自动识别秒与毫秒', () => {
    expect(detectUnit(1700000000)).toBe('s')
    expect(detectUnit(1700000000000)).toBe('ms')
    expect(detectUnit(0)).toBe('s')
    expect(detectUnit(-1700000000)).toBe('s')
  })

  it('时间戳转日期', () => {
    expect(timestampToDate(1700000000)?.toISOString()).toBe('2023-11-14T22:13:20.000Z')
    expect(timestampToDate(1700000000123)?.toISOString()).toBe('2023-11-14T22:13:20.123Z')
    expect(timestampToDate(1700000000, 'ms')?.getTime()).toBe(1700000000)
    expect(timestampToDate(Number.NaN)).toBeNull()
    expect(timestampToDate(8.64e15 + 1, 'ms')).toBeNull()
  })

  it('按偏移格式化', () => {
    const d = new Date('2023-11-14T22:13:20.123Z')
    expect(formatDate(d, 0)).toBe('2023-11-14 22:13:20')
    expect(formatDate(d, 480)).toBe('2023-11-15 06:13:20')
    expect(formatDate(d, -300, true)).toBe('2023-11-14 17:13:20.123')
    expect(formatIso(d, 480)).toBe('2023-11-15T06:13:20.123+08:00')
    expect(formatIso(d, 0)).toBe('2023-11-14T22:13:20.123Z')
  })

  it('格式化偏移', () => {
    expect(formatOffset(330)).toBe('+05:30')
    expect(formatOffset(-480)).toBe('-08:00')
  })

  it('日期字符串转时间', () => {
    expect(parseDateString('2023-11-15 06:13:20', zone('cn'))?.toISOString()).toBe('2023-11-14T22:13:20.000Z')
    expect(parseDateString('2023-11-14T22:13:20', zone('utc'))?.toISOString()).toBe('2023-11-14T22:13:20.000Z')
    expect(parseDateString('2023-11-14', zone('utc'))?.toISOString()).toBe('2023-11-14T00:00:00.000Z')
    expect(parseDateString('2023-11-14 22:13:20.5', zone('utc'))?.getUTCMilliseconds()).toBe(500)
  })

  it('本地时区解析与格式化往返', () => {
    const d = parseDateString('2024-03-05 10:20:30', zone('local'))!
    expect(d.getFullYear()).toBe(2024)
    expect(d.getHours()).toBe(10)
    expect(formatDate(d, -d.getTimezoneOffset())).toBe('2024-03-05 10:20:30')
  })

  it('非法日期字符串', () => {
    expect(parseDateString('hello', zone('utc'))).toBeNull()
    expect(parseDateString('2023-13-01', zone('utc'))).toBeNull()
    expect(parseDateString('2023-02-30', zone('utc'))).toBeNull()
    expect(parseDateString('2023-01-01 25:00:00', zone('utc'))).toBeNull()
  })

  it('相对时间', () => {
    const now = new Date('2024-01-01T00:00:00Z')
    expect(relativeTime(new Date(now.getTime() - 3 * 3600_000), now)).toBe('3小时前')
    expect(relativeTime(new Date(now.getTime() + 2 * 86_400_000), now)).toBe('2天后')
    expect(relativeTime(new Date(now.getTime() + 1000), now)).toBe('刚刚')
  })
})
