import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { fs, store, imageApi } from '@/lib/ipc'
import { titleToSlug } from '@/utils/slug'
import type { Plan, PlanType } from '@/types/plan'
import type { Tab } from '@/types/tab'
import { useSettingsStore } from './settingsStore'
import {
  closeOtherTabs as reduceCloseOtherTabs,
  closeTab as reduceCloseTab,
  closeUnpinnedTabs as reduceCloseUnpinnedTabs,
  deactivateTabs,
  openTab as reduceOpenTab,
  reorderTabs as reduceReorderTabs,
  switchTab as reduceSwitchTab,
  togglePinned,
} from './shared/tab-state'
import {
  appendIndexRecord,
  assertIndexWritable,
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './shared/markdown-file-lifecycle'

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
  /** 索引读取/解析失败（非首次启动的 ENOENT）时为 true，UI 据此提示写入已锁定 */
  loadFailed: boolean
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
    loadFailed: false,
    activePlanId: null,
    tabs: [],
    activeTabId: null,
    sortBy: 'time',
    viewMode: 'card',
    editorMode: 'edit' as const,
    plannerView: 'list',

    load: async () => {
      let raw: string
      try {
        raw = await fs.readFile('plans/index.json')
      } catch (err) {
        // 首次启动索引不存在：空列表是正常初始态；其余读取失败保持未加载并锁定索引写入
        if (String((err as Error)?.message ?? err).includes('ENOENT')) {
          set({ plans: [], loaded: true, loadFailed: false })
        } else {
          set({ plans: [], loaded: false, loadFailed: true })
        }
        return
      }
      let plans: Plan[]
      try {
        plans = JSON.parse(raw.replace(/^\uFEFF/, ''))
      } catch {
        // 索引损坏：不得以空列表覆写，保持未加载
        set({ plans: [], loaded: false, loadFailed: true })
        return
      }
      try {
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
        set({ plans: validPlans, loaded: true, loadFailed: false })
      } catch {
        // 解析成功后的修剪重写/偏好读取失败：同样视为未完成加载，锁定写入
        set({ plans: [], loaded: false, loadFailed: true })
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
      await appendIndexRecord<Plan>(fs, 'plans/index.json', plan)
      set((s) => { s.plans.push(plan) })
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
        await moveMarkdownDocument(fs, imageApi, plan.filePath, newFilePath)
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
      assertIndexWritable(get().loaded, '计划')
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },

    deletePlan: async (id) => {
      const plan = get().plans.find((p) => p.id === id)
      if (plan) {
        await deleteMarkdownDocument(fs, imageApi, plan.filePath)
      }
      set((s) => { s.plans = s.plans.filter((p) => p.id !== id) })
      assertIndexWritable(get().loaded, '计划')
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
      get().closeTab(id)
    },

    deletePlans: async (ids) => {
      const idSet = new Set(ids)
      const plans = get().plans
      for (const plan of plans) {
        if (idSet.has(plan.id)) {
          await deleteMarkdownDocument(fs, imageApi, plan.filePath)
        }
      }
      set((s) => { s.plans = s.plans.filter((p) => !idSet.has(p.id)) })
      assertIndexWritable(get().loaded, '计划')
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
      assertIndexWritable(get().loaded, '计划')
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
      assertIndexWritable(get().loaded, '计划')
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
      assertIndexWritable(get().loaded, '计划')
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
      const plan = get().plans.find((p) => p.id === id)
      if (!plan) return
      const result = reduceOpenTab(
        { tabs: get().tabs, activeTabId: get().activeTabId },
        { id, title: plan.title, pinned: false },
        useSettingsStore.getState().app.maxTabsPerPanel || 20,
      )
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    closeTab: (id) => {
      const current = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = reduceCloseTab(current, id)
      if (result === current) return
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    switchTab: (id) => {
      const current = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = reduceSwitchTab(current, id)
      if (result === current) return
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    deactivateTab: () => {
      const result = deactivateTabs({ tabs: get().tabs, activeTabId: get().activeTabId })
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    pinTab: (id) => {
      const result = togglePinned({ tabs: get().tabs, activeTabId: get().activeTabId }, id)
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    reorderTabs: (fromIdx, toIdx) => {
      const result = reduceReorderTabs(
        { tabs: get().tabs, activeTabId: get().activeTabId },
        fromIdx,
        toIdx,
      )
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    closeOtherTabs: (id) => {
      const current = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = reduceCloseOtherTabs(current, id)
      if (result === current) return
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },

    closeUnpinnedTabs: () => {
      const result = reduceCloseUnpinnedTabs({ tabs: get().tabs, activeTabId: get().activeTabId })
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activePlanId: result.activeTabId })
      persistPlanPrefs(get)
    },
  })),
)
