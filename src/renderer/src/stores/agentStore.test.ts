import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ai, fs } from '@/lib/ipc'
import { useAgentStore } from './agentStore'

vi.mock('@/lib/ipc', () => ({
  ai: {
    startTask: vi.fn().mockResolvedValue(undefined),
    stopTask: vi.fn().mockResolvedValue(undefined),
    checkClaude: vi.fn().mockResolvedValue({ installed: true }),
  },
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn(),
    deleteFile: vi.fn(),
  },
}))

describe('agentStore', () => {
  beforeEach(() => {
    useAgentStore.getState().reset()
    vi.mocked(ai.startTask).mockClear()
    vi.mocked(fs.readFile).mockReset()
    vi.mocked(fs.writeFile).mockClear()
  })

  it('createTask adds a task in idle status (draft)', () => {
    const taskId = useAgentStore.getState().createTask('do thing', '/ws')
    const s = useAgentStore.getState()
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0].status).toBe('idle')
    expect(s.activeTaskId).toBe(taskId)
  })

  it('ingest appends assistant message', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'assistant', text: 'hi', toolUses: [] })
    const s = useAgentStore.getState()
    expect(s.tasks[0].messages).toHaveLength(1)
    expect(s.tasks[0].messages[0]).toMatchObject({ role: 'assistant', text: 'hi' })
  })

  it('ingest upserts assistant message by id (partial→final replace, no duplicates)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    const store = useAgentStore.getState()
    store.ingest(taskId, { role: 'assistant', text: 'Hel', toolUses: [], id: 't#1', partial: true })
    store.ingest(taskId, { role: 'assistant', text: 'Hell', toolUses: [], id: 't#1', partial: true })
    store.ingest(taskId, { role: 'assistant', text: 'Hello', toolUses: [], id: 't#1', partial: false })
    const msgs = useAgentStore.getState().tasks[0].messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ text: 'Hello', partial: false })
  })

  it('ingest init captures sessionId', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'init', meta: { sessionId: 'sess-9' } })
    expect(useAgentStore.getState().tasks[0].sessionId).toBe('sess-9')
  })

  it('ingest result with isError=false sets status idle', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'result', meta: { isError: false } })
    expect(useAgentStore.getState().tasks[0].status).toBe('idle')
  })

  it('ingest result with isError=true sets status error', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'result', meta: { isError: true } })
    expect(useAgentStore.getState().tasks[0].status).toBe('error')
  })

  it('ingest error sets status error', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'error', meta: { error: 'boom' } })
    expect(useAgentStore.getState().tasks[0].status).toBe('error')
  })

  it('markStopped sets status stopped', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().markStopped(taskId)
    expect(useAgentStore.getState().tasks[0].status).toBe('stopped')
  })

  it('sendPrompt passes task sessionId to ai.startTask (resume)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'init', meta: { sessionId: 'sess-1' } })
    useAgentStore.getState().sendPrompt(taskId, 'second question')
    expect(ai.startTask).toHaveBeenCalledWith(taskId, 'second question', '/ws', 'sess-1')
  })

  it('sendPrompt with no sessionId passes undefined (first turn)', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().sendPrompt(taskId, 'first question')
    expect(ai.startTask).toHaveBeenCalledWith(taskId, 'first question', '/ws', undefined)
  })

  it('deleteTask removes task and reassigns active', () => {
    const a = useAgentStore.getState().createTask('A', '/ws')
    const b = useAgentStore.getState().createTask('B', '/ws')
    useAgentStore.getState().setActiveTask(a)
    useAgentStore.getState().deleteTask(a)
    const s = useAgentStore.getState()
    expect(s.tasks.find((t) => t.taskId === a)).toBeUndefined()
    expect(s.tasks).toHaveLength(1)
    expect(s.activeTaskId).toBe(b)
  })

  it('hydrate normalizes running→stopped and activates the most recent', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify([
        { taskId: 'a', title: 'A', workspace: '/w', status: 'running', messages: [], sessionId: 's-a', updatedAt: 100 },
        { taskId: 'b', title: 'B', workspace: '/w', status: 'idle', messages: [], updatedAt: 200 },
      ]),
    )
    await useAgentStore.getState().hydrate()
    const s = useAgentStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.tasks).toHaveLength(2)
    expect(s.tasks.find((t) => t.taskId === 'a')?.status).toBe('stopped')
    expect(s.activeTaskId).toBe('b')
  })

  it('persist + hydrate round-trip', async () => {
    vi.useFakeTimers()
    const taskId = useAgentStore.getState().createTask('round', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'system', kind: 'init', meta: { sessionId: 's1' } })
    useAgentStore.getState().ingest(taskId, { role: 'assistant', text: 'hi', toolUses: [], id: `${taskId}#1`, partial: false })
    vi.advanceTimersByTime(500)
    vi.useRealTimers()

    expect(fs.writeFile).toHaveBeenCalled()
    const calls = vi.mocked(fs.writeFile).mock.calls
    const written = (calls[calls.length - 1]?.[1] as string) ?? ''
    expect(written).toContain('round')

    useAgentStore.getState().reset()
    vi.mocked(fs.readFile).mockResolvedValue(written)
    await useAgentStore.getState().hydrate()
    const t = useAgentStore.getState().tasks.find((x) => x.taskId === taskId)
    expect(t?.title).toBe('round')
    expect(t?.sessionId).toBe('s1')
    expect(t?.messages.some((m) => m.role === 'assistant')).toBe(true)
  })
})
