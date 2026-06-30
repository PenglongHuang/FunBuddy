import { describe, it, expect } from 'vitest'
import { mapToAgentMessage } from '../claude-message-mapper'

describe('mapToAgentMessage', () => {
  it('maps system init to system init with sessionId + model', () => {
    const msg = {
      type: 'system',
      subtype: 'init',
      session_id: 'sess-1',
      model: 'claude-opus-4-8',
    } as any
    expect(mapToAgentMessage(msg)).toEqual({
      role: 'system',
      kind: 'init',
      meta: { sessionId: 'sess-1', model: 'claude-opus-4-8' },
    })
  })

  it('maps assistant text + tool_use blocks', () => {
    const msg = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Looking at the file.' },
          { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: 'a.ts' } },
          { type: 'tool_use', id: 'tu_2', name: 'Edit', input: { file_path: 'a.ts' } },
        ],
      },
    } as any
    expect(mapToAgentMessage(msg)).toEqual({
      role: 'assistant',
      text: 'Looking at the file.',
      toolUses: [
        { name: 'Read', input: { file_path: 'a.ts' } },
        { name: 'Edit', input: { file_path: 'a.ts' } },
      ],
    })
  })

  it('concatenates multiple text blocks', () => {
    const msg = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
    } as any
    expect((mapToAgentMessage(msg) as any).text).toBe('ab')
  })

  it('maps result with isError + cost + turns', () => {
    const msg = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      total_cost_usd: 0.0123,
      num_turns: 3,
    } as any
    expect(mapToAgentMessage(msg)).toEqual({
      role: 'system',
      kind: 'result',
      meta: { isError: false, subtype: 'success', costUsd: 0.0123, numTurns: 3 },
    })
  })

  it('returns null for stream_event (MVP skips partial)', () => {
    expect(mapToAgentMessage({ type: 'stream_event' } as any)).toBeNull()
  })

  it('returns null for user echo', () => {
    expect(mapToAgentMessage({ type: 'user' } as any)).toBeNull()
  })
})
