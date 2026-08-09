import { useCallback, useMemo } from 'react'
import { MarkdownDocumentEditor } from '@/components/common/document-editor'
import { getAllTags } from '@/lib/tag-utils'
import { useNavigationStore } from '@/stores/navigationStore'
import { usePlanStore } from '@/stores/planStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface PlanEditorProps {
  planId: string
}

export default function PlanEditor({ planId }: PlanEditorProps) {
  const plan = usePlanStore((state) => state.plans.find((item) => item.id === planId))
  const plans = usePlanStore((state) => state.plans)
  const mode = usePlanStore((state) => state.editorMode)
  const tocMaxLevel = useSettingsStore((state) => state.app.tocMaxLevel)
  const navPush = useNavigationStore((state) => state.push)
  const allTags = useMemo(() => getAllTags(plans), [plans])

  const loadContent = useCallback(() => usePlanStore.getState().loadPlanContent(planId), [planId])
  const saveContent = useCallback((content: string) => usePlanStore.getState().savePlanContent(planId, content), [planId])
  const updateTitle = useCallback((title: string) => usePlanStore.getState().updatePlan(planId, { title }), [planId])
  const updateTags = useCallback((tags: string[]) => usePlanStore.getState().updatePlanTags(planId, tags), [planId])

  if (!plan) return null

  return (
    <MarkdownDocumentEditor
      key={plan.id}
      document={{ ...plan, tags: plan.tags ?? [] }}
      allTags={allTags}
      mode={mode}
      onModeChange={(nextMode) => usePlanStore.getState().setEditorMode(nextMode)}
      tocMaxLevel={tocMaxLevel}
      placeholder={'# 计划内容\n\n- [ ] 待办项 1\n- [ ] 待办项 2'}
      loadContent={loadContent}
      saveContent={saveContent}
      updateTitle={updateTitle}
      updateTags={updateTags}
      exportMeta={{
        tags: plan.tags,
        createdAt: plan.createdAt?.slice(0, 10),
        planType: plan.planType,
        startDate: plan.startDate,
        endDate: plan.endDate,
      }}
      onBack={() => {
        usePlanStore.getState().deactivateTab()
        navPush({ panel: 'planner', subView: 'list' })
      }}
      onLinkClick={(id, type) => {
        if (type === 'note') navPush({ panel: 'notes', subView: 'editor', noteId: id })
        if (type === 'plan') navPush({ panel: 'planner', subView: 'editor', planId: id })
      }}
    />
  )
}
