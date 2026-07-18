import { describe, it, expect } from 'vitest'
import { normalizeErrorMessage, describeSystemError } from '../normalize-error'

describe('normalizeErrorMessage', () => {
  it('空串/纯空白 → 未知错误', () => {
    expect(normalizeErrorMessage('')).toEqual({ title: '未知错误', detail: '' })
    expect(normalizeErrorMessage('  \n  ')).toEqual({ title: '未知错误', detail: '' })
  })

  it('普通短错误:title=原文,detail 空', () => {
    expect(normalizeErrorMessage('网络连接失败')).toEqual({ title: '网络连接失败', detail: '' })
  })

  it('去掉 Error: / handler 前缀', () => {
    expect(normalizeErrorMessage("Error occurred in handler for 'fs:readFile': ENOENT: no such file").title)
      .toBe('ENOENT: no such file')
    const r1 = normalizeErrorMessage('Error: 请求过于频繁')
    expect(r1.title).toBe('请求过于频繁')
    expect(r1.detail).toBe('Error: 请求过于频繁') // 原文保留供复制
  })

  it('去掉 Uncaught XxxError: 前缀', () => {
    expect(normalizeErrorMessage('Uncaught TypeError: x is not a function').title)
      .toBe('x is not a function')
  })

  it('CRLF 换行也按首行取 title', () => {
    const r = normalizeErrorMessage('Error: boom\r\n    at foo (a.ts:1)')
    expect(r.title).toBe('boom')
    expect(r.detail).toBe('Error: boom\r\n    at foo (a.ts:1)')
  })

  it('仅前缀的退化输入返回非空 title', () => {
    const r = normalizeErrorMessage('Error:')
    expect(r.title.length).toBeGreaterThan(0)
  })

  it('多行堆栈:title=首行去前缀,detail=完整原文', () => {
    const raw = 'Error: network down\n    at foo (a.ts:1)\n    at bar (b.ts:2)'
    const r = normalizeErrorMessage(raw)
    expect(r.title).toBe('network down')
    expect(r.detail).toBe(raw)
  })

  it('超长首行 title 截断到 120 字符 + …', () => {
    const long = 'x'.repeat(300)
    expect(normalizeErrorMessage(long).title).toBe('x'.repeat(120) + '…')
  })

  it('401/429/ENOTFOUND 等原样保留在原文,不做语义改写', () => {
    const r = normalizeErrorMessage('fetch failed: 401 Unauthorized')
    expect(r.title).toBe('fetch failed: 401 Unauthorized')
    expect(r.detail).toBe('')
  })
})

describe('describeSystemError', () => {
  it('error kind:prefix "⚠ ",raw 取 meta.error', () => {
    const r = describeSystemError({ kind: 'error', meta: { error: 'Error: boom' } })
    expect(r).toEqual({ prefix: '⚠ ', title: 'boom', detail: 'Error: boom', raw: 'Error: boom' })
  })
  it('result+isError kind:prefix "⚠ 任务执行出错：",raw 取 meta.result', () => {
    const r = describeSystemError({ kind: 'result', meta: { isError: true, result: 'Error: x' } })
    expect(r.prefix).toBe('⚠ 任务执行出错：')
    expect(r.title).toBe('x')
    expect(r.raw).toBe('Error: x')
  })
  it('result+isError 只有 subtype 时 raw 取 subtype', () => {
    const r = describeSystemError({ kind: 'result', meta: { isError: true, subtype: 'Error: y' } })
    expect(r.title).toBe('y')
    expect(r.raw).toBe('Error: y')
  })
  it('error 空 → 未知错误', () => {
    const r = describeSystemError({ kind: 'error', meta: {} })
    expect(r.title).toBe('未知错误')
    expect(r.raw).toBe('')
  })
})
