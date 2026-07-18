export interface ToolResult {
  content: string
  isError: boolean
  /** content 字符数(UTF-16 code unit 计,非字节) */
  chars: number
  /** content 换行数 */
  lines: number
}

export interface ToolUse {
  name: string
  input?: unknown
  /** tool_use_id:关联后续 tool_result 用 */
  id?: string
  /** 工具执行结果(由 tool_result 按 id 关联回填) */
  result?: ToolResult
}

export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolUses: ToolUse[]; id?: string; partial?: boolean }
  | { role: 'system'; kind: 'init' | 'result' | 'error' | 'tool_result'; meta?: Record<string, unknown> }

export type AgentTaskStatus = 'running' | 'idle' | 'error' | 'stopped'

/**
 * 会话两态模型:
 * - draft:用户点"新会话"但还没发首条 prompt。无 sessionId,不持久化,关闭即丢。
 *          taskId 是草态主键(仅 app 层存在)。
 * - live :首条 prompt 发出、收到 init 的 session_id 后升级。sessionId 绑定 CLI 真相源,
 *          可被 listSessions() 列出;重启后从 CLI 回填。
 */
export type AgentTask =
  | {
      phase: 'draft'
      taskId: string
      title: string
      workspace: string
      status: AgentTaskStatus
      updatedAt?: number
    }
  | {
      phase: 'live'
      taskId: string
      sessionId: string
      title: string
      workspace: string
      status: AgentTaskStatus
      updatedAt?: number
    }

/** 当前绑定的 Coding Agent 的可用性信息(供设置页展示)。 */
export interface ProviderInfo {
  providerId: string
  displayName: string
  available: boolean
  version?: string
}
