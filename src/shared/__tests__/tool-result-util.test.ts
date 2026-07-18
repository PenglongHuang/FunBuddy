import { describe, it, expect } from 'vitest'
import { locateToolUse, summarizeToolResultSize } from '../tool-result-util'
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
