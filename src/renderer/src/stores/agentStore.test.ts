import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentStore } from './agentStore'

describe('agentStore', () => {
  beforeEach(() => useAgentStore.getState().reset())

  it('createTask adds a task in running status', () => {
    const taskId = useAgentStore.getState().createTask('do thing', '/ws')
    const s = useAgentStore.getState()
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0].status).toBe('running')
    expect(s.activeTaskId).toBe(taskId)
  })

  it('ingest appends assistant message', () => {
    const taskId = useAgentStore.getState().createTask('t', '/ws')
    useAgentStore.getState().ingest(taskId, { role: 'assistant', text: 'hi', toolUses: [] })
    const s = useAgentStore.getState()
    expect(s.tasks[0].messages).toHaveLength(1)
    expect(s.tasks[0].messages[0]).toMatchObject({ role: 'assistant', text: 'hi' })
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
})
