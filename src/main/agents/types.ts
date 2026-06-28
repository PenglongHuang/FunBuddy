import type { AgentMessage, ProviderInfo } from '../../shared/agent-types'

/**
 * 可插拔的 Coding Agent 后端契约。
 *
 * provider 自行把后端流转成 app 通用的 AgentMessage，经 onMessage 回吐。
 * 新增 Coding Agent(如其它 CLI / 云端 agent)只需实现此接口并在 registry 注册，
 * 上层( IPC / store / UI )完全不用改 —— 这正是本次抽象的目的。
 */
export interface CodingAgentProvider {
  /** 唯一标识,对应 store 里 settings.ai.provider */
  readonly id: string
  /** 展示名,如 "Claude Code" */
  readonly displayName: string

  /** 检测本机是否已安装/可用此 agent */
  checkAvailability(): Promise<ProviderInfo>

  /**
   * 执行一轮任务。所有产出(含 init/result/流式 partial/权威 assistant)
   * 都经 onMessage 回吐为 AgentMessage;取消由 controller.abort() 触发。
   */
  runTask(
    opts: ProviderStartOptions,
    onMessage: (msg: AgentMessage) => void,
    controller: AbortController,
  ): Promise<void>
}

export interface ProviderStartOptions {
  taskId: string
  prompt: string
  workspace: string
  /** 续接历史的会话 id;首轮为 undefined */
  sessionId?: string
}
