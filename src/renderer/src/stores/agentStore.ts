import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { ai, fs } from '@/lib/ipc'
import type { AgentMessage, AgentTask } from '../../../shared/agent-types'

/** 持久化文件名(相对 storageDir) */
const SESSIONS_FILE = 'agent-sessions.json'
/** 持久化去抖间隔 */
const PERSIST_DEBOUNCE_MS = 400

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** 去抖落盘整个 tasks 数组。partial 流式增量不应触发(由调用方决定)。 */
function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const { tasks } = useAgentStore.getState()
    fs.writeFile(SESSIONS_FILE, JSON.stringify(tasks, null, 2)).catch(() => {
      /* 落盘失败不影响会话 */
    })
  }, PERSIST_DEBOUNCE_MS)
}

interface AgentStore {
  tasks: AgentTask[]
  activeTaskId: string | null
  defaultWorkspace: string
  hydrated: boolean
  setDefaultWorkspace: (ws: string) => void
  createTask: (title: string, workspace: string) => string
  sendPrompt: (taskId: string, prompt: string) => void
  stopTask: (taskId: string) => void
  ingest: (taskId: string, msg: AgentMessage) => void
  markStopped: (taskId: string) => void
  setActiveTask: (taskId: string | null) => void
  deleteTask: (taskId: string) => void
  hydrate: () => Promise<void>
  reset: () => void
}

export const useAgentStore = create<AgentStore>()(
  immer((set, get) => ({
    tasks: [],
    activeTaskId: null,
    defaultWorkspace: '',
    hydrated: false,

    setDefaultWorkspace: (ws) => set((s) => { s.defaultWorkspace = ws }),

    createTask: (title, workspace) => {
      const taskId = nanoid(8)
      const task: AgentTask = {
        taskId,
        title,
        workspace,
        status: 'idle',
        messages: [],
        updatedAt: Date.now(),
      }
      set((s) => {
        s.tasks.push(task)
        s.activeTaskId = taskId
      })
      schedulePersist()
      return taskId
    },

    sendPrompt: (taskId, prompt) => {
      const task = get().tasks.find((t) => t.taskId === taskId)
      if (!task) return
      const isFirstUserMsg = !task.messages.some((m) => m.role === 'user')
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (t) {
          t.messages.push({ role: 'user', text: prompt })
          // 首条 prompt 把草态标题改为 prompt 摘要
          if (isFirstUserMsg) t.title = prompt.slice(0, 40)
          t.status = 'running'
          t.updatedAt = Date.now()
        }
      })
      // 带上 sessionId 让 main 走 resume 续接历史;首条消息 sessionId 为 undefined
      ai.startTask(taskId, prompt, task.workspace, task.sessionId).catch(() => {
        get().ingest(taskId, { role: 'system', kind: 'error', meta: { error: 'startTask failed' } })
      })
      schedulePersist()
    },

    stopTask: (taskId) => {
      ai.stopTask(taskId).catch(() => {})
      get().markStopped(taskId)
    },

    ingest: (taskId, msg) => {
      // assistant 消息带 id 时按 id upsert(流式增量替换),否则追加
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (!t) return
        if (msg.role === 'assistant' && msg.id) {
          const idx = t.messages.findIndex(
            (m) => m.role === 'assistant' && m.id === msg.id,
          )
          if (idx >= 0) t.messages[idx] = msg
          else t.messages.push(msg)
        } else {
          t.messages.push(msg)
        }
        if (msg.role === 'system') {
          if (msg.kind === 'init' && msg.meta?.sessionId) t.sessionId = String(msg.meta.sessionId)
          else if (msg.kind === 'result') {
            t.status = msg.meta?.isError ? 'error' : 'idle'
            t.updatedAt = Date.now()
          } else if (msg.kind === 'error') {
            t.status = 'error'
            t.updatedAt = Date.now()
          }
        } else if (msg.role === 'assistant' && !msg.partial) {
          t.updatedAt = Date.now()
        }
      })
      // partial 流式增量不落盘;system 或权威 assistant 才落盘
      if (msg.role === 'system' || (msg.role === 'assistant' && !msg.partial)) {
        schedulePersist()
      }
    },

    markStopped: (taskId) => {
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (t) {
          t.status = 'stopped'
          t.updatedAt = Date.now()
        }
      })
      schedulePersist()
    },

    setActiveTask: (taskId) => set({ activeTaskId: taskId }),

    deleteTask: (taskId) => {
      set((s) => {
        s.tasks = s.tasks.filter((t) => t.taskId !== taskId)
        if (s.activeTaskId === taskId) {
          s.activeTaskId = s.tasks[0]?.taskId ?? null
        }
      })
      schedulePersist()
    },

    hydrate: async () => {
      if (get().hydrated) return
      try {
        const raw = await fs.readFile(SESSIONS_FILE)
        const tasks = JSON.parse(raw) as AgentTask[]
        // 流不可能跨重启续:残留 running 规整为 stopped
        for (const t of tasks) {
          if (t.status === 'running') t.status = 'stopped'
        }
        // 默认激活最近更新的会话
        const sorted = [...tasks].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        set((s) => {
          s.tasks = tasks
          s.activeTaskId = sorted[0]?.taskId ?? null
          s.hydrated = true
        })
      } catch {
        set((s) => { s.hydrated = true })
      }
    },

    reset: () => {
      if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      set({ tasks: [], activeTaskId: null, hydrated: false })
    },
  }))
)
