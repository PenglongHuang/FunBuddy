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
        { name: 'Read', id: 'tu_1', input: { file_path: 'a.ts' } },
        { name: 'Edit', id: 'tu_2', input: { file_path: 'a.ts' } },
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
      result: 'done',
      total_cost_usd: 0.0123,
      num_turns: 3,
    } as any
    expect(mapToAgentMessage(msg)).toEqual({
      role: 'system',
      kind: 'result',
      meta: { isError: false, subtype: 'success', result: 'done', costUsd: 0.0123, numTurns: 3 },
    })
  })

  it('maps error result and forwards the reason text in meta.result', () => {
    const msg = {
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      result: 'tool failed: permission denied',
      total_cost_usd: 0.0001,
      num_turns: 1,
    } as any
    expect(mapToAgentMessage(msg)).toEqual({
      role: 'system',
      kind: 'result',
      meta: {
        isError: true,
        subtype: 'error_during_execution',
        result: 'tool failed: permission denied',
        costUsd: 0.0001,
        numTurns: 1,
      },
    })
  })

  it('returns null for stream_event (MVP skips partial)', () => {
    expect(mapToAgentMessage({ type: 'stream_event' } as any)).toBeNull()
  })

  it('returns null for user echo', () => {
    expect(mapToAgentMessage({ type: 'user' } as any)).toBeNull()
  })
})
