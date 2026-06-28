export interface ToolUse {
  name: string
  input?: unknown
}

export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolUses: ToolUse[]; id?: string; partial?: boolean }
  | { role: 'system'; kind: 'init' | 'result' | 'error'; meta?: Record<string, unknown> }

export type AgentTaskStatus = 'running' | 'idle' | 'error' | 'stopped'

export interface AgentTask {
  taskId: string
  sessionId?: string
  title: string
  workspace: string
  status: AgentTaskStatus
  messages: AgentMessage[]
  updatedAt?: number
}

/** 当前绑定的 Coding Agent 的可用性信息(供设置页展示)。 */
export interface ProviderInfo {
  providerId: string
  displayName: string
  available: boolean
  version?: string
}
