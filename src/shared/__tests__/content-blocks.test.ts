import { describe, it, expect } from 'vitest'
import { toBlocks, extractMessageParts } from '../content-blocks'

describe('toBlocks', () => {
  it('纯字符串包成单个 text 块', () => {
    expect(toBlocks('你好')).toEqual([{ type: 'text', text: '你好' }])
  })
  it('数组原样返回', () => {
    const arr = [{ type: 'text', text: 'a' }]
    expect(toBlocks(arr)).toBe(arr)
  })
  it('null/undefined/其他 → 空数组', () => {
    expect(toBlocks(null)).toEqual([])
    expect(toBlocks(undefined)).toEqual([])
    expect(toBlocks(42)).toEqual([])
  })
})

describe('extractMessageParts', () => {
  it('拼接多个 text 块', () => {
    expect(extractMessageParts([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]).text).toBe('ab')
  })
  it('tool_use → toolUses(带 name/id/input)', () => {
    const { toolUses } = extractMessageParts([{ type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: 'a.ts' } }])
    expect(toolUses).toEqual([{ name: 'Read', id: 'tu-1', input: { file_path: 'a.ts' } }])
  })
  it('无 name 的 tool_use 跳过', () => {
    expect(extractMessageParts([{ type: 'tool_use', id: 'x' }]).toolUses).toEqual([])
  })
  it('tool_result → toolResults(content 归一字符串、带 isError)', () => {
    const { toolResults } = extractMessageParts([
      { type: 'tool_result', tool_use_id: 'tu-1', content: 'line1\nline2', is_error: false },
      { type: 'tool_result', tool_use_id: 'tu-2', content: [{ type: 'text', text: 'multi' }], is_error: true },
    ])
    expect(toolResults).toEqual([
      { toolUseId: 'tu-1', content: 'line1\nline2', isError: false },
      { toolUseId: 'tu-2', content: 'multi', isError: true },
    ])
  })
  it('无 tool_use_id 的 tool_result 跳过', () => {
    expect(extractMessageParts([{ type: 'tool_result', content: 'x' }]).toolResults).toEqual([])
  })
  it('混合内容单遍提取三类', () => {
    const parts = extractMessageParts([
      { type: 'text', text: '我来读 ' },
      { type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: 'a.ts' } },
      { type: 'text', text: '这个文件' },
      { type: 'tool_result', tool_use_id: 'tu-1', content: 'ok', is_error: false },
    ])
    expect(parts.text).toBe('我来读 这个文件')
    expect(parts.toolUses).toHaveLength(1)
    expect(parts.toolResults).toHaveLength(1)
  })
  it('字符串 content 当作纯文本', () => {
    expect(extractMessageParts('hello')).toEqual({ text: 'hello', toolUses: [], toolResults: [] })
  })
  it('空内容 → 全空', () => {
    expect(extractMessageParts(undefined)).toEqual({ text: '', toolUses: [], toolResults: [] })
    expect(extractMessageParts([])).toEqual({ text: '', toolUses: [], toolResults: [] })
  })
})
