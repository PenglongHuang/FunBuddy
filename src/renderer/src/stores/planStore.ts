import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { fs, imageApi } from '@/lib/ipc'
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
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './shared/markdown-file-lifecycle'
import { markdownDocumentParts } from './shared/markdown-document-store'

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

const parts = markdownDocumentParts<Plan, PlanStore>({
  dirName: 'plans',
  prefsKey: 'planPrefs',
  domainLabel: '计划',
  names: { list: 'plans', activeId: 'activePlanId' },
  lifecycle: { appendIndexRecord, deleteMarkdownDocument, moveMarkdownDocument },
  createEntity: (id, title: string, startDate: string, endDate: string | null, planType?: PlanType, content = '') => {
    const resolvedType = planType || detectType(startDate, endDate)
    const now = new Date().toISOString()
    return {
      entity: {
        id,
        title,
        startDate,
        endDate,
        filePath: buildFilePath(id, titleToSlug(title), startDate, resolvedType, endDate),
        color: COLOR_MAP[resolvedType],
        planType: resolvedType,
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
      content: content || `# ${title}\n\n`,
    }
  },
  normalize: (plan) => ({
    ...plan,
    planType: plan.planType ?? detectType(plan.startDate, plan.endDate),
  }),
})

export const usePlanStore = create<PlanStore>()(
  immer((set, get) => {
    const a = parts.actions(set, get)
    const applyTab = parts.applyTab(set, get)
    const writeIndex = parts.writeIndex
    return {
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

      load: a.load,
      createPlan: a.create,
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
        await writeIndex(get)
      },
      deletePlan: a.deleteOne,
      deletePlans: a.deleteMany,
      savePlanContent: a.saveContent,
      loadPlanContent: a.loadContent,
      setActivePlan: a.setActive,
      getPlansForDate: (date) => {
        return get().plans.filter((p) => {
          const start = new Date(p.startDate).getTime()
          const end = p.endDate ? new Date(p.endDate).getTime() : start
          const d = new Date(date).getTime()
          return d >= start && d <= end
        })
      },
      updatePlanTags: a.updateTags,
      renameTag: a.renameTag,
      deleteTag: a.deleteTag,
      duplicatePlan: async (id) => {
        const plan = get().plans.find((p) => p.id === id)
        if (!plan) throw new Error(`Plan ${id} not found`)
        const content = await get().loadPlanContent(id)
        return get().createPlan('复制 ' + plan.title, plan.startDate, plan.endDate, plan.planType, content)
      },
      setSortBy: a.setSortBy,
      setViewMode: a.setViewMode,
      setEditorMode: a.setEditorMode,
      setPlannerView: (view) => { set({ plannerView: view }) },

      openTab: (id) => {
        const plan = get().plans.find((p) => p.id === id)
        if (!plan) return
        applyTab((snap) => reduceOpenTab(
          snap,
          { id, title: plan.title, pinned: false },
          useSettingsStore.getState().app.maxTabsPerPanel || 20,
        ))
      },
      closeTab: (id) => applyTab((snap) => reduceCloseTab(snap, id)),
      switchTab: (id) => applyTab((snap) => reduceSwitchTab(snap, id)),
      deactivateTab: () => applyTab((snap) => deactivateTabs(snap)),
      pinTab: (id) => applyTab((snap) => togglePinned(snap, id)),
      reorderTabs: (fromIdx, toIdx) => applyTab((snap) => reduceReorderTabs(snap, fromIdx, toIdx)),
      closeOtherTabs: (id) => applyTab((snap) => reduceCloseOtherTabs(snap, id)),
      closeUnpinnedTabs: () => applyTab((snap) => reduceCloseUnpinnedTabs(snap)),
    }
  }),
)
