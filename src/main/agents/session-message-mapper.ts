import type { AgentMessage, ToolUse } from '../../shared/agent-types'

/**
 * 把 SDK getSessionMessages() 返回的单条 raw transcript entry 映射成 renderer 的 AgentMessage。
 * 与 claude-message-mapper.ts 同源(transcript 里的 assistant.content 结构一致),但输入是
 * SessionMessage.message 而非 SDKMessage。返回 null 表示该条 UI 不渲染(subagent / 无法识别)。
 *
 * 纯函数,不依赖 electron,可单测。
 */
type RawBlock = { type: string; text?: string; name?: string; input?: unknown }

export function sessionMessageToAgentMessage(raw: {
  type: string
  message?: { role?: string; content?: RawBlock[] }
  parent_tool_use_id?: string | null
}): AgentMessage | null {
  // subagent 消息不渲染嵌套(UI 只展示主链)
  if (raw.parent_tool_use_id) return null

  if (raw.type === 'user') {
    const blocks = raw.message?.content ?? []
    const text = blocks
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
    return { role: 'user', text }
  }

  if (raw.type === 'assistant') {
    const blocks = raw.message?.content ?? []
    let text = ''
    const toolUses: ToolUse[] = []
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string') text += b.text
      else if (b.type === 'tool_use' && b.name) toolUses.push({ name: b.name, input: b.input })
    }
    return { role: 'assistant', text, toolUses }
  }

  return null
}
