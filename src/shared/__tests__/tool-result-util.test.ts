import { describe, it, expect } from 'vitest'
import { locateToolUse, summarizeToolResultSize, flattenToolResultContent, attachToolResult } from '../tool-result-util'
import type { AgentMessage } from '../agent-types'

describe('locateToolUse', () => {
  it('按 id 命中 assistant.toolUses', () => {
    const msgs: AgentMessage[] = [
      { role: 'assistant', text: '', toolUses: [{ name: 'Read', id: 'tu-1' }] },
    ]
    expect(locateToolUse(msgs, 'tu-1')).toEqual({ msgIdx: 0, toolIdx: 0 })
  })

  it('跨多条消息、多个工具定位', () => {
    const msgs: AgentMessage[] = [
      { role: 'assistant', text: '', toolUses: [{ name: 'Read', id: 'tu-1' }] },
      { role: 'user', text: 'q' },
      { role: 'assistant', text: '', toolUses: [{ name: 'Bash', id: 'tu-2' }, { name: 'Grep', id: 'tu-3' }] },
    ]
    expect(locateToolUse(msgs, 'tu-3')).toEqual({ msgIdx: 2, toolIdx: 1 })
  })

  it('缺 id 的工具不会被误匹配', () => {
    expect(locateToolUse([{ role: 'assistant', text: '', toolUses: [{ name: 'Read' }] }], 'tu-x')).toBeNull()
  })

  it('空消息流返回 null', () => {
    expect(locateToolUse([], 'nope')).toBeNull()
  })
})

describe('summarizeToolResultSize', () => {
  it('字符数 + 换行数', () => {
    expect(summarizeToolResultSize('ab\ncd\nef')).toEqual({ chars: 8, lines: 3 })
  })
  it('空串', () => {
    expect(summarizeToolResultSize('')).toEqual({ chars: 0, lines: 0 })
  })
  it('CJK 字符按 code unit 计数(非 UTF-8 字节)', () => {
    expect(summarizeToolResultSize('你好')).toEqual({ chars: 2, lines: 1 })
  })
})

describe('flattenToolResultContent', () => {
  it('字符串原样返回', () => {
    expect(flattenToolResultContent('hi')).toBe('hi')
  })
  it('文本块数组拼接 text', () => {
    expect(flattenToolResultContent([{ text: 'a' }, { text: 'b' }])).toBe('ab')
  })
  it('数组里无 text 的元素丢弃', () => {
    expect(flattenToolResultContent([{ text: 'a' }, { type: 'image' }, { text: 'c' }])).toBe('ac')
  })
  it('null/undefined → 空串', () => {
    expect(flattenToolResultContent(null)).toBe('')
    expect(flattenToolResultContent(undefined)).toBe('')
  })
})

describe('attachToolResult', () => {
  it('按 id 把 result 挂到对应 assistant.toolUses[i].result,返回 true', () => {
    const msgs: AgentMessage[] = [{ role: 'assistant', text: '', toolUses: [{ name: 'Read', id: 'tu-1' }] }]
    const ok = attachToolResult(msgs, 'tu-1', { content: 'hi', isError: false, chars: 2, lines: 1 })
    expect(ok).toBe(true)
    expect(msgs[0].role === 'assistant' && msgs[0].toolUses[0].result).toEqual({ content: 'hi', isError: false, chars: 2, lines: 1 })
  })
  it('找不到 id 返回 false 且不改动', () => {
    const msgs: AgentMessage[] = [{ role: 'assistant', text: '', toolUses: [{ name: 'Read', id: 'tu-1' }] }]
    expect(attachToolResult(msgs, 'nope', { content: '', isError: false, chars: 0, lines: 0 })).toBe(false)
    expect(msgs[0].role === 'assistant' && msgs[0].toolUses[0].result).toBeUndefined()
  })
  it('用传入的 index 做 O(1) 查找,不扫全表', () => {
    const msgs: AgentMessage[] = [{ role: 'assistant', text: '', toolUses: [{ name: 'Read', id: 'tu-1' }] }]
    const index = new Map([['tu-1', { msgIdx: 0, toolIdx: 0 }]])
    expect(attachToolResult(msgs, 'tu-1', { content: 'x', isError: false, chars: 1, lines: 1 }, index)).toBe(true)
    expect(msgs[0].role === 'assistant' && msgs[0].toolUses[0].result).toEqual({ content: 'x', isError: false, chars: 1, lines: 1 })
  })
  it('命中后定位到的不是 assistant 时不挂(防御)', () => {
    const msgs: AgentMessage[] = [{ role: 'user', text: 'q' }]
    const index = new Map([['tu-1', { msgIdx: 0, toolIdx: 0 }]])
    expect(attachToolResult(msgs, 'tu-1', { content: 'x', isError: false, chars: 1, lines: 1 }, index)).toBe(false)
  })
})
