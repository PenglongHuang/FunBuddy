import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { fs, store } from '@/lib/ipc'
import type { Plan, PlanType } from '@/types/plan'

const COLOR_MAP: Record<PlanType, string> = {
  daily: '#60a5fa',
  weekly: '#c084fc',
  monthly: '#fbbf24',
  neutral: '#94a3b8',
}

function detectType(start: string, end: string | null): PlanType {
  if (!end || start === end) return 'daily'
  const days = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  if (days >= 5 && days <= 9) return 'weekly'
  if (days >= 25 && days <= 35) return 'monthly'
  return 'neutral'
}

function planColor(start: string, end: string | null, planType?: PlanType): string {
  if (planType) return COLOR_MAP[planType]
  return COLOR_MAP[detectType(start, end)]
}

function buildFilePath(id: string, slug: string, startDate: string, planType: PlanType, endDate: string | null): string {
  const [year, month, day] = startDate.split('-')
  switch (planType) {
    case 'monthly':
      return `plans/${year}-${month}/${id}-${slug}.md`
    case 'weekly': {
      const endDay = endDate ? endDate.split('-')[2] : day
      return `plans/${year}-${month}/${day}-${endDay}/${id}-${slug}.md`
    }
    case 'daily':
    default:
      return `plans/${year}-${month}/${day}/${id}-${slug}.md`
  }
}

interface PlanStore {
  plans: Plan[]
  loaded: boolean
  activePlanId: string | null
  sortBy: 'time' | 'name' | 'planDate'
  viewMode: 'list' | 'card' | 'compact'
  load: () => Promise<void>
  createPlan: (title: string, startDate: string, endDate: string | null, planType?: PlanType, content?: string) => Promise<Plan>
  updatePlan: (id: string, updates: { title?: string; startDate?: string; endDate?: string | null; planType?: PlanType }) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  deletePlans: (ids: string[]) => Promise<void>
  savePlanContent: (id: string, content: string) => Promise<void>
  loadPlanContent: (id: string) => Promise<string>
  setActivePlan: (id: string | null) => void
  getPlansForDate: (date: string) => Plan[]
  updatePlanTags: (id: string, tags: string[]) => Promise<void>
  renameTag: (oldName: string, newName: string) => Promise<void>
  deleteTag: (tagName: string) => Promise<void>
  setSortBy: (sort: 'time' | 'name' | 'planDate') => void
  setViewMode: (mode: 'list' | 'card' | 'compact') => void
}

