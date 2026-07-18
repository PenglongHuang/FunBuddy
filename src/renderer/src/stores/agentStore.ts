import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { ai, fs } from '@/lib/ipc'
import { useToastStore } from './toastStore'
import { describeSystemError } from '@/lib/normalize-error'
import type { AgentMessage, AgentTask } from '../../../shared/agent-types'
import { attachToolResult } from '../../../shared/tool-result-util'

/**
 * 会话消息视图:按 taskId 索引的纯内存数组。运行中由 provider 流式 ingest;
 * 历史会话由 loadHistory() 从 CLI getSessionMessages 回填。永不落盘。
 */
type MessageMap = Record<string, AgentMessage[]>

/**
 * in-flight 去重:StrictMode 下 effect 会连发两次,两次都会通过 `hydrated`/`_loaded`
 * 检查(它们在 await 之后才置位),导致重复拉取/覆盖。槽位记录"正在进行的 promise",
 * 第二次调用直接复用同一个,既不重复也不覆盖。失败时清槽位以保留重试能力。
 */
let hydrateInFlight: Promise<void> | null = null
const loadHistoryInFlight = new Map<string, Promise<void>>()

interface AgentStore {
  tasks: AgentTask[]
  activeTaskId: string | null
  defaultWorkspace: string
  hydrated: boolean
  /** 旧 agent-sessions.json 迁移时丢弃的失效记录数(用于首启 toast) */
  migratedDropped: number
  _messages: MessageMap
  _loaded: Record<string, true>
  setDefaultWorkspace: (ws: string) => void
  createTask: (title: string, workspace: string) => string
  sendPrompt: (taskId: string, prompt: string) => void
  stopTask: (taskId: string) => void
  ingest: (taskId: string, msg: AgentMessage) => void
  markStopped: (taskId: string) => void
  setActiveTask: (taskId: string | null) => void
  deleteTask: (taskId: string) => Promise<void>
  hydrate: () => Promise<void>
  /** 拉取某 live 会话的历史消息到内存视图(懒加载) */
  loadHistory: (taskId: string) => Promise<void>
  /** 读取某会话的内存消息视图 */
  getMessages: (taskId: string) => AgentMessage[]
  reset: () => void
}

