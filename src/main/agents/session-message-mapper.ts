import type { AgentMessage } from '../../shared/agent-types'
import { extractMessageParts } from '../../shared/content-blocks'
import { attachToolResult, summarizeToolResultSize } from '../../shared/tool-result-util'

/** SDK getSessionMessages() 返回的单条 raw transcript entry(只列我们关心的字段)。 */
type RawEntry = {
  type: string
  message?: { role?: string; content?: unknown }
  parent_tool_use_id?: string | null
}

/**
 * 把 SDK getSessionMessages() 返回的单条 raw transcript entry 映射成 renderer 的 AgentMessage。
 * 与 claude-message-mapper.ts 同源(transcript 里的 content 结构一致),content 提取共用
 * extractMessageParts。返回 null 表示该条 UI 不渲染(subagent / 纯 tool_result / 无法识别)。
 *
 * 纯函数,不依赖 electron,可单测。
 */
export function sessionMessageToAgentMessage(raw: RawEntry): AgentMessage | null {
  // subagent 消息不渲染嵌套(UI 只展示主链)
  if (raw.parent_tool_use_id) return null

  const { text, toolUses } = extractMessageParts(raw.message?.content)
  if (raw.type === 'user') {
    // tool_result 等非文字 user 消息:text 为空 → 不渲染(否则画出空气泡)。
    // 工具调用本身(📖Read/💻Bash 药丸)由发起它的 assistant 消息携带,不受影响。
    return text ? { role: 'user', text } : null
  }
  if (raw.type === 'assistant') {
    return { role: 'assistant', text, toolUses }
  }

  return null
}

/**
 * 批量映射 transcript:逐条映射成 AgentMessage,并把 user 消息里的 tool_result
 * 按 tool_use_id 关联到对应 assistant.toolUses[i].result。供 sessions.ts 调用。
 * 单遍:每条消息的 content 只过一次 extractMessageParts,同时拿到 text/toolUses/toolResults。
 * 纯函数,不依赖 electron。
 */
export function mapSessionTranscript(raws: RawEntry[]): AgentMessage[] {
  const messages: AgentMessage[] = []
  // toolUseId → 位置 索引:批量回填时 O(1) 定位 tool_result 归属,免得每个 result 都全表扫描。
  const index = new Map<string, { msgIdx: number; toolIdx: number }>()
  for (const raw of raws) {
    if (raw.parent_tool_use_id) continue
    const { text, toolUses, toolResults } = extractMessageParts(raw.message?.content)

    if (raw.type === 'assistant') {
      const msgIdx = messages.length
      messages.push({ role: 'assistant', text, toolUses })
      for (let j = 0; j < toolUses.length; j++) {
        const id = toolUses[j].id
        if (id) index.set(id, { msgIdx, toolIdx: j })
      }
    } else if (raw.type === 'user' && text) {
      messages.push({ role: 'user', text })
    }

    // user 消息可能纯 tool_result(text 空、上面不入列),但 result 仍要按 id 挂到归属 assistant。
    for (const r of toolResults) {
      attachToolResult(
        messages,
        r.toolUseId,
        { content: r.content, isError: r.isError, ...summarizeToolResultSize(r.content) },
        index,
      )
    }
  }
  return messages
}
