import { describe, expect, it } from 'vitest'
import { summarizeToolInput } from './tool-input-summary'

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
