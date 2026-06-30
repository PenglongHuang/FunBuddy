import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock SDK,必须在 import 被测模块之前
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(),
  getSessionInfo: vi.fn(),
  deleteSession: vi.fn(),
}))

import { listSessions, getSessionMessages, getSessionInfo, deleteSession } from '@anthropic-ai/claude-agent-sdk'
import {
  listAgentSessions,
  getAgentSessionMessages,
  sessionExists,
  deleteAgentSession,
} from '../sessions'

describe('sessions 封装层', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listAgentSessions 透传 dir/limit 并返回原结构', async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { sessionId: 's-1', summary: '标题', lastModified: 1000, cwd: '/w' },
    ])
    const result = await listAgentSessions({ dir: '/w', limit: 10 })
    expect(listSessions).toHaveBeenCalledWith({ dir: '/w', limit: 10, includeWorktrees: true })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ sessionId: 's-1', summary: '标题' })
  })

  it('getAgentSessionMessages 返回映射后的 AgentMessage(过滤 null)', async () => {
    vi.mocked(getSessionMessages).mockResolvedValue([
      { type: 'user', uuid: 'u', session_id: 's', message: { role: 'user', content: [{ type: 'text', text: '问' }] }, parent_tool_use_id: null },
      { type: 'assistant', uuid: 'a', session_id: 's', message: { role: 'assistant', content: [{ type: 'text', text: '答' }] }, parent_tool_use_id: null },
      { type: 'assistant', uuid: 'sub', session_id: 's', message: { role: 'assistant', content: [{ type: 'text', text: '子代理' }] }, parent_tool_use_id: 'tu_1' },
    ] as any)
    const result = await getAgentSessionMessages('s', { dir: '/w' })
    expect(getSessionMessages).toHaveBeenCalledWith('s', { dir: '/w' })
    expect(result).toEqual([
      { role: 'user', text: '问' },
      { role: 'assistant', text: '答', toolUses: [] },
    ])
  })

  it('sessionExists 在 getSessionInfo 返回值时为 true', async () => {
    vi.mocked(getSessionInfo).mockResolvedValue({ sessionId: 's', summary: 'x', lastModified: 1 })
    expect(await sessionExists('s', '/w')).toBe(true)
    expect(getSessionInfo).toHaveBeenCalledWith('s', { dir: '/w' })
  })

  it('sessionExists 在 getSessionInfo 返回 undefined 时为 false', async () => {
    vi.mocked(getSessionInfo).mockResolvedValue(undefined)
    expect(await sessionExists('s', '/w')).toBe(false)
  })

  it('deleteAgentSession 透传并吞掉错误(孤儿清理是 best-effort)', async () => {
    vi.mocked(deleteSession).mockResolvedValue(undefined)
    await deleteAgentSession('s', '/w')
    expect(deleteSession).toHaveBeenCalledWith('s', { dir: '/w' })
  })

  it('deleteAgentSession 失败时不抛(swallow)', async () => {
    vi.mocked(deleteSession).mockRejectedValue(new Error('gone'))
    await expect(deleteAgentSession('s', '/w')).resolves.toBeUndefined()
  })
})
