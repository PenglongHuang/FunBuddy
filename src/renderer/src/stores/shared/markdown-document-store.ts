import { nanoid } from 'nanoid'
import type { WritableDraft } from 'immer'
import { fs, store, imageApi } from '@/lib/ipc'
import { titleToSlug } from '@/utils/slug'
import type { Tab } from '@/types/tab'
import { assertIndexWritable } from './markdown-file-lifecycle'
import type {
  appendIndexRecord,
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './markdown-file-lifecycle'
import type { TabSnapshot } from './tab-state'

/** Markdown 文档型实体的最小公共形状（Note/Plan 均满足） */
export interface MarkdownDocumentMeta {
  id: string
  title: string
  filePath: string
  tags?: string[]
  updatedAt: string
}

/** 工厂依赖的领域 store 公共字段（含工厂内部需要回调的 closeTab） */
export interface DocumentStateShell {
  loaded: boolean
  loadFailed: boolean
  tabs: Tab[]
  activeTabId: string | null
  sortBy: string
  viewMode: 'card' | 'compact'
  editorMode: 'live' | 'edit' | 'preview'
  closeTab: (id: string) => void
}

/** 领域字段名：实体列表与活动 id 在领域 store 上的键名 */
export interface DocumentFieldNames<S> {
  list: keyof S & string
  activeId: keyof S & string
}

/**
 * 生命周期助手经 config 注入而非工厂自行 import：
 * markdown-file-store-integration.test.ts 以源码文本断言 noteStore/planStore
 * 保留对 shared helpers 的显式委托，注入让该依赖边留在领域 store 文件中。
 */
export interface DocumentLifecycle {
  appendIndexRecord: typeof appendIndexRecord
  deleteMarkdownDocument: typeof deleteMarkdownDocument
  moveMarkdownDocument: typeof moveMarkdownDocument
}

export interface DocumentActions<T extends MarkdownDocumentMeta> {
  load: () => Promise<void>
  create: (...args: any[]) => Promise<T>
  deleteOne: (id: string) => Promise<void>
  deleteMany: (ids: string[]) => Promise<void>
  saveContent: (id: string, content: string) => Promise<void>
  loadContent: (id: string) => Promise<string>
  updateTags: (id: string, tags: string[]) => Promise<void>
  /** 仅当 config.rename 提供时存在 */
  updateTitle?: (id: string, title: string) => Promise<void>
  renameTag: (oldName: string, newName: string) => Promise<void>
  deleteTag: (tagName: string) => Promise<void>
  setActive: (id: string | null) => void
  setSortBy: (sort: string) => void
  setViewMode: (mode: 'card' | 'compact') => void
  setEditorMode: (mode: 'live' | 'edit' | 'preview') => void
}

export interface MarkdownDocumentPartsConfig<T extends MarkdownDocumentMeta, S extends DocumentStateShell> {
  /** 文档目录名，索引路径为 `${dirName}/index.json` */
  dirName: string
  prefsKey: string
  /** 索引写入被拒时的错误提示用语，如「笔记」「计划」 */
  domainLabel: string
  names: DocumentFieldNames<S>
  lifecycle: DocumentLifecycle
  /** 由领域参数构造新实体及其初始文件内容（id 由工厂生成） */
  createEntity: (id: string, ...args: any[]) => { entity: T; content: string }
  /** 载入索引时逐条归一化（如 Plan 的 planType 推断） */
  normalize?: (entity: T) => T
  /** 提供后附带 updateTitle（改名 → slug → 移动文件 → 更新索引） */
  rename?: { buildFilePath: (id: string, slug: string) => string }
}

export type DocumentSet<S> = (
  partial: Partial<S> | ((state: WritableDraft<S>) => void),
) => void

export interface MarkdownDocumentParts<T extends MarkdownDocumentMeta, S extends DocumentStateShell> {
  actions: (set: DocumentSet<S>, get: () => S) => DocumentActions<T>
  /** Tab 动作公共管道：快照 → reducer → 写回 tabs/activeTabId/activeId → 持久化偏好 */
  applyTab: (
    set: DocumentSet<S>,
    get: () => S,
  ) => (run: (snapshot: TabSnapshot) => TabSnapshot) => void
  /** 断言可写并覆写索引（供领域特有动作复用） */
  writeIndex: (get: () => S) => Promise<void>
}

export function markdownDocumentParts<T extends MarkdownDocumentMeta, S extends DocumentStateShell>(
  config: MarkdownDocumentPartsConfig<T, S>,
): MarkdownDocumentParts<T, S> {
  const indexPath = `${config.dirName}/index.json`
  const { list: listKey, activeId: activeIdKey } = config.names

  // 键名来自 config（运行时值），TS 无法建立 S[list]: T[] 的依赖类型，在此单点收窄
  const listOf = (s: S | WritableDraft<S>): T[] =>
    (s as unknown as Record<string, T[]>)[listKey]

  // 动态键拼装无法向编译器证明匹配 Partial<S>，仅此一处放宽
  const patch = (fields: Record<string, unknown>): Partial<S> =>
    fields as unknown as Partial<S>

  const writeIndex = async (get: () => S) => {
    assertIndexWritable(get().loaded, config.domainLabel)
    await fs.writeFile(indexPath, JSON.stringify(listOf(get()), null, 2))
  }

  const persistPrefs = (get: () => S) => {
    store.set(config.prefsKey, {
      sortBy: get().sortBy,
      viewMode: get().viewMode,
      editorMode: get().editorMode,
      tabs: get().tabs,
      activeTabId: get().activeTabId,
    })
  }

  const applyTab =
    (set: DocumentSet<S>, get: () => S) =>
    (run: (snapshot: TabSnapshot) => TabSnapshot) => {
      const snapshot: TabSnapshot = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = run(snapshot)
      // reducer 约定无变化时原样返回引用，借此免触发 set 与偏好写入
      if (result === snapshot) return
      set(patch({
        tabs: result.tabs,
        activeTabId: result.activeTabId,
        [activeIdKey]: result.activeTabId,
      }))
      persistPrefs(get)
    }

  const actions = (set: DocumentSet<S>, get: () => S): DocumentActions<T> => {
    const load = async () => {
      let raw: string
      try {
        raw = await fs.readFile(indexPath)
      } catch (err) {
        // 首次启动索引不存在：空列表是正常初始态；其余读取失败保持未加载并锁定索引写入
        if (String((err as Error)?.message ?? err).includes('ENOENT')) {
          set(patch({ [listKey]: [], loaded: true, loadFailed: false }))
        } else {
          set(patch({ [listKey]: [], loaded: false, loadFailed: true }))
        }
        return
      }
      let entities: T[]
      try {
        entities = JSON.parse(raw.replace(/^\uFEFF/, ''))
      } catch {
        // 索引损坏：不得以空列表覆写，保持未加载
        set(patch({ [listKey]: [], loaded: false, loadFailed: true }))
        return
      }
      try {
        const valid: T[] = []
        for (const entity of entities) {
          const normalized = config.normalize ? config.normalize(entity) : entity
          // exists 无法判定（IPC 层异常）时保守保留记录：修剪只应删「确认不存在」的，
          // 假阴性会连带触发下方「全部查无文件」分支，把完好记录清出索引。
          const exists = await fs.exists(normalized.filePath).catch(() => true)
          if (exists) valid.push({ ...normalized, tags: normalized.tags ?? [] })
        }
        if (valid.length === 0 && entities.length > 0) {
          // 索引有记录但全部「查无文件」：大概率是 exists 假阴性（EACCES/网络盘/AV 锁）
          // 或异常状态。拒绝修剪到空覆写索引——否则后续 create 会向空索引追加，
          // 原始记录被永久覆盖。保持未加载并锁定写入，让失败横幅接管。
          set(patch({ [listKey]: [], loaded: false, loadFailed: true }))
          return
        }
        if (0 < valid.length && valid.length < entities.length) {
          await fs.writeFile(indexPath, JSON.stringify(valid, null, 2))
        }
        const prefs = await store.get<{
          sortBy: string
          viewMode: string
          editorMode?: string
          tabs?: { id: string; title: string; pinned: boolean }[]
          activeTabId?: string | null
        }>(config.prefsKey)
        if (prefs) {
          const validTabs = (prefs.tabs ?? []).filter((t) =>
            valid.some((d) => d.id === t.id),
          )
          const refreshedTabs = validTabs.map((t) => {
            const doc = valid.find((d) => d.id === t.id)
            return { ...t, title: doc?.title ?? t.title }
          })
          const validActiveTabId = refreshedTabs.some((t) => t.id === prefs.activeTabId)
            ? prefs.activeTabId ?? null
            : (refreshedTabs[0]?.id ?? null)
          set(patch({
            sortBy: prefs.sortBy ?? 'time',
            viewMode: prefs.viewMode ?? 'card',
            editorMode: prefs.editorMode ?? 'edit',
            tabs: refreshedTabs,
            activeTabId: validActiveTabId,
            [activeIdKey]: validActiveTabId,
          }))
        }
        set(patch({ [listKey]: valid, loaded: true, loadFailed: false }))
      } catch {
        // 解析成功后的修剪重写/偏好读取失败：同样视为未完成加载，锁定写入
        set(patch({ [listKey]: [], loaded: false, loadFailed: true }))
      }
    }

    const create = async (...args: any[]) => {
      const id = nanoid(8)
      const { entity, content } = config.createEntity(id, ...args)
      await fs.writeFile(entity.filePath, content)
      await config.lifecycle.appendIndexRecord(fs, indexPath, entity)
      set((s) => { listOf(s).push(entity) })
      return entity
    }

    const deleteOne = async (id: string) => {
      const doc = listOf(get()).find((d) => d.id === id)
      if (doc) {
        await config.lifecycle.deleteMarkdownDocument(fs, imageApi, doc.filePath)
      }
      set(patch({ [listKey]: listOf(get()).filter((d) => d.id !== id) }))
      await writeIndex(get)
      get().closeTab(id)
    }

    const deleteMany = async (ids: string[]) => {
      const idSet = new Set(ids)
      const docs = listOf(get())
      for (const doc of docs) {
        if (idSet.has(doc.id)) {
          await config.lifecycle.deleteMarkdownDocument(fs, imageApi, doc.filePath)
        }
      }
      set(patch({ [listKey]: docs.filter((d) => !idSet.has(d.id)) }))
      await writeIndex(get)
      for (const id of ids) { get().closeTab(id) }
    }

    const saveContent = async (id: string, content: string) => {
      const doc = listOf(get()).find((d) => d.id === id)
      if (!doc) return
      await fs.writeFile(doc.filePath, content)
    }

    const loadContent = async (id: string) => {
      const doc = listOf(get()).find((d) => d.id === id)
      if (!doc) return ''
      return fs.readFile(doc.filePath)
    }

    const updateTags = async (id: string, tags: string[]) => {
      set((s) => {
        const doc = listOf(s).find((d) => d.id === id)
        if (!doc) return
        doc.tags = tags
        doc.updatedAt = new Date().toISOString()
      })
      await writeIndex(get)
    }

    const renameTag = async (oldName: string, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed) return
      set((s) => {
        for (const doc of listOf(s)) {
          if (doc.tags) {
            doc.tags = doc.tags.map((t) => (t === oldName ? trimmed : t))
            doc.updatedAt = new Date().toISOString()
          }
        }
      })
      await writeIndex(get)
    }

    const deleteTag = async (tagName: string) => {
      set((s) => {
        for (const doc of listOf(s)) {
          if (doc.tags) {
            doc.tags = doc.tags.filter((t) => t !== tagName)
            doc.updatedAt = new Date().toISOString()
          }
        }
      })
      await writeIndex(get)
    }

    const setActive = (id: string | null) => {
      set(patch({ [activeIdKey]: id }))
    }

    const setSortBy = (sort: string) => {
      set(patch({ sortBy: sort }))
      persistPrefs(get)
    }

    const setViewMode = (mode: 'card' | 'compact') => {
      set(patch({ viewMode: mode }))
      persistPrefs(get)
    }

    const setEditorMode = (mode: 'live' | 'edit' | 'preview') => {
      set(patch({ editorMode: mode }))
      persistPrefs(get)
    }

    const base: DocumentActions<T> = {
      load,
      create,
      deleteOne,
      deleteMany,
      saveContent,
      loadContent,
      updateTags,
      renameTag,
      deleteTag,
      setActive,
      setSortBy,
      setViewMode,
      setEditorMode,
    }

    if (config.rename) {
      const { buildFilePath } = config.rename
      base.updateTitle = async (id: string, title: string) => {
        const doc = listOf(get()).find((d) => d.id === id)
        if (!doc) return
        const newFilePath = buildFilePath(id, titleToSlug(title))
        if (newFilePath !== doc.filePath) {
          await config.lifecycle.moveMarkdownDocument(fs, imageApi, doc.filePath, newFilePath)
        }
        set((s) => {
          const d = listOf(s).find((x) => x.id === id)
          if (!d) return
          d.title = title
          d.filePath = newFilePath
          d.updatedAt = new Date().toISOString()
          const tab = s.tabs.find((t) => t.id === id)
          if (tab) tab.title = title
        })
        await writeIndex(get)
      }
    }

    return base
  }

  return { actions, applyTab, writeIndex }
}
