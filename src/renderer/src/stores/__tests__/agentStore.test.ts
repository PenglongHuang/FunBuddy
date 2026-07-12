import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ai, fs } from '@/lib/ipc'
import { useAgentStore } from '../agentStore'

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

describe('agentStore', () => {
  beforeEach(() => {
    useAgentStore.getState().reset()
    vi.clearAllMocks()
  })

  it('createTask 建立 draft 态(无 sessionId,无 messages)', () => {
    const taskId = useAgentStore.getState().createTask('新会话', '/ws')
    const s = useAgentStore.getState()
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0]).toMatchObject({ phase: 'draft', status: 'idle' })
    expect((s.tasks[0] as any).sessionId).toBeUndefined()
    expect(s.activeTaskId).toBe(taskId)
  })

  it('sendPrompt 带 task 的 sessionId 调用 ai.startTask(live 态 resume)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'init', meta: { sessionId: 'sess-1' } })
    useAgentStore.getState().sendPrompt(taskId, 'second')
    expect(ai.startTask).toHaveBeenCalledWith(taskId, 'second', '/ws', 'sess-1')
  })

  it('sendPrompt 在 draft 态传 undefined(首条 prompt)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().sendPrompt(taskId, 'first')
    expect(ai.startTask).toHaveBeenCalledWith(taskId, 'first', '/ws', undefined)
  })

  it('ingest init 把 draft 升级为 live 并绑定 sessionId', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'init', meta: { sessionId: 's-9' } })
    const t = useAgentStore.getState().tasks[0]
    expect(t.phase).toBe('live')
    expect(t.phase === 'live' && t.sessionId).toBe('s-9')
  })

  it('ingest 把 assistant 消息写入内存视图(按 taskId 索引)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'assistant', text: 'hi', toolUses: [] })
    expect(useAgentStore.getState().getMessages(taskId)).toEqual([
      { role: 'assistant', text: 'hi', toolUses: [] },
    ])
  })

  it('ingest 按 id upsert assistant(partial→final 替换,无重复)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    const store = useAgentStore.getState()
    store.ingest(taskId, { role: 'assistant', text: 'Hel', toolUses: [], id: 't#1', partial: true })
    store.ingest(taskId, { role: 'assistant', text: 'Hello', toolUses: [], id: 't#1', partial: false })
    expect(useAgentStore.getState().getMessages(taskId)).toEqual([
      { role: 'assistant', text: 'Hello', toolUses: [], id: 't#1', partial: false },
    ])
  })

  it('ingest result isError=false 置 status idle', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'result', meta: { isError: false } })
    expect(useAgentStore.getState().tasks[0].status).toBe('idle')
  })

  it('ingest error 写入 _messages 以便 UI 渲染出错详情', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'error', meta: { error: 'something broke' } })
    const msgs = useAgentStore.getState().getMessages(taskId)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ role: 'system', kind: 'error', meta: { error: 'something broke' } })
    expect(useAgentStore.getState().tasks[0].status).toBe('error')
  })

  it('ingest result isError 写入 _messages 且 status=error', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'result', meta: { isError: true } })
    const msgs = useAgentStore.getState().getMessages(taskId)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ role: 'system', kind: 'result', meta: { isError: true } })
    expect(useAgentStore.getState().tasks[0].status).toBe('error')
  })

  it('ingest 成功 result 不写入 _messages(避免逐轮堆积)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'result', meta: { isError: false } })
    expect(useAgentStore.getState().getMessages(taskId)).toHaveLength(0)
    expect(useAgentStore.getState().tasks[0].status).toBe('idle')
  })

  it('markStopped 置 status stopped', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().markStopped(taskId)
    expect(useAgentStore.getState().tasks[0].status).toBe('stopped')
  })

  it('deleteTask 对 live 会话调用 ai.deleteSession 清理 CLI 真相源', async () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'init', meta: { sessionId: 's-1' } })
    await useAgentStore.getState().deleteTask(taskId)
    expect(ai.deleteSession).toHaveBeenCalledWith('s-1', '/ws')
    expect(useAgentStore.getState().tasks.find((t) => t.taskId === taskId)).toBeUndefined()
  })

  it('deleteTask 对 draft 会话不调 ai.deleteSession(无 sessionId)', async () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    await useAgentStore.getState().deleteTask(taskId)
    expect(ai.deleteSession).not.toHaveBeenCalled()
  })

  it('hydrate 从 listSessions 读会话,全部为 live 态,残留 running→stopped', async () => {
    useAgentStore.getState().setDefaultWorkspace('/ws')
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's-a', summary: 'A', lastModified: 100, cwd: '/ws' },
      { sessionId: 's-b', summary: 'B', lastModified: 200, cwd: '/ws' },
    ])
    await useAgentStore.getState().hydrate()
    const s = useAgentStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.tasks).toHaveLength(2)
    expect(s.tasks.every((t) => t.phase === 'live')).toBe(true)
    expect(s.activeTaskId).toBeDefined()
    const active = s.tasks.find((t) => t.taskId === s.activeTaskId)
    expect(active && active.phase === 'live' && active.sessionId).toBe('s-b')
  })

  it('loadHistory 拉取某 live 会话的消息到内存视图', async () => {
    useAgentStore.getState().setDefaultWorkspace('/ws')
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's-a', summary: 'A', lastModified: 100, cwd: '/ws' },
    ])
    vi.mocked(ai.getSessionMessages).mockResolvedValue([
      { role: 'user', text: '问' },
      { role: 'assistant', text: '答', toolUses: [] },
    ])
    await useAgentStore.getState().hydrate()
    const taskId = useAgentStore.getState().tasks[0].taskId
    await useAgentStore.getState().loadHistory(taskId)
    expect(ai.getSessionMessages).toHaveBeenCalledWith('s-a', '/ws')
    expect(useAgentStore.getState().getMessages(taskId)).toEqual([
      { role: 'user', text: '问' },
      { role: 'assistant', text: '答', toolUses: [] },
    ])
  })

  it('hydrate 在 defaultWorkspace 为空时从 fs.getStorageDir fallback', async () => {
    // 不 seed defaultWorkspace;模拟冷启动竞态(defaultWorkspace 跨 reset 持久化,需显式清空)
    useAgentStore.getState().setDefaultWorkspace('')
    vi.mocked(fs.getStorageDir).mockResolvedValue('/ws')
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's-x', summary: 'X', lastModified: 50, cwd: '/ws' },
    ])
    await useAgentStore.getState().hydrate()
    const s = useAgentStore.getState()
    expect(fs.getStorageDir).toHaveBeenCalled()
    expect(s.defaultWorkspace).toBe('/ws')
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0].phase).toBe('live')
  })

  it('loadHistory 空会话只 fetch 一次(_loaded 防重复)', async () => {
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's-empty', summary: 'E', lastModified: 1, cwd: '/ws' },
    ])
    vi.mocked(ai.getSessionMessages).mockResolvedValue([]) // 空消息
    useAgentStore.getState().setDefaultWorkspace('/ws')
    await useAgentStore.getState().hydrate()
    const taskId = useAgentStore.getState().tasks[0].taskId
    await useAgentStore.getState().loadHistory(taskId)
    await useAgentStore.getState().loadHistory(taskId) // 第二次应跳过
    expect(ai.getSessionMessages).toHaveBeenCalledTimes(1)
    expect(useAgentStore.getState().getMessages(taskId)).toEqual([])
  })

  it('loadHistory 非 running 时合并:历史在前,await 期间到达的运行时消息在后', async () => {
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's-h', summary: 'H', lastModified: 1, cwd: '/ws' },
    ])
    useAgentStore.getState().setDefaultWorkspace('/ws')
    await useAgentStore.getState().hydrate()
    const taskId = useAgentStore.getState().tasks[0].taskId
    // hydrate 出来的会话默认 idle(非 running)

    let resolveGet: (v: any) => void = () => {}
    vi.mocked(ai.getSessionMessages).mockReturnValue(
      new Promise((r) => { resolveGet = r }),
    )

    const loadPromise = useAgentStore.getState().loadHistory(taskId)
    // await 期间:一条运行时 assistant 消息到达(如用户刚发的回合)
    useAgentStore.getState().ingest(taskId, { role: 'assistant', text: '流式中', toolUses: [] })
    resolveGet([{ role: 'assistant', text: '历史回复', toolUses: [] }])
    await loadPromise

    // 修复后:历史 + 运行时合并,都不丢(历史在前)
    expect(useAgentStore.getState().getMessages(taskId)).toEqual([
      { role: 'assistant', text: '历史回复', toolUses: [] },
      { role: 'assistant', text: '流式中', toolUses: [] },
    ])
    expect(useAgentStore.getState()._loaded[taskId]).toBe(true)
    await useAgentStore.getState().loadHistory(taskId)
    expect(ai.getSessionMessages).toHaveBeenCalledTimes(1)
  })

  it('loadHistory 会话正在 running 时不覆盖实时流式输出', async () => {
    vi.mocked(ai.listSessions).mockResolvedValue([
      { sessionId: 's-run', summary: 'R', lastModified: 1, cwd: '/ws' },
    ])
    useAgentStore.getState().setDefaultWorkspace('/ws')
    await useAgentStore.getState().hydrate()
    const taskId = useAgentStore.getState().tasks[0].taskId
    // 模拟该会话正在流式:sendPrompt 会把 status 置 running
    useAgentStore.getState().sendPrompt(taskId, '追问')
    expect(useAgentStore.getState().tasks[0].status).toBe('running')

    vi.mocked(ai.getSessionMessages).mockResolvedValue([
      { role: 'assistant', text: '历史回复', toolUses: [] },
    ])
    await useAgentStore.getState().loadHistory(taskId)

    // running 态:历史不冲掉实时输出;只保留运行时那条(sendPrompt 写入的用户消息)
    expect(useAgentStore.getState().getMessages(taskId)).toEqual([
      { role: 'user', text: '追问' },
    ])
    expect(useAgentStore.getState()._loaded[taskId]).toBe(true)
  })

  it('hydrate 并发去重:StrictMode 连发两次只拉一次 listSessions', async () => {
    let resolveList: (v: any) => void = () => {}
    vi.mocked(ai.listSessions).mockReturnValue(
      new Promise((r) => { resolveList = r }),
    )
    useAgentStore.getState().setDefaultWorkspace('/ws')

    // 模拟 StrictMode 重挂:首个 await 未返回时再发一次
    const p1 = useAgentStore.getState().hydrate()
    const p2 = useAgentStore.getState().hydrate()
    resolveList([{ sessionId: 's-d', summary: 'D', lastModified: 1, cwd: '/ws' }])
    await Promise.all([p1, p2])

    expect(ai.listSessions).toHaveBeenCalledTimes(1)
    expect(useAgentStore.getState().hydrated).toBe(true)
    expect(useAgentStore.getState().tasks).toHaveLength(1)
  })

  it('hydrate 迁移:旧文件不存在时不调 readFile(避免主进程 ENOENT 日志噪音)', async () => {
    vi.mocked(fs.exists).mockResolvedValue(false)
    useAgentStore.getState().setDefaultWorkspace('/ws')
    vi.mocked(ai.listSessions).mockResolvedValue([])
    await useAgentStore.getState().hydrate()
    expect(fs.exists).toHaveBeenCalledWith('agent-sessions.json')
    expect(fs.readFile).not.toHaveBeenCalled()
    expect(useAgentStore.getState().migratedDropped).toBe(0)
  })

  it('hydrate 迁移:旧文件存在时记 migratedDropped 并删除', async () => {
    vi.mocked(fs.exists).mockResolvedValue(true)
    vi.mocked(fs.readFile).mockResolvedValue('[{"a":1},{"a":2}]')
    useAgentStore.getState().setDefaultWorkspace('/ws')
    vi.mocked(ai.listSessions).mockResolvedValue([])
    await useAgentStore.getState().hydrate()
    expect(fs.readFile).toHaveBeenCalledWith('agent-sessions.json')
    expect(useAgentStore.getState().migratedDropped).toBe(2)
    expect(fs.deleteFile).toHaveBeenCalledWith('agent-sessions.json')
  })
})
