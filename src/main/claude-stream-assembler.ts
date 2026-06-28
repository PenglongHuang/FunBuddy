/**
 * 把一轮 assistant 流式输出的原始 stream_event 装配成带稳定 `id` 的部分消息,
 * 供渲染层 upsert(按 id 替换)而非追加。每个 assistant turn 一个实例。
 *
 * 注意:本文件刻意不依赖 SDK 的精确事件类型名(避免 SDK 类型漂移),
 * 仅消费下方 StreamEvent 窄结构;claude-service 在调用处把 SDK 事件 cast 进来。
 */

export interface AssemblerToolUse {
  name: string
  input?: unknown
}

export interface AssemblerEmit {
  /** 稳定 id,如 `${taskId}#${turnIndex}`;同一 turn 的所有 partial 与 final 共用 */
  id: string
  text: string
  toolUses: AssemblerToolUse[]
  /** true=流式进行中;false=权威消息收尾 */
  partial: boolean
}

/** 我们消费的 Anthropic 流事件的窄结构视图。 */
export type StreamEvent =
  | { type: 'message_start' }
  | { type: 'content_block_start'; index: number; content_block: { type: string; name?: string } }
  | {
      type: 'content_block_delta'
      index: number
      delta: { type: string; text?: string; partial_json?: string }
    }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta' | 'message_stop' | 'ping' }

interface ToolSlot {
  name: string
  raw: string
  input?: unknown
}

export class TurnAssembler {
  private text = ''
  private toolByIndex: Map<number, ToolSlot> = new Map()

  constructor(public readonly id: string) {}

  /** 喂入一个 stream_event;返回要转发的 partial,或 null(无关事件)。 */
  feed(event: StreamEvent): AssemblerEmit | null {
    switch (event.type) {
      case 'message_start':
        return this.emit(true)
      case 'content_block_start': {
        const cb = event.content_block
        if (cb.type === 'tool_use' && cb.name) {
          this.toolByIndex.set(event.index, { name: cb.name, raw: '' })
        }
        return this.emit(true)
      }
      case 'content_block_delta': {
        const d = event.delta
        if (d.type === 'text_delta' && typeof d.text === 'string') {
          this.text += d.text
        } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
          const t = this.toolByIndex.get(event.index)
          if (t) t.raw += d.partial_json
        }
        return this.emit(true)
      }
      case 'content_block_stop': {
        const t = this.toolByIndex.get(event.index)
        if (t && t.raw) {
          try {
            t.input = JSON.parse(t.raw)
          } catch {
            /* 解析失败则保留 input=undefined,等权威消息纠正 */
          }
        }
        return this.emit(true)
      }
      default:
        return null
    }
  }

  /** 收到权威 assistant 消息时收尾:用最终文本与工具覆盖,partial:false,同 id。 */
  finalize(finalText: string, finalTools: AssemblerToolUse[]): AssemblerEmit {
    this.text = finalText
    this.toolByIndex = new Map(
      finalTools.map((t, i) => [i, { name: t.name, raw: '', input: t.input }] as [number, ToolSlot]),
    )
    return this.emit(false)
  }

  private emit(partial: boolean): AssemblerEmit {
    return {
      id: this.id,
      text: this.text,
      toolUses: [...this.toolByIndex.values()].map((t) => ({ name: t.name, input: t.input })),
      partial,
    }
  }
}
