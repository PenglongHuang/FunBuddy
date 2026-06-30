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

  it('user 消息 content 为纯字符串(非块数组)时也能映射,不抛错', () => {
    // SDK 的 SessionMessage.message 是 unknown;真实 transcript 里首轮 user 消息
    // content 可能是 "你好" 而非 [{type:'text',...}]。直接 .filter 字符串会崩。
    const raw = {
      type: 'user',
      uuid: 'u-str',
      session_id: 's-1',
      message: { role: 'user', content: '纯字符串提问' },
      parent_tool_use_id: null,
    }
    const result = sessionMessageToAgentMessage(raw as any)
    expect(result).toEqual({ role: 'user', text: '纯字符串提问' })
  })

  it('user 消息只含 tool_result(无文字)返回 null,不渲染成空气泡', () => {
    // transcript 里工具返回结果的角色是 user,content 全是 tool_result 块、无 text。
    // 若映射成 {role:'user', text:''} 会在 UI 画出空气泡 → 返回 null 不渲染。
    // 工具调用本身(药丸)由发起它的 assistant 消息携带,不受这里影响。
    const raw = {
      type: 'user',
      uuid: 'u-tr',
      session_id: 's-1',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '文件内容……' }],
      },
      parent_tool_use_id: null,
    }
    expect(sessionMessageToAgentMessage(raw as any)).toBeNull()
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
