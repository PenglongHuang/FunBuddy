import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { fs, store, imageApi } from '@/lib/ipc'
import { titleToSlug } from '@/utils/slug'
import type { Plan, PlanType } from '@/types/plan'
import type { Tab } from '@/types/tab'
import { useSettingsStore } from './settingsStore'

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

function persistPlanPrefs(get: () => PlanStore) {
  store.set('planPrefs', {
    sortBy: get().sortBy,
    viewMode: get().viewMode,
    editorMode: get().editorMode,
    tabs: get().tabs,
    activeTabId: get().activeTabId,
  })
}

interface PlanStore {
  plans: Plan[]
  loaded: boolean
  activePlanId: string | null
  tabs: Tab[]
  activeTabId: string | null
  sortBy: 'time' | 'name' | 'planDate'
  viewMode: 'card' | 'compact'
  plannerView: 'list' | 'calendar'
  editorMode: 'live' | 'edit' | 'preview'
  setEditorMode: (mode: 'live' | 'edit' | 'preview') => void
  setPlannerView: (view: 'list' | 'calendar') => void
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
  duplicatePlan: (id: string) => Promise<Plan>
  setSortBy: (sort: 'time' | 'name' | 'planDate') => void
  setViewMode: (mode: 'card' | 'compact') => void
  openTab: (id: string) => void
  closeTab: (id: string) => void
  switchTab: (id: string) => void
  deactivateTab: () => void
  pinTab: (id: string) => void
  reorderTabs: (fromIdx: number, toIdx: number) => void
  closeOtherTabs: (id: string) => void
  closeUnpinnedTabs: () => void
}

