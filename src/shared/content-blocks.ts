import type { ToolUse } from './agent-types'
import { flattenToolResultContent } from './tool-result-util'

/** SDK transcript / SDKMessage 的 content 块联合结构(只列我们关心的字段)。 */
export interface RawBlock {
  type: string
  text?: string
  name?: string
  id?: string
  input?: unknown
  tool_use_id?: string
  content?: unknown
  is_error?: boolean
}

/** 从 tool_result 块归一出的结果项(content 已 flatten 成字符串)。 */
export interface RawToolResult {
  toolUseId: string
  content: string
  isError: boolean
}

/**
 * 把消息 content(可能是纯字符串或块数组)归一成块数组。
 * SDK 把 user 消息 content 标成 unknown,真实记录里可能是 "你好" 而非 [{type:'text'}];
 * 直接遍历字符串会崩/丢字,这里统一成块。
 */
export function toBlocks(content: unknown): RawBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return Array.isArray(content) ? content : []
}

/**
 * 单遍提取 content 里的 text / tool_use / tool_result。
 * claude-message-mapper 与 session-message-mapper 共用,避免两份重复的提取循环、
 * 也避免批量回填时对同一条消息的 content 跑两次 toBlocks。
 */
export function extractMessageParts(content: unknown): {
  text: string
  toolUses: ToolUse[]
  toolResults: RawToolResult[]
} {
  const text: string[] = []
  const toolUses: ToolUse[] = []
  const toolResults: RawToolResult[] = []
  for (const b of toBlocks(content)) {
    if (b.type === 'text' && typeof b.text === 'string') text.push(b.text)
    else if (b.type === 'tool_use' && b.name) toolUses.push({ name: b.name, id: b.id, input: b.input })
    else if (b.type === 'tool_result' && b.tool_use_id) {
      toolResults.push({
        toolUseId: b.tool_use_id,
        content: flattenToolResultContent(b.content),
        isError: !!b.is_error,
      })
    }
  }
  return { text: text.join(''), toolUses, toolResults }
}
