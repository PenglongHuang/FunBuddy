import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentStore } from './agentStore'

describe('agentStore', () => {
  beforeEach(() => useAgentStore.getState().reset())

  it('createTask adds a task in running status', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 'do thing', '/ws')
    const cur = useAgentStore.getState()
    expect(cur.tasks).toHaveLength(1)
    expect(cur.tasks[0].status).toBe('running')
    expect(cur.activeTaskId).toBe('t1')
  })

  it('ingest appends assistant message', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 't', '/ws')
    s.ingest('t1', { role: 'assistant', text: 'hi', toolUses: [] })
    const cur = useAgentStore.getState()
    expect(cur.tasks[0].messages).toHaveLength(1)
    expect(cur.tasks[0].messages[0]).toMatchObject({ role: 'assistant', text: 'hi' })
  })

  it('ingest init captures sessionId', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 't', '/ws')
    s.ingest('t1', { role: 'system', kind: 'init', meta: { sessionId: 'sess-9' } })
    const cur = useAgentStore.getState()
    expect(cur.tasks[0].sessionId).toBe('sess-9')
  })

  it('ingest result with isError=false sets status idle', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 't', '/ws')
    s.ingest('t1', { role: 'system', kind: 'result', meta: { isError: false } })
    const cur = useAgentStore.getState()
    expect(cur.tasks[0].status).toBe('idle')
  })

  it('ingest result with isError=true sets status error', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 't', '/ws')
    s.ingest('t1', { role: 'system', kind: 'result', meta: { isError: true } })
    const cur = useAgentStore.getState()
    expect(cur.tasks[0].status).toBe('error')
  })

  it('ingest error sets status error', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 't', '/ws')
    s.ingest('t1', { role: 'system', kind: 'error', meta: { error: 'boom' } })
    const cur = useAgentStore.getState()
    expect(cur.tasks[0].status).toBe('error')
  })

  it('markStopped sets status stopped', () => {
    const s = useAgentStore.getState()
    s.createTask('t1', 't', '/ws')
    s.markStopped('t1')
    const cur = useAgentStore.getState()
    expect(cur.tasks[0].status).toBe('stopped')
  })
})