export const useAgentStore = create<AgentStore>()(
  immer((set, get) => ({
    tasks: [],
    activeTaskId: null,
    defaultWorkspace: '',
    hydrated: false,
    migratedDropped: 0,
    _messages: {},
    _loaded: {},

    setDefaultWorkspace: (ws) => set((s) => { s.defaultWorkspace = ws }),

    createTask: (title, workspace) => {
      const taskId = nanoid(8)
      const task: AgentTask = {
        phase: 'draft',
        taskId,
        title,
        workspace,
        status: 'idle',
      }
      set((s) => {
        s.tasks.push(task)
        s._messages[taskId] = []
        s.activeTaskId = taskId
      })
      return taskId
    },

    sendPrompt: (taskId, prompt) => {
      const task = get().tasks.find((t) => t.taskId === taskId)
      if (!task) return
      const sessionId = task.phase === 'live' ? task.sessionId : undefined
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (t) {
          t.status = 'running'
          t.updatedAt = Date.now()
          const msgs = s._messages[taskId] ?? []
          const isFirstUser = !msgs.some((m) => m.role === 'user')
          if (isFirstUser) t.title = prompt.slice(0, 40)
        }
        s._messages[taskId] = [...(s._messages[taskId] ?? []), { role: 'user', text: prompt }]
      })
      ai.startTask(taskId, prompt, task.workspace, sessionId).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        get().ingest(taskId, { role: 'system', kind: 'error', meta: { error: `startTask failed: ${msg}` } })
      })
    },

    stopTask: (taskId) => {
      ai.stopTask(taskId).catch(() => {})
      get().markStopped(taskId)
    },

    ingest: (taskId, msg) => {
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (!t) return

        // init:把 draft 升级为 live,绑定 sessionId。
        // 重复 init(已 live)是 no-op——provider 重启/重放不覆盖已有 sessionId。
        if (msg.role === 'system' && msg.kind === 'init') {
          const sid = msg.meta?.sessionId
          if (typeof sid === 'string' && sid && t.phase === 'draft') {
            const idx = s.tasks.findIndex((x) => x.taskId === taskId)
            if (idx >= 0) {
              s.tasks[idx] = {
                phase: 'live',
                taskId: t.taskId,
                sessionId: sid,
                title: t.title,
                workspace: t.workspace,
                status: t.status,
                updatedAt: t.updatedAt,
              }
            }
          }
          return
        }

        if (msg.role === 'system') {
          if (msg.kind === 'result') {
            t.status = msg.meta?.isError ? 'error' : 'idle'
            t.updatedAt = Date.now()
          } else if (msg.kind === 'error') {
            t.status = 'error'
            t.updatedAt = Date.now()
          }
          // tool_result:按 toolUseId 关联到所属 assistant.toolUses[i].result。
          // 不写入 _messages(避免成为独立消息),不弹 toast;找不到归属(如 id 不匹配)安全忽略。
          // meta 由 claude-code.ts 恒发齐 {toolUseId,content,isError,chars,lines},一次断言即可。
          if (msg.kind === 'tool_result') {
            const m = msg.meta as { toolUseId: string; content: string; isError: boolean; chars: number; lines: number }
            attachToolResult(
              s._messages[taskId] ?? [],
              m.toolUseId,
              { content: m.content, isError: m.isError, chars: m.chars, lines: m.lines },
            )
            return
          }
          // 仅把错误写入 _messages 供 UI 渲染;成功 result 不入库,避免逐轮堆积
          if (msg.kind === 'error' || (msg.kind === 'result' && msg.meta?.isError)) {
            s._messages[taskId] = [...(s._messages[taskId] ?? []), msg]
            const { prefix, title } = describeSystemError(msg)
            useToastStore.getState().show(prefix + title)
          }
          return
        }

        // assistant:按 id upsert(partial→final 替换);否则追加
        if (msg.role === 'assistant' && msg.id) {
          const arr = s._messages[taskId] ?? []
          const idx = arr.findIndex(
            (m) => m.role === 'assistant' && (m as AgentMessage & { id?: string }).id === msg.id,
          )
          if (idx >= 0) arr[idx] = msg
          else arr.push(msg)
          s._messages[taskId] = arr
        } else if (msg.role === 'assistant') {
          s._messages[taskId] = [...(s._messages[taskId] ?? []), msg]
        }

        if (msg.role === 'assistant' && !msg.partial) {
          t.updatedAt = Date.now()
        }
      })
    },

    markStopped: (taskId) => {
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (t) {
          t.status = 'stopped'
          t.updatedAt = Date.now()
        }
      })
    },

    setActiveTask: (taskId) => set({ activeTaskId: taskId }),

    deleteTask: async (taskId) => {
      const task = get().tasks.find((t) => t.taskId === taskId)
      if (task?.phase === 'live') {
        await ai.deleteSession(task.sessionId, task.workspace).catch(() => {})
      }
      set((s) => {
        s.tasks = s.tasks.filter((t) => t.taskId !== taskId)
        delete s._messages[taskId]
        delete s._loaded[taskId]
        if (s.activeTaskId === taskId) {
          s.activeTaskId = s.tasks[0]?.taskId ?? null
        }
      })
    },

    hydrate: async () => {
      if (get().hydrated) return
      // StrictMode 重挂会在首个 await 返回前再发一次;复用同一 promise 避免重复拉取/覆盖。
      if (hydrateInFlight) return hydrateInFlight
      hydrateInFlight = (async () => {
        try {
          await migrateLegacySessions(set)

          let workspace = get().defaultWorkspace
          if (!workspace) {
            try {
              const dir = await fs.getStorageDir()
              if (dir) {
                workspace = dir
                set((s) => { s.defaultWorkspace = dir })
              }
            } catch {
              /* 取不到 workspace 就跳过 listSessions */
            }
          }
          let sessions: { sessionId: string; summary: string; lastModified: number; cwd?: string }[] = []
          if (workspace) {
            try {
              sessions = await ai.listSessions(workspace)
            } catch {
              sessions = []
            }
          }
          const tasks: AgentTask[] = sessions.map((sess) => ({
            phase: 'live',
            taskId: sess.sessionId, // live 态直接用 sessionId 当 taskId,简化映射
            sessionId: sess.sessionId,
            title: sess.summary,
            workspace: sess.cwd ?? workspace,
            status: 'idle',
            updatedAt: sess.lastModified,
          }))
          const sorted = [...tasks].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          set((s) => {
            s.tasks = sorted
            for (const t of sorted) s._messages[t.taskId] = []
            s.activeTaskId = sorted[0]?.taskId ?? null
            s.hydrated = true
          })
        } finally {
          hydrateInFlight = null
        }
      })()
      return hydrateInFlight
    },

    loadHistory: async (taskId) => {
      const task = get().tasks.find((t) => t.taskId === taskId)
      if (task?.phase !== 'live') return
      if (get()._loaded[taskId]) return
      // StrictMode 会连发两次,且 _loaded 在 await 后才置位;复用同一 promise 杜绝重复拉取/翻倍合并。
      const existing = loadHistoryInFlight.get(taskId)
      if (existing) return existing
      const promise = (async () => {
        try {
          const msgs = await ai.getSessionMessages(task.sessionId, task.workspace)
          set((s) => {
            // 仅当会话真在运行(status==='running')时才不动——那是实时流式,不能被历史冲掉。
            // 否则合并:历史在前,await 期间进来的运行时消息(如用户刚发的一句)在后。
            const t = s.tasks.find((x) => x.taskId === taskId)
            if (t?.status === 'running') {
              s._loaded[taskId] = true
              return
            }
            s._messages[taskId] = [...msgs, ...(s._messages[taskId] ?? [])]
            s._loaded[taskId] = true
          })
        } catch {
          /* 拉取失败保持空视图,不标记 loaded,下次可重试 */
        } finally {
          loadHistoryInFlight.delete(taskId)
        }
      })()
      loadHistoryInFlight.set(taskId, promise)
      return promise
    },

    getMessages: (taskId) => get()._messages[taskId] ?? [],

    reset: () => {
      set({ tasks: [], activeTaskId: null, hydrated: false, _messages: {}, _loaded: {}, migratedDropped: 0 })
    },
  })),
)

/**
 * 首启迁移:读旧 agent-sessions.json,删除它,并记数 migratedDropped = 旧记录总数。
 * 决策(已拍板):失效记录直接丢弃,有效记录由后续 listSessions 自然重新纳入。
 */
async function migrateLegacySessions(
  set: (fn: (s: AgentStore) => void) => void,
): Promise<void> {
  try {
    // 先 exists 再读:旧文件几乎必然不存在(仅老用户升级首启才存在)。
    // 直接 readFile 会让主进程 fs:readFile handler 在 reject 前打印
    // "Error occurred in handler for 'fs:readFile': ENOENT ..."——每次启动噪音。
    // exists 走 existsSync,不抛错、不打日志。
    if (!(await fs.exists('agent-sessions.json'))) return
    const raw = await fs.readFile('agent-sessions.json')
    const legacy = JSON.parse(raw) as unknown[]
    set((s) => { s.migratedDropped = Array.isArray(legacy) ? legacy.length : 0 })
    await fs.deleteFile('agent-sessions.json').catch(() => {})
  } catch {
    /* 旧文件读不出就算了 */
  }
}
