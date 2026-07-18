import { describe, it, expect } from 'vitest'
import { sessionMessageToAgentMessage, mapSessionTranscript } from '../session-message-mapper'

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
      toolUses: [{ name: 'Read', id: 'tu_1', input: { file_path: '/a.ts' } }],
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

describe('mapSessionTranscript', () => {
  it('把 user 消息里的 tool_result 关联到对应 assistant.toolUses[i].result', () => {
    const raws = [
      { type: 'user', message: { role: 'user', content: '读一下 a.ts' } },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: '我来读' },
            { type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: 'a.ts' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'line1\nline2', is_error: false }],
        },
      },
    ]
    const out = mapSessionTranscript(raws as any)
    expect(out).toHaveLength(2) // user(text) + assistant;纯 tool_result 的 user 不画气泡
    const assistant = out[1]
    if (assistant.role !== 'assistant') throw new Error('expected assistant')
    expect(assistant.toolUses[0].id).toBe('tu-1')
    expect(assistant.toolUses[0].result).toEqual({
      content: 'line1\nline2', isError: false, chars: 11, lines: 2,
    })
  })

  it('tool_result 找不到归属(tool_use_id 无匹配)时安全忽略', () => {
    const raws = [
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'nope', content: 'x' }] } },
    ]
    const out = mapSessionTranscript(raws as any)
    expect(out).toHaveLength(0)
  })

  it('assistant tool_use 带的 id 透传(供关联)', () => {
    const raws = [
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu-7', name: 'Bash', input: { command: 'ls' } }] } },
    ]
    const out = mapSessionTranscript(raws as any)
    const a = out[0]
    if (a.role !== 'assistant') throw new Error('expected assistant')
    expect(a.toolUses[0].id).toBe('tu-7')
  })

  it('失败的工具结果(is_error)关联为 isError:true', () => {
    const raws = [
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu-e', name: 'Bash', input: { command: 'bad' } }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu-e', content: 'command not found', is_error: true }] } },
    ]
    const out = mapSessionTranscript(raws as any)
    const a = out[0]
    if (a.role !== 'assistant') throw new Error('expected assistant')
    expect(a.toolUses[0].result?.isError).toBe(true)
  })
})