export const usePlanStore = create<PlanStore>()(
  immer((set, get) => ({
    plans: [],
    loaded: false,
    activePlanId: null,
    sortBy: 'time',
    viewMode: 'card',

    load: async () => {
      try {
        const raw = await fs.readFile('plans/index.json')
        const plans: Plan[] = JSON.parse(raw)
        const validPlans: Plan[] = []
        for (const plan of plans) {
          if (!plan.planType) {
            plan.planType = detectType(plan.startDate, plan.endDate)
          }
          const exists = await fs.exists(plan.filePath).catch(() => false)
          if (!plan.tags) plan.tags = []
          if (exists) validPlans.push(plan)
        }
        if (validPlans.length !== plans.length) {
          await fs.writeFile('plans/index.json', JSON.stringify(validPlans, null, 2))
        }
        const prefs = await store.get<{ sortBy: string; viewMode: string }>('planPrefs')
        if (prefs) {
          set({ sortBy: (prefs.sortBy as any) ?? 'time', viewMode: (prefs.viewMode as any) ?? 'card' })
        }
        set({ plans: validPlans, loaded: true })
      } catch {
        set({ plans: [], loaded: true })
      }
    },

    createPlan: async (title, startDate, endDate, planType, content = '') => {
      const id = nanoid(8)
      const slug = title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').slice(0, 20)
      const resolvedType = planType || detectType(startDate, endDate)
      const filePath = buildFilePath(id, slug, startDate, resolvedType, endDate)
      const color = COLOR_MAP[resolvedType]
      const now = new Date().toISOString()
      const plan: Plan = { id, title, startDate, endDate, filePath, color, planType: resolvedType, tags: [], createdAt: now, updatedAt: now }

      await fs.writeFile(filePath, content || `# ${title}\n\n`)
      set((s) => { s.plans.push(plan) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
      return plan
    },

    updatePlan: async (id, updates) => {
      const plan = get().plans.find((p) => p.id === id)
      if (!plan) return

      const newType = updates.planType ?? plan.planType
      const newStart = updates.startDate ?? plan.startDate
      const newEnd = updates.endDate !== undefined ? updates.endDate : plan.endDate
      const slug = plan.filePath.split('/').pop()!.replace(/^[^-]+-/, '').replace(/\.md$/, '')
      const newFilePath = buildFilePath(plan.id, slug, newStart, newType, newEnd)

      // Move file if path changed
      if (newFilePath !== plan.filePath) {
        const content = await fs.readFile(plan.filePath)
        await fs.writeFile(newFilePath, content)
        try { await fs.deleteFile(plan.filePath) } catch { /* ignore */ }
      }

      set((s) => {
        const p = s.plans.find((p) => p.id === id)
        if (!p) return
        if (updates.title !== undefined) p.title = updates.title
        if (updates.startDate !== undefined) p.startDate = updates.startDate
        if (updates.endDate !== undefined) p.endDate = updates.endDate
        if (updates.planType !== undefined) p.planType = updates.planType
        p.filePath = newFilePath
        p.color = COLOR_MAP[newType]
        p.updatedAt = new Date().toISOString()
      })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    deletePlan: async (id) => {
      const plan = get().plans.find((p) => p.id === id)
      if (plan) {
        try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
      }
      set((s) => { s.plans = s.plans.filter((p) => p.id !== id) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    deletePlans: async (ids) => {
      const idSet = new Set(ids)
      const plans = get().plans
      for (const plan of plans) {
        if (idSet.has(plan.id)) {
          try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
        }
      }
      set((s) => { s.plans = s.plans.filter((p) => !idSet.has(p.id)) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    savePlanContent: async (id, content) => {
      const plan = get().plans.find((p) => p.id === id)
      if (!plan) return
      await fs.writeFile(plan.filePath, content)
    },

    loadPlanContent: async (id) => {
      const plan = get().plans.find((p) => p.id === id)
      if (!plan) return ''
      return fs.readFile(plan.filePath)
    },

    setActivePlan: (id) => set({ activePlanId: id }),

    getPlansForDate: (date) => {
      return get().plans.filter((p) => {
        const start = new Date(p.startDate).getTime()
        const end = p.endDate ? new Date(p.endDate).getTime() : start
        const d = new Date(date).getTime()
        return d >= start && d <= end
      })
    },

    updatePlanTags: async (id, tags) => {
      set((s) => {
        const plan = s.plans.find((p) => p.id === id)
        if (!plan) return
        plan.tags = tags
        plan.updatedAt = new Date().toISOString()
      })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    renameTag: async (oldName, newName) => {
      const trimmed = newName.trim()
      if (!trimmed) return
      set((s) => {
        for (const plan of s.plans) {
          if (plan.tags) {
            plan.tags = plan.tags.map((t) => (t === oldName ? trimmed : t))
            plan.updatedAt = new Date().toISOString()
          }
        }
      })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    deleteTag: async (tagName) => {
      set((s) => {
        for (const plan of s.plans) {
          if (plan.tags) {
            plan.tags = plan.tags.filter((t) => t !== tagName)
            plan.updatedAt = new Date().toISOString()
          }
        }
      })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    setSortBy: (sort) => {
      set({ sortBy: sort })
      store.set('planPrefs', { sortBy: sort, viewMode: get().viewMode })
    },

    setViewMode: (mode) => {
      set({ viewMode: mode })
      store.set('planPrefs', { sortBy: get().sortBy, viewMode: mode })
    },
  })),
)