export const usePlanStore = create<PlanStore>()(
  immer((set, get) => ({
    plans: [],
    loaded: false,
    activePlanId: null,
    tabs: [],
    activeTabId: null,
    sortBy: 'time',
    viewMode: 'card',
    editorMode: 'edit' as const,
    plannerView: 'list',

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
        const prefs = await store.get<{
          sortBy: string
          viewMode: string
          editorMode?: string
          tabs?: { id: string; title: string; pinned: boolean }[]
          activeTabId?: string | null
        }>('planPrefs')
        if (prefs) {
          const validTabs = (prefs.tabs ?? []).filter((t) =>
            validPlans.some((p) => p.id === t.id)
          )
          const refreshedTabs = validTabs.map((t) => {
            const plan = validPlans.find((p) => p.id === t.id)
            return { ...t, title: plan?.title ?? t.title }
          })
          const validActiveTabId = refreshedTabs.some((t) => t.id === prefs.activeTabId)
            ? prefs.activeTabId ?? null
            : (refreshedTabs[0]?.id ?? null)
          set({
            sortBy: (prefs.sortBy as any) ?? 'time',
            viewMode: (prefs.viewMode as any) ?? 'card',
            editorMode: (prefs.editorMode as 'live' | 'edit' | 'preview') ?? 'edit',
            tabs: refreshedTabs,
            activeTabId: validActiveTabId,
            activePlanId: validActiveTabId,
          })
        }
        set({ plans: validPlans, loaded: true })
      } catch {
        set({ plans: [], loaded: true })
      }
    },

    createPlan: async (title, startDate, endDate, planType, content = '') => {
      const id = nanoid(8)
      const slug = titleToSlug(title)
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
      const newTitle = updates.title ?? plan.title
      const slug = titleToSlug(newTitle)
      const newFilePath = buildFilePath(plan.id, slug, newStart, newType, newEnd)

      // Move file if path changed
      if (newFilePath !== plan.filePath) {
        const content = await fs.readFile(plan.filePath)
        await fs.writeFile(newFilePath, content)
        try { await fs.deleteFile(plan.filePath) } catch { /* ignore */ }
        try { await imageApi.moveAssets(plan.filePath, newFilePath) } catch {}
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
        if (updates.title !== undefined) {
          const tab = s.tabs.find((t) => t.id === id)
          if (tab) tab.title = updates.title
        }
      })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    deletePlan: async (id) => {
      const plan = get().plans.find((p) => p.id === id)
      if (plan) {
        try { await imageApi.cleanup(plan.filePath) } catch {}
        try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
      }
      set((s) => { s.plans = s.plans.filter((p) => p.id !== id) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
      get().closeTab(id)
    },

    deletePlans: async (ids) => {
      const idSet = new Set(ids)
      const plans = get().plans
      for (const plan of plans) {
        if (idSet.has(plan.id)) {
          try { await imageApi.cleanup(plan.filePath) } catch {}
          try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
        }
      }
      set((s) => { s.plans = s.plans.filter((p) => !idSet.has(p.id)) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
      for (const id of ids) { get().closeTab(id) }
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

    duplicatePlan: async (id) => {
      const plan = get().plans.find((p) => p.id === id)
      if (!plan) throw new Error(`Plan ${id} not found`)
      const content = await get().loadPlanContent(id)
      return get().createPlan('复制 ' + plan.title, plan.startDate, plan.endDate, plan.planType, content)
    },

    setSortBy: (sort) => {
      set({ sortBy: sort })
      persistPlanPrefs(get)
    },

    setViewMode: (mode) => {
      set({ viewMode: mode })
      persistPlanPrefs(get)
    },

    setEditorMode: (mode) => {
      set({ editorMode: mode })
      persistPlanPrefs(get)
    },

    setPlannerView: (view) => {
      set({ plannerView: view })
    },

    openTab: (id) => {
      const { tabs, plans, activeTabId } = get()
      const plan = plans.find((p) => p.id === id)
      if (!plan) return
      const existing = tabs.find((t) => t.id === id)
      if (existing) {
        set({ activeTabId: id, activePlanId: id })
      } else {
        const newTab: Tab = { id, title: plan.title, pinned: false }
        set((s) => {
          const maxTabs = useSettingsStore.getState().app.maxTabsPerPanel || 20
          if (s.tabs.length >= maxTabs) {
            let lastUnpinnedIdx = -1
            for (let i = s.tabs.length - 1; i >= 0; i--) {
              if (!s.tabs[i].pinned) { lastUnpinnedIdx = i; break }
            }
            if (lastUnpinnedIdx !== -1) {
              s.tabs.splice(lastUnpinnedIdx, 1)
            }
          }
          s.tabs.push(newTab)
          s.activeTabId = id
          s.activePlanId = id
        })
      }
      persistPlanPrefs(get)
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get()
      const idx = tabs.findIndex((t) => t.id === id)
      if (idx === -1) return
      const remaining = tabs.filter((t) => t.id !== id)
      let nextActiveId: string | null = null
      if (activeTabId === id) {
        if (remaining.length > 0) {
          const nextIdx = Math.min(idx, remaining.length - 1)
          nextActiveId = remaining[nextIdx].id
        }
      } else {
        nextActiveId = activeTabId
      }
      set({ tabs: remaining, activeTabId: nextActiveId, activePlanId: nextActiveId })
      persistPlanPrefs(get)
    },

    switchTab: (id) => {
      const { tabs } = get()
      if (!tabs.some((t) => t.id === id)) return
      set({ activeTabId: id, activePlanId: id })
      persistPlanPrefs(get)
    },

    deactivateTab: () => {
      set({ activeTabId: null, activePlanId: null })
      persistPlanPrefs(get)
    },

    pinTab: (id) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.id === id)
        if (!tab) return
        tab.pinned = !tab.pinned
        const pinned = s.tabs.filter((t) => t.pinned)
        const unpinned = s.tabs.filter((t) => !t.pinned)
        s.tabs = [...pinned, ...unpinned]
      })
      persistPlanPrefs(get)
    },

    reorderTabs: (fromIdx, toIdx) => {
      set((s) => {
        const [moved] = s.tabs.splice(fromIdx, 1)
        s.tabs.splice(toIdx, 0, moved)
        const pinned = s.tabs.filter((t) => t.pinned)
        const unpinned = s.tabs.filter((t) => !t.pinned)
        s.tabs = [...pinned, ...unpinned]
      })
      persistPlanPrefs(get)
    },

    closeOtherTabs: (id) => {
      const tab = get().tabs.find((t) => t.id === id)
      if (!tab) return
      set((s) => {
        s.tabs = s.tabs.filter((t) => t.id === id || t.pinned)
      })
      const newActive = get().tabs.find((t) => t.id === id) ? id : get().tabs[0]?.id ?? null
      set({ activeTabId: newActive, activePlanId: newActive })
      persistPlanPrefs(get)
    },

    closeUnpinnedTabs: () => {
      set((s) => {
        s.tabs = s.tabs.filter((t) => t.pinned)
      })
      const newActive = get().tabs[0]?.id ?? null
      set({ activeTabId: newActive, activePlanId: newActive })
      persistPlanPrefs(get)
    },
  })),
)
