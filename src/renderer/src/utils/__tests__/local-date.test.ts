import { describe, it, expect } from 'vitest'
import { localDateKey, isoToDatetimeLocal, datetimeLocalToIso } from '../local-date'

describe('local-date', () => {
  it('localDateKey 用本地日期（与 UTC 无关）', () => {
    expect(localDateKey(new Date(2026, 9, 12, 0, 30))).toBe('2026-10-12')
    expect(localDateKey(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12')
  })
  it('isoToDatetimeLocal ↔ datetimeLocalToIso 任意时区下无损往返（#3 回归）', () => {
    const value = '2026-10-12T07:00'
    expect(isoToDatetimeLocal(datetimeLocalToIso(value))).toBe(value)
  })
  it('UTC 日期 ≠ 本地日期的时间戳归本地日（#4 回归）', () => {
    for (const d of [new Date(2026, 9, 12, 0, 0), new Date(2026, 9, 12, 23, 59)]) {
      if (d.toISOString().slice(0, 10) !== '2026-10-12') {
        expect(localDateKey(d)).toBe('2026-10-12')
      }
    }
  })
  it('无效输入返回空字符串（受控输入清空不崩溃）', () => {
    expect(isoToDatetimeLocal('not-a-date')).toBe('')
    expect(datetimeLocalToIso('')).toBe('')
  })
})
