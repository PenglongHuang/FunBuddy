export interface ToolUse {
  name: string
  input?: unknown
}

export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolUses: ToolUse[] }
  | { role: 'system'; kind: 'init' | 'result' | 'error'; meta?: Record<string, unknown> }

export type AgentTaskStatus = 'running' | 'idle' | 'error' | 'stopped'

export interface AgentTask {
  taskId: string
  sessionId?: string
  title: string
  workspace: string
  status: AgentTaskStatus
  messages: AgentMessage[]
}

export interface ClaudeCheckResult {
  installed: boolean
  version?: string
}
