import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ai, fs } from '@/lib/ipc'
import { useAgentStore } from '../agentStore'
import type { AgentTask } from '../../../../shared/agent-types'

vi.mock('@/lib/ipc', () => ({
  ai: {
    startTask: vi.fn().mockResolvedValue(undefined),
    stopTask: vi.fn().mockResolvedValue(undefined),
    getProviderInfo: vi.fn().mockResolvedValue({ providerId: 'claude-code', displayName: 'Claude Code', available: true }),
    listSessions: vi.fn().mockResolvedValue([]),
    getSessionMessages: vi.fn().mockResolvedValue([]),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  },
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    getStorageDir: vi.fn().mockResolvedValue('/ws'),
  },
}))

// vi.hoisted 保证 toastShow 在 vi.mock 工厂运行时就已就绪(避免顶层 const 的 TDZ)
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('@/stores/toastStore', () => ({
  useToastStore: { getState: () => ({ show: toastShow }) },
}))

/** hydrate 竞态修复(#11):hydrate 是异步的(listSessions await 期间),
 * 用户在 AI 面板创建并发送的任务(draft/运行中)不能被回填的会话列表整体覆盖删除。 */
describe('agentStore hydrate 与本地任务的竞态', () => {
  beforeEach(() => {
    useAgentStore.getState().reset()
    vi.clearAllMocks()
  })

  it('hydrate 完成后不吞掉进行中的本地任务,后续 ingest 不再被静默丢弃', async () => {
    let resolveList: (v: any) => void = () => {}
    vi.mocked(ai.listSessions).mockReturnValueOnce(
      new Promise((r) => { resolveList = r }),
    )
    useAgentStore.getState().setDefaultWorkspace('/ws')

    const p = useAgentStore.getState().hydrate()
    // hydrate 挂起期间:用户点"新会话"并发送首条消息(sendPrompt 置 running,流式回复即将到达)
    const localTaskId = useAgentStore.getState().createTask('新会话', '/ws')
    useAgentStore.getState().sendPrompt(localTaskId, '你好')
    expect(useAgentStore.getState().tasks.find((t) => t.taskId === localTaskId)?.status).toBe('running')

    resolveList([{ sessionId: 's1', summary: '旧会话', lastModified: 1, cwd: '/ws' }])
    await p

    const ids = useAgentStore.getState().tasks.map((t) => t.taskId)
    expect(ids).toContain('s1')
    expect(ids).toContain(localTaskId)

    // hydrate resolve 后到达的流式 assistant 消息不得命中 ingest 的 `if (!t) return` 被丢弃
    useAgentStore.getState().ingest(localTaskId, { role: 'assistant', text: '流式回复', toolUses: [] })
    expect(useAgentStore.getState().getMessages(localTaskId)).toEqual([
      { role: 'user', text: '你好' },
      { role: 'assistant', text: '流式回复', toolUses: [] },
    ])
  })

  it('hydrate 完成后 activeTaskId 仍指向现存任务时不被覆盖', async () => {
    let resolveList: (v: any) => void = () => {}
    vi.mocked(ai.listSessions).mockReturnValueOnce(
      new Promise((r) => { resolveList = r }),
    )
    useAgentStore.getState().setDefaultWorkspace('/ws')

    const p = useAgentStore.getState().hydrate()
    // hydrate 挂起期间用户创建并激活了本地任务
    const localTaskId = useAgentStore.getState().createTask('新会话', '/ws')
    resolveList([{ sessionId: 's1', summary: '旧会话', lastModified: 1, cwd: '/ws' }])
    await p

    // 用户正看着的会话不被抢焦点
    expect(useAgentStore.getState().activeTaskId).toBe(localTaskId)
  })

  it('hydrate 回填不清空 hydrate 前已存在的同 taskId 消息数组', async () => {
    // 模拟 hydrate 前已存在的 live 任务(消息已在流式中)。该会话同时也在 listSessions 返回里:
    // 回填不得把已积累的消息数组无条件重置为空。
    useAgentStore.setState((s) => {
      const live: AgentTask = {
        phase: 'live', taskId: 's1', sessionId: 's1', title: '在途会话', workspace: '/ws', status: 'running',
      }
      s.tasks.push(live)
      s._messages['s1'] = [{ role: 'assistant', text: '流式中', toolUses: [] }]
    })
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's1', summary: '同一会话', lastModified: 1, cwd: '/ws' },
    ])
    useAgentStore.getState().setDefaultWorkspace('/ws')

    await useAgentStore.getState().hydrate()

    expect(useAgentStore.getState().getMessages('s1')).toEqual([
      { role: 'assistant', text: '流式中', toolUses: [] },
    ])
  })
})
