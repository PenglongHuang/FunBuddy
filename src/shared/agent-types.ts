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

export interface ClaudeCheckResult {
  installed: boolean
  version?: string
}
