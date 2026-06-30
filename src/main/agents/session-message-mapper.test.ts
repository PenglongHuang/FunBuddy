import { describe, it, expect } from 'vitest'
import { sessionMessageToAgentMessage } from './session-message-mapper'

describe('sessionMessageToAgentMessage', () => {
  it('把 assistant 消息映射成 AgentMessage.assistant(含 text 和 toolUses)', () => {
    const raw = {
      type: 'assistant',
      uuid: 'u-1',
      session_id: 's-1',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: '你好' },
          { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/a.ts' } },
        ],
      },
      parent_tool_use_id: null,
    }
    const result = sessionMessageToAgentMessage(raw as any)
    expect(result).toEqual({
      role: 'assistant',
      text: '你好',
      toolUses: [{ name: 'Read', input: { file_path: '/a.ts' } }],
    })
  })

  it('把 user 消息映射成 AgentMessage.user(取 text content)', () => {
    const raw = {
      type: 'user',
      uuid: 'u-0',
      session_id: 's-1',
      message: {
        role: 'user',
        content: [{ type: 'text', text: '当前计划有编辑视图吗' }],
      },
      parent_tool_use_id: null,
    }
    const result = sessionMessageToAgentMessage(raw as any)
    expect(result).toEqual({ role: 'user', text: '当前计划有编辑视图吗' })
  })

  it('多个 text block 拼接成单个 text', () => {
    const raw = {
      type: 'assistant',
      uuid: 'u-2',
      session_id: 's-1',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: '第一段。' },
          { type: 'text', text: '第二段。' },
        ],
      },
      parent_tool_use_id: null,
    }
    const result = sessionMessageToAgentMessage(raw as any)
    expect(result).toMatchObject({ role: 'assistant', text: '第一段。第二段。' })
  })

  it('subagent 消息(parent_tool_use_id 非空)返回 null,UI 不渲染嵌套', () => {
    const raw = {
      type: 'assistant',
      uuid: 'u-3',
      session_id: 's-1',
      message: { role: 'assistant', content: [{ type: 'text', text: '子代理' }] },
      parent_tool_use_id: 'tu_99',
    }
    expect(sessionMessageToAgentMessage(raw as any)).toBeNull()
  })

  it('无法识别的 entry 类型返回 null', () => {
    expect(sessionMessageToAgentMessage({ type: 'unknown' } as any)).toBeNull()
  })
})
