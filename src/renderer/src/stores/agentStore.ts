import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { ai } from '@/lib/ipc'
import type { AgentMessage, AgentTask } from '../../../shared/agent-types'

interface AgentStore {
  tasks: AgentTask[]
  activeTaskId: string | null
  defaultWorkspace: string
  setDefaultWorkspace: (ws: string) => void
  createTask: (title: string, workspace: string) => string
  sendPrompt: (taskId: string, prompt: string) => void
  stopTask: (taskId: string) => void
  ingest: (taskId: string, msg: AgentMessage) => void
  markStopped: (taskId: string) => void
  setActiveTask: (taskId: string | null) => void
  reset: () => void
}

export const useAgentStore = create<AgentStore>()(
  immer((set, get) => ({
    tasks: [],
    activeTaskId: null,
    defaultWorkspace: '',

    setDefaultWorkspace: (ws) => set((s) => { s.defaultWorkspace = ws }),

    createTask: (title, workspace) => {
      const taskId = nanoid(8)
      const task: AgentTask = { taskId, title, workspace, status: 'running', messages: [] }
      set((s) => {
        s.tasks.push(task)
        s.activeTaskId = taskId
      })
      return taskId
    },

    sendPrompt: (taskId, prompt) => {
      const task = get().tasks.find((t) => t.taskId === taskId)
      if (!task) return
      set((s) => {
        const t = s.tasks.find((x) => x.taskId === taskId)
        if (t) {
          t.messages.push({ role: 'user', text: prompt })
          t.status = 'running'
        }
      })
      ai.startTask(taskId, prompt, task.workspace).catch(() => {
        get().ingest(taskId, { role: 'system', kind: 'error', meta: { error: 'startTask failed' } })
      })
    },

    stopTask: (taskId) => {
      ai.stopTask(taskId).catch(() => {})
      get().markStopped(taskId)
    },

    ingest: (taskId, msg) => set((s) => {
      const t = s.tasks.find((x) => x.taskId === taskId)
      if (!t) return
      t.messages.push(msg)
      if (msg.role === 'system') {
        if (msg.kind === 'init' && msg.meta?.sessionId) t.sessionId = String(msg.meta.sessionId)
        else if (msg.kind === 'result') t.status = msg.meta?.isError ? 'error' : 'idle'
        else if (msg.kind === 'error') t.status = 'error'
      }
    }),

    markStopped: (taskId) => set((s) => {
      const t = s.tasks.find((x) => x.taskId === taskId)
      if (t) t.status = 'stopped'
    }),

    setActiveTask: (taskId) => set({ activeTaskId: taskId }),

    reset: () => set({ tasks: [], activeTaskId: null }),
  }))
)
