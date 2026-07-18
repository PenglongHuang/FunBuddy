import { describe, it, expect } from 'vitest'
import { escapeHtml, firstNonEmptyLine } from '../string-util'

describe('escapeHtml', () => {
  it('转义 & < > "', () => {
    expect(escapeHtml('a < b & "c" > d')).toBe('a &lt; b &amp; &quot;c&quot; &gt; d')
  })
  it('无特殊字符原样返回', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123')
  })
})

describe('firstNonEmptyLine', () => {
  it('返回首行', () => {
    expect(firstNonEmptyLine('a\nb\nc')).toBe('a')
  })
  it('跳过开头的空行(stderr/SDK 包装错误的常见形态)', () => {
    expect(firstNonEmptyLine('\ncommand not found\nexit 127')).toBe('command not found')
  })
  it('跳过纯空白行', () => {
    expect(firstNonEmptyLine('   \n\n  \nreal')).toBe('real')
  })
  it('对命中行做 trim', () => {
    expect(firstNonEmptyLine('  hello  ')).toBe('hello')
  })
  it('全空/空串返回空串', () => {
    expect(firstNonEmptyLine('')).toBe('')
    expect(firstNonEmptyLine('   \n  \n')).toBe('')
  })
  it('CRLF 也按行切', () => {
    expect(firstNonEmptyLine('\r\nboom\r\n    at x')).toBe('boom')
  })
})
