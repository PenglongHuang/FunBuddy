import { describe, expect, it } from 'vitest'
import { TurnAssembler, type StreamEvent } from '../claude-stream-assembler'

const msgStart = (): StreamEvent => ({ type: 'message_start' })
const textStart = (index: number): StreamEvent => ({
  type: 'content_block_start',
  index,
  content_block: { type: 'text' },
})
const textDelta = (index: number, text: string): StreamEvent => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'text_delta', text },
})
const toolStart = (index: number, name: string, id?: string): StreamEvent => ({
  type: 'content_block_start',
  index,
  content_block: { type: 'tool_use', name, ...(id ? { id } : {}) },
})
const inputDelta = (index: number, partial: string): StreamEvent => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'input_json_delta', partial_json: partial },
})
const blockStop = (index: number): StreamEvent => ({ type: 'content_block_stop', index })
const ping = (): StreamEvent => ({ type: 'ping' })
const messageStop = (): StreamEvent => ({ type: 'message_stop' })

describe('TurnAssembler', () => {
  it('message_start 发出空 partial(让"思考中"气泡立刻出现)', () => {
    const a = new TurnAssembler('t1#1')
    const e = a.feed(msgStart())
    expect(e).toEqual({ id: 't1#1', text: '', toolUses: [], partial: true })
  })

  it('text_delta 逐 token 累加文本', () => {
    const a = new TurnAssembler('t1#1')
    a.feed(msgStart())
    a.feed(textStart(0))
    a.feed(textDelta(0, 'Hel'))
    const e = a.feed(textDelta(0, 'lo'))
    expect(e?.text).toBe('Hello')
    expect(e?.partial).toBe(true)
  })

  it('tool_use: start 登记 name,input_json_delta 累加,stop 解析 input', () => {
    const a = new TurnAssembler('t1#1')
    a.feed(msgStart())
    a.feed(toolStart(0, 'Read'))
    a.feed(inputDelta(0, '{"file_path":"src'))
    a.feed(inputDelta(0, '/auth.ts"}'))
    const e = a.feed(blockStop(0))
    expect(e?.toolUses).toEqual([{ name: 'Read', input: { file_path: 'src/auth.ts' } }])
  })

  it('tool_use 带 id 时透传到 emit', () => {
    const a = new TurnAssembler('t1#1')
    a.feed(msgStart())
    a.feed(toolStart(0, 'Read', 'tu-9'))
    a.feed(inputDelta(0, '{"file_path":"a.ts"}'))
    const e = a.feed(blockStop(0))
    expect(e?.toolUses).toEqual([{ name: 'Read', id: 'tu-9', input: { file_path: 'a.ts' } }])
  })

  it('多工具按出现顺序保留', () => {
    const a = new TurnAssembler('t1#1')
    a.feed(msgStart())
    a.feed(toolStart(0, 'Read'))
    a.feed(inputDelta(0, '{"file_path":"a.ts"}'))
    a.feed(blockStop(0))
    a.feed(toolStart(1, 'Bash'))
    a.feed(inputDelta(1, '{"command":"git status"}'))
    const e = a.feed(blockStop(1))
    expect(e?.toolUses.map((t) => t.name)).toEqual(['Read', 'Bash'])
    expect(e?.toolUses[1].input).toEqual({ command: 'git status' })
  })

  it('finalize 用权威文本/工具覆盖,同 id,partial:false', () => {
    const a = new TurnAssembler('t1#1')
    a.feed(msgStart())
    a.feed(textStart(0))
    a.feed(textDelta(0, 'partial...'))
    const e = a.finalize('最终完整文本', [{ name: 'Read', id: 'tu-1', input: { file_path: 'a.ts' } }])
    expect(e).toEqual({
      id: 't1#1',
      text: '最终完整文本',
      toolUses: [{ name: 'Read', id: 'tu-1', input: { file_path: 'a.ts' } }],
      partial: false,
    })
  })

  it('ping/message_stop 等无关事件返回 null', () => {
    const a = new TurnAssembler('t1#1')
    expect(a.feed(ping())).toBeNull()
    expect(a.feed(messageStop())).toBeNull()
  })

  it('input_json_delta 解析失败时 input 留 undefined(等权威纠正)', () => {
    const a = new TurnAssembler('t1#1')
    a.feed(msgStart())
    a.feed(toolStart(0, 'Read'))
    a.feed(inputDelta(0, '{不是合法json'))
    const e = a.feed(blockStop(0))
    expect(e?.toolUses).toEqual([{ name: 'Read', input: undefined }])
  })
})
