import { describe, expect, it } from 'vitest'
import { summarizeToolInput, summarizeToolResult } from '../tool-input-summary'
import type { ToolResult } from '../../../../shared/agent-types'

describe('summarizeToolInput', () => {
  it('Read 取 file_path 的 basename', () => {
    expect(summarizeToolInput('Read', { file_path: 'src/auth/token.ts' })).toBe('token.ts')
  })

  it('Write 取 file_path 的 basename(兼容 Windows 反斜杠)', () => {
    expect(summarizeToolInput('Write', { file_path: 'src\\auth\\token.ts' })).toBe('token.ts')
  })

  it('Bash 取 command 首行', () => {
    expect(summarizeToolInput('Bash', { command: 'git status\n--short' })).toBe('git status')
  })

  it('Bash 超长命令截断', () => {
    const long = 'echo ' + 'x'.repeat(80)
    expect(summarizeToolInput('Bash', { command: long })).toBe(('echo ' + 'x'.repeat(80)).slice(0, 60) + '…')
  })

  it('Grep/Glob 取 pattern', () => {
    expect(summarizeToolInput('Grep', { pattern: 'TODO' })).toBe('TODO')
    expect(summarizeToolInput('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts')
  })

  it('Agent/Task 取 description 首行', () => {
    expect(summarizeToolInput('Task', { description: '重构 auth 模块' })).toBe('重构 auth 模块')
  })

  it('未知工具返回空串', () => {
    expect(summarizeToolInput('SomeNewTool', { foo: 'bar' })).toBe('')
  })

  it('input 为 undefined/null/非对象返回空串', () => {
    expect(summarizeToolInput('Read', undefined)).toBe('')
    expect(summarizeToolInput('Read', null)).toBe('')
    expect(summarizeToolInput('Read', 'string')).toBe('')
  })

  it('缺关键字段返回空串', () => {
    expect(summarizeToolInput('Read', {})).toBe('')
  })
})

describe('summarizeToolResult', () => {
  it('成功且非空:✓ + 字符数 + 行数', () => {
    const r: ToolResult = { content: 'a\nb\nc', isError: false, chars: 5, lines: 3 }
    expect(summarizeToolResult(r)).toBe('✓ 5 字 · 3 行')
  })
  it('成功但空内容:✓ 空', () => {
    expect(summarizeToolResult({ content: '', isError: false, chars: 0, lines: 0 })).toBe('✓ 空')
  })
  it('成功大输出按 K 显示(字符数,非字节)', () => {
    expect(summarizeToolResult({ content: 'x', isError: false, chars: 2048, lines: 1 })).toBe('✓ 2.0K 字 · 1 行')
  })
  it('成功超大输出按 M 显示', () => {
    expect(summarizeToolResult({ content: 'x', isError: false, chars: 1_500_000, lines: 1 })).toBe('✓ 1.5M 字 · 1 行')
  })
  it('失败:✗ + 首行片段', () => {
    expect(summarizeToolResult({ content: 'command not found\nexit 127', isError: true, chars: 20, lines: 2 })).toBe('✗ command not found')
  })
  it('失败但空:✗ 执行失败', () => {
    expect(summarizeToolResult({ content: '', isError: true, chars: 0, lines: 0 })).toBe('✗ 执行失败')
  })
})
