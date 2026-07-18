import type { AgentMessage, ToolUse } from '../../shared/agent-types'
import { locateToolUse, summarizeToolResultSize, flattenToolResultContent } from '../../shared/tool-result-util'

/**
 * 把 SDK getSessionMessages() 返回的单条 raw transcript entry 映射成 renderer 的 AgentMessage。
 * 与 claude-message-mapper.ts 同源(transcript 里的 assistant.content 结构一致),但输入是
 * SessionMessage.message 而非 SDKMessage。返回 null 表示该条 UI 不渲染(subagent / 无法识别)。
 *
 * 纯函数,不依赖 electron,可单测。
 */
type RawBlock = {
  type: string
  text?: string
  name?: string
  id?: string
  input?: unknown
  tool_use_id?: string
  content?: unknown
  is_error?: boolean
}

/**
 * 把 transcript 里的 content 归一成块数组。
 * SDK 把 SessionMessage.message 定义为 unknown,真实记录里 user 消息的 content
 * 可能是纯字符串(如 "你好")而非 [{type:'text',...}]。直接 .filter/for..of 字符串
 * 会崩或静默丢字——这里统一成块,字符串包成单个 text 块。
 */
function toBlocks(content: unknown): RawBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return Array.isArray(content) ? content : []
}

export function sessionMessageToAgentMessage(raw: {
  type: string
  message?: { role?: string; content?: RawBlock[] }
  parent_tool_use_id?: string | null
}): AgentMessage | null {
  // subagent 消息不渲染嵌套(UI 只展示主链)
  if (raw.parent_tool_use_id) return null

  if (raw.type === 'user') {
    const text = toBlocks(raw.message?.content)
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
    // tool_result 等非文字 user 消息:text 为空 → 不渲染(否则画出空气泡)。
    // 工具调用本身(📖Read/💻Bash 药丸)由发起它的 assistant 消息携带,不受影响。
    if (!text) return null
    return { role: 'user', text }
  }

  if (raw.type === 'assistant') {
    const blocks = toBlocks(raw.message?.content)
    let text = ''
    const toolUses: ToolUse[] = []
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string') text += b.text
      else if (b.type === 'tool_use' && b.name) toolUses.push({ name: b.name, id: b.id, input: b.input })
    }
    return { role: 'assistant', text, toolUses }
  }

  return null
}

/**
 * 批量映射 transcript:逐条映射成 AgentMessage,并把 user 消息里的 tool_result
 * 按 tool_use_id 关联到对应 assistant.toolUses[i].result。供 sessions.ts 调用。
 * 纯函数,不依赖 electron。
 */
export function mapSessionTranscript(raws: Parameters<typeof sessionMessageToAgentMessage>[0][]): AgentMessage[] {
  const messages: AgentMessage[] = []
  for (const raw of raws) {
    const m = sessionMessageToAgentMessage(raw)
    if (m) messages.push(m)

    // user 消息可能映射为 null(纯 tool_result,text 空),但这里仍要提取 tool_result 关联
    if (raw.type === 'user') {
      for (const b of toBlocks(raw.message?.content)) {
        if (b.type !== 'tool_result' || !b.tool_use_id) continue
        const loc = locateToolUse(messages, b.tool_use_id)
        if (!loc) continue
        const content = flattenToolResultContent(b.content)
        const { chars, lines } = summarizeToolResultSize(content)
        const owner = messages[loc.msgIdx]
        if (owner.role === 'assistant') {
          owner.toolUses[loc.toolIdx].result = { content, isError: !!b.is_error, chars, lines }
        }
      }
    }
  }
  return messages
}
