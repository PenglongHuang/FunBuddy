import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { titleToSlug } from '@/utils/slug'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeOtherTabs as reduceCloseOtherTabs,
  closeTab as reduceCloseTab,
  closeUnpinnedTabs as reduceCloseUnpinnedTabs,
  deactivateTabs,
  openTab as reduceOpenTab,
  reorderTabs as reduceReorderTabs,
  switchTab as reduceSwitchTab,
  togglePinned,
} from './tab-state'
import {
  appendIndexRecord,
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './markdown-file-lifecycle'
import { markdownDocumentParts } from './markdown-document-store'
import type { MarkdownDocumentMeta } from './markdown-document-store'
import { usePlanStore } from '../planStore'

const fake = vi.hoisted(() => {
  const files = new Map<string, string>()
  return {
    files,
    failWritePath: null as string | null,
    fs: {
      readFile: vi.fn(async (path: string) => {
        const content = files.get(path)
        if (content === undefined) throw new Error(`missing: ${path}`)
        return content
      }),
      writeFile: vi.fn(async (path: string, content: string) => {
        if (path === fake.failWritePath) throw new Error(`write failed: ${path}`)
        files.set(path, content)
      }),
      deleteFile: vi.fn(async (path: string) => {
        files.delete(path)
      }),
      exists: vi.fn(async (path: string) => files.has(path)),
    },
    store: {
      get: vi.fn(async (): Promise<unknown> => undefined),
      set: vi.fn(async (_key: string, _value: unknown) => undefined),
    },
    imageApi: {
      cleanup: vi.fn(async () => undefined),
      moveAssets: vi.fn(async () => undefined),
    },
  }
})

vi.mock('@/lib/ipc', () => ({
  fs: fake.fs,
  store: fake.store,
  imageApi: fake.imageApi,
  autolaunch: {
    enable: vi.fn(async () => undefined),
    disable: vi.fn(async () => undefined),
  },
}))

interface TestDoc extends MarkdownDocumentMeta {
  createdAt: string
}

interface TestStore {
  docs: TestDoc[]
  loaded: boolean
  loadFailed: boolean
  activeId: string | null
  tabs: { id: string; title: string; pinned: boolean }[]
  activeTabId: string | null
  sortBy: 'time' | 'name'
  viewMode: 'card' | 'compact'
  editorMode: 'live' | 'edit' | 'preview'
  load: () => Promise<void>
  create: (title: string, content?: string) => Promise<TestDoc>
  remove: (id: string) => Promise<void>
  removeMany: (ids: string[]) => Promise<void>
  saveContent: (id: string, content: string) => Promise<void>
  loadContent: (id: string) => Promise<string>
  updateTags: (id: string, tags: string[]) => Promise<void>
  updateTitle: (id: string, title: string) => Promise<void>
  renameTag: (oldName: string, newName: string) => Promise<void>
  deleteTag: (tagName: string) => Promise<void>
  setActive: (id: string | null) => void
  setSortBy: (sort: 'time' | 'name') => void
  setViewMode: (mode: 'card' | 'compact') => void
  setEditorMode: (mode: 'live' | 'edit' | 'preview') => void
  openTab: (id: string) => void
  closeTab: (id: string) => void
  switchTab: (id: string) => void
  deactivateTab: () => void
  pinTab: (id: string) => void
  reorderTabs: (fromIdx: number, toIdx: number) => void
  closeOtherTabs: (id: string) => void
  closeUnpinnedTabs: () => void
}

const T0 = '2026-01-01T00:00:00.000Z'
const INDEX_PATH = 'docs/index.json'

const parts = markdownDocumentParts<TestDoc, TestStore>({
  dirName: 'docs',
  prefsKey: 'docPrefs',
  domainLabel: '文档',
  names: { list: 'docs', activeId: 'activeId' },
  lifecycle: { appendIndexRecord, deleteMarkdownDocument, moveMarkdownDocument },
  createEntity: (id, title: string, content = '') => ({
    entity: {
      id,
      title,
      filePath: `docs/${id}-${titleToSlug(title)}.md`,
      tags: [],
      createdAt: T0,
      updatedAt: T0,
    },
    content: content || `# ${title}\n\n`,
  }),
  rename: { buildFilePath: (id, slug) => `docs/${id}-${slug}.md` },
})

const useTestStore = create<TestStore>()(
  immer((set, get) => {
    const a = parts.actions(set, get)
    const applyTab = parts.applyTab(set, get)
    return {
      docs: [],
      loaded: false,
      loadFailed: false,
      activeId: null,
      tabs: [],
      activeTabId: null,
      sortBy: 'time',
      viewMode: 'card',
      editorMode: 'edit' as const,
      load: a.load,
      create: a.create,
      remove: a.deleteOne,
      removeMany: a.deleteMany,
      saveContent: a.saveContent,
      loadContent: a.loadContent,
      updateTags: a.updateTags,
      updateTitle: a.updateTitle!,
      renameTag: a.renameTag,
      deleteTag: a.deleteTag,
      setActive: a.setActive,
      setSortBy: a.setSortBy,
      setViewMode: a.setViewMode,
      setEditorMode: a.setEditorMode,
      openTab: (id) => {
        const doc = get().docs.find((d) => d.id === id)
        if (!doc) return
        applyTab((snap) => reduceOpenTab(snap, { id, title: doc.title, pinned: false }, 20))
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

function makeDoc(id: string, title: string): TestDoc {
  return {
    id,
    title,
    filePath: `docs/${id}-${titleToSlug(title)}.md`,
    tags: [],
    createdAt: T0,
    updatedAt: T0,
  }
}

function seedDocs(...docs: TestDoc[]) {
  for (const doc of docs) {
    fake.files.set(doc.filePath, `# ${doc.title}\n\n`)
  }
  fake.files.set(INDEX_PATH, JSON.stringify(docs))
}

function enoentError(path: string): Error {
  return new Error(`ENOENT: no such file or directory, open '${path}'`)
}

function eaccesError(path: string): Error {
  return new Error(`EACCES: permission denied, open '${path}'`)
}

beforeEach(() => {
  fake.files.clear()
  fake.failWritePath = null
  vi.clearAllMocks()
  useTestStore.setState({
    docs: [],
    tabs: [],
    activeId: null,
    activeTabId: null,
    loaded: false,
    loadFailed: false,
    sortBy: 'time',
    viewMode: 'card',
    editorMode: 'edit',
  })
})

describe('markdownDocumentParts.load 失败安全', () => {
  it('索引不存在(ENOENT) → 空列表且 loaded', async () => {
    fake.fs.readFile.mockRejectedValueOnce(enoentError(INDEX_PATH))
    await useTestStore.getState().load()
    expect(useTestStore.getState().docs).toEqual([])
    expect(useTestStore.getState().loaded).toBe(true)
    expect(useTestStore.getState().loadFailed).toBe(false)
  })

  it('读取失败(非 ENOENT) → 未加载，remove 拒绝写索引', async () => {
    fake.fs.readFile.mockRejectedValueOnce(eaccesError(INDEX_PATH))
    await useTestStore.getState().load()
    expect(useTestStore.getState().loaded).toBe(false)
    expect(useTestStore.getState().loadFailed).toBe(true)
    await expect(useTestStore.getState().remove('x')).rejects.toThrow()
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
  })

  it('索引损坏(非法 JSON) → 未加载，各写点均拒绝且不触达 writeFile', async () => {
    fake.files.set(INDEX_PATH, '{broken')
    await useTestStore.getState().load()
    expect(useTestStore.getState().loaded).toBe(false)
    expect(useTestStore.getState().loadFailed).toBe(true)
    const s = useTestStore.getState()
    await expect(s.removeMany(['x'])).rejects.toThrow()
    await expect(s.updateTags('x', [])).rejects.toThrow()
    await expect(s.renameTag('a', 'b')).rejects.toThrow()
    await expect(s.deleteTag('a')).rejects.toThrow()
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
  })

  it('BOM 开头的合法 JSON → 正常解析并修剪缺失文件', async () => {
    const keep = makeDoc('keep', 'Alpha')
    fake.files.set(keep.filePath, '# Alpha')
    const dropped = makeDoc('gone', 'Beta')
    fake.files.set(INDEX_PATH, String.fromCharCode(0xfeff) + JSON.stringify([keep, dropped]))
    await useTestStore.getState().load()
    expect(useTestStore.getState().loaded).toBe(true)
    expect(useTestStore.getState().docs).toEqual([keep])
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([keep])
  })

  it('exists 全部 reject（IPC 层异常）→ 保守保留全部记录，不修剪写盘，loaded 正常', async () => {
    const d1 = makeDoc('d1', 'Alpha')
    const d2 = makeDoc('d2', 'Beta')
    fake.files.set(d1.filePath, '# Alpha')
    fake.files.set(d2.filePath, '# Beta')
    fake.files.set(INDEX_PATH, JSON.stringify([d1, d2]))
    fake.fs.exists.mockRejectedValueOnce(new Error('ipc broken'))
    fake.fs.exists.mockRejectedValueOnce(new Error('ipc broken'))
    await useTestStore.getState().load()
    const s = useTestStore.getState()
    expect(s.docs).toEqual([d1, d2])
    expect(s.loaded).toBe(true)
    expect(s.loadFailed).toBe(false)
    expect(fake.files.get(INDEX_PATH)).toBe(JSON.stringify([d1, d2]))
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
  })

  it('索引有记录但全部「查无文件」→ 拒绝修剪到空：不写盘、loadFailed 锁定', async () => {
    const d1 = makeDoc('d1', 'Alpha')
    const d2 = makeDoc('d2', 'Beta')
    // 不写入任何 .md：exists 对两条记录均返回 false（模拟 EACCES 等假阴性）
    fake.files.set(INDEX_PATH, JSON.stringify([d1, d2]))
    await useTestStore.getState().load()
    const s = useTestStore.getState()
    expect(s.docs).toEqual([])
    expect(s.loaded).toBe(false)
    expect(s.loadFailed).toBe(true)
    expect(fake.files.get(INDEX_PATH)).toBe(JSON.stringify([d1, d2]))
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
  })

  it('3 条记录仅 1 条缺失 → 正常修剪为 2 条并写盘（守卫不扩大化）', async () => {
    const keep1 = makeDoc('d1', 'Alpha')
    const keep2 = makeDoc('d2', 'Beta')
    const gone = makeDoc('gone', 'Ghost')
    fake.files.set(keep1.filePath, '# Alpha')
    fake.files.set(keep2.filePath, '# Beta')
    fake.files.set(INDEX_PATH, JSON.stringify([keep1, keep2, gone]))
    await useTestStore.getState().load()
    const s = useTestStore.getState()
    expect(s.docs).toEqual([keep1, keep2])
    expect(s.loaded).toBe(true)
    expect(s.loadFailed).toBe(false)
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([keep1, keep2])
  })

  it('偏好恢复：过滤失效 tab、刷新标题、activeId 与 activeTabId 同步', async () => {
    const doc = { ...makeDoc('d1', '新标题'), tags: ['t'] }
    fake.files.set(doc.filePath, '# x')
    fake.files.set(INDEX_PATH, JSON.stringify([doc]))
    fake.store.get.mockResolvedValueOnce({
      sortBy: 'name',
      viewMode: 'compact',
      editorMode: 'preview',
      tabs: [
        { id: 'd1', title: '旧标题', pinned: false },
        { id: 'ghost', title: 'ghost', pinned: true },
      ],
      activeTabId: 'ghost',
    })
    await useTestStore.getState().load()
    const s = useTestStore.getState()
    expect(s.tabs).toEqual([{ id: 'd1', title: '新标题', pinned: false }])
    expect(s.activeTabId).toBe('d1')
    expect(s.activeId).toBe('d1')
    expect(s.sortBy).toBe('name')
    expect(s.viewMode).toBe('compact')
    expect(s.editorMode).toBe('preview')
    expect(s.docs).toEqual([doc])
  })
})

describe('markdownDocumentParts create/delete 守卫', () => {
  it('create 追加到磁盘最新索引并发布到内存', async () => {
    fake.files.set(INDEX_PATH, JSON.stringify([{ id: 'from-another-window' }]))
    const created = await useTestStore.getState().create('Alpha')
    expect(created.filePath).toBe(`docs/${created.id}-alpha.md`)
    expect(fake.files.get(created.filePath)).toBe('# Alpha\n\n')
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([
      { id: 'from-another-window' },
      created,
    ])
    expect(useTestStore.getState().docs).toEqual([created])
  })

  it('create 自定义内容写入文件', async () => {
    fake.files.set(INDEX_PATH, '[]')
    const created = await useTestStore.getState().create('Alpha', 'BODY')
    expect(fake.files.get(created.filePath)).toBe('BODY')
  })

  it('索引追加失败 → 不在内存发布新文档', async () => {
    fake.files.set(INDEX_PATH, '[]')
    fake.failWritePath = INDEX_PATH
    await expect(useTestStore.getState().create('Alpha')).rejects.toThrow(`write failed: ${INDEX_PATH}`)
    expect(useTestStore.getState().docs).toEqual([])
  })

  it('remove 删除文件、覆写索引并联动关闭 tab', async () => {
    const doc = makeDoc('d1', 'Alpha')
    seedDocs(doc)
    await useTestStore.getState().load()
    useTestStore.getState().openTab('d1')
    await useTestStore.getState().remove('d1')
    expect(fake.files.has(doc.filePath)).toBe(false)
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([])
    expect(useTestStore.getState().docs).toEqual([])
    expect(useTestStore.getState().tabs).toEqual([])
  })

  it('removeMany 批量删除', async () => {
    const d1 = makeDoc('d1', 'Alpha')
    const d2 = makeDoc('d2', 'Beta')
    seedDocs(d1, d2)
    await useTestStore.getState().load()
    await useTestStore.getState().removeMany(['d1', 'd2'])
    expect(useTestStore.getState().docs).toEqual([])
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([])
  })

  it('saveContent/loadContent 对缺失目标静默返回', async () => {
    const doc = makeDoc('d1', 'Alpha')
    seedDocs(doc)
    await useTestStore.getState().load()
    await useTestStore.getState().saveContent('ghost', 'x')
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
    await expect(useTestStore.getState().loadContent('ghost')).resolves.toBe('')
    await useTestStore.getState().saveContent('d1', 'NEW')
    expect(fake.files.get(doc.filePath)).toBe('NEW')
    await expect(useTestStore.getState().loadContent('d1')).resolves.toBe('NEW')
  })

  it('updateTags 更新标签与 updatedAt 并覆写索引', async () => {
    const doc = makeDoc('d1', 'Alpha')
    seedDocs(doc)
    await useTestStore.getState().load()
    await useTestStore.getState().updateTags('d1', ['a', 'b'])
    const updated = useTestStore.getState().docs[0]
    expect(updated.tags).toEqual(['a', 'b'])
    expect(updated.updatedAt).not.toBe(T0)
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([updated])
  })

  it('renameTag 空名直接返回不写盘；改名覆写索引', async () => {
    const doc = { ...makeDoc('d1', 'Alpha'), tags: ['old'] }
    seedDocs(doc)
    await useTestStore.getState().load()
    await useTestStore.getState().renameTag('old', '  ')
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
    await useTestStore.getState().renameTag('old', 'new')
    expect(useTestStore.getState().docs[0].tags).toEqual(['new'])
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([useTestStore.getState().docs[0]])
  })

  it('updateTitle 改名移动文件、更新 tab 标题并覆写索引', async () => {
    const doc = makeDoc('d1', 'Alpha')
    seedDocs(doc)
    await useTestStore.getState().load()
    useTestStore.getState().openTab('d1')
    await useTestStore.getState().updateTitle('d1', 'Gamma')
    const newPath = 'docs/d1-gamma.md'
    expect(fake.files.get(newPath)).toBe(`# ${doc.title}\n\n`)
    expect(fake.files.has(doc.filePath)).toBe(false)
    const updated = useTestStore.getState().docs[0]
    expect(updated.title).toBe('Gamma')
    expect(updated.filePath).toBe(newPath)
    expect(updated.updatedAt).not.toBe(T0)
    expect(useTestStore.getState().tabs[0].title).toBe('Gamma')
    expect(JSON.parse(fake.files.get(INDEX_PATH) ?? '[]')).toEqual([updated])
  })

  it('updateTitle 目标不存在 → 不动索引不写盘', async () => {
    const doc = makeDoc('d1', 'Alpha')
    seedDocs(doc)
    await useTestStore.getState().load()
    fake.fs.writeFile.mockClear()
    await useTestStore.getState().updateTitle('ghost', 'x')
    expect(fake.fs.writeFile).not.toHaveBeenCalled()
  })
})

describe('markdownDocumentParts tab 动作管道', () => {
  it('openTab 打开并激活，同步 activeId 且持久化偏好', async () => {
    const d1 = makeDoc('d1', 'Alpha')
    seedDocs(d1)
    await useTestStore.getState().load()
    fake.store.set.mockClear()
    useTestStore.getState().openTab('d1')
    expect(useTestStore.getState().tabs).toEqual([{ id: 'd1', title: 'Alpha', pinned: false }])
    expect(useTestStore.getState().activeTabId).toBe('d1')
    expect(useTestStore.getState().activeId).toBe('d1')
    expect(fake.store.set).toHaveBeenCalledWith('docPrefs', expect.objectContaining({
      tabs: [{ id: 'd1', title: 'Alpha', pinned: false }],
      activeTabId: 'd1',
      sortBy: 'time',
      viewMode: 'card',
      editorMode: 'edit',
    }))
  })

  it('openTab 缺失 id → 无动作不持久化', async () => {
    const d1 = makeDoc('d1', 'Alpha')
    seedDocs(d1)
    await useTestStore.getState().load()
    fake.store.set.mockClear()
    useTestStore.getState().openTab('ghost')
    expect(useTestStore.getState().tabs).toEqual([])
    expect(fake.store.set).not.toHaveBeenCalled()
  })

  it('closeTab 关闭活动 tab 时激活邻位', async () => {
    seedDocs(makeDoc('d1', 'Alpha'), makeDoc('d2', 'Beta'))
    await useTestStore.getState().load()
    useTestStore.getState().openTab('d1')
    useTestStore.getState().openTab('d2')
    useTestStore.getState().closeTab('d2')
    expect(useTestStore.getState().tabs.map((t) => t.id)).toEqual(['d1'])
    expect(useTestStore.getState().activeTabId).toBe('d1')
    expect(useTestStore.getState().activeId).toBe('d1')
  })

  it('pinTab 置顶、无此 tab 时为无操作', async () => {
    seedDocs(makeDoc('d1', 'Alpha'), makeDoc('d2', 'Beta'))
    await useTestStore.getState().load()
    useTestStore.getState().openTab('d1')
    useTestStore.getState().openTab('d2')
    useTestStore.getState().pinTab('d2')
    expect(useTestStore.getState().tabs.map((t) => t.id)).toEqual(['d2', 'd1'])
    fake.store.set.mockClear()
    useTestStore.getState().pinTab('ghost')
    expect(fake.store.set).not.toHaveBeenCalled()
  })

  it('reorderTabs 重排、deactivateTab 清空激活但保留 tab', async () => {
    seedDocs(makeDoc('d1', 'Alpha'), makeDoc('d2', 'Beta'), makeDoc('d3', 'Ceta'))
    await useTestStore.getState().load()
    useTestStore.getState().openTab('d1')
    useTestStore.getState().openTab('d2')
    useTestStore.getState().openTab('d3')
    useTestStore.getState().reorderTabs(2, 0)
    expect(useTestStore.getState().tabs.map((t) => t.id)).toEqual(['d3', 'd1', 'd2'])
    useTestStore.getState().deactivateTab()
    expect(useTestStore.getState().tabs.map((t) => t.id)).toEqual(['d3', 'd1', 'd2'])
    expect(useTestStore.getState().activeTabId).toBe(null)
    expect(useTestStore.getState().activeId).toBe(null)
  })

  it('closeOtherTabs 保留自身与置顶，closeUnpinnedTabs 仅剩置顶', async () => {
    seedDocs(makeDoc('d1', 'Alpha'), makeDoc('d2', 'Beta'), makeDoc('d3', 'Ceta'))
    await useTestStore.getState().load()
    useTestStore.getState().openTab('d1')
    useTestStore.getState().openTab('d2')
    useTestStore.getState().openTab('d3')
    useTestStore.getState().pinTab('d2')
    useTestStore.getState().closeOtherTabs('d3')
    expect(useTestStore.getState().tabs).toEqual([
      { id: 'd2', title: 'Beta', pinned: true },
      { id: 'd3', title: 'Ceta', pinned: false },
    ])
    expect(useTestStore.getState().activeTabId).toBe('d3')
    useTestStore.getState().closeUnpinnedTabs()
    expect(useTestStore.getState().tabs).toEqual([{ id: 'd2', title: 'Beta', pinned: true }])
    expect(useTestStore.getState().activeTabId).toBe('d2')
  })

  it('setSortBy/setViewMode/setEditorMode 更新字段并持久化', async () => {
    seedDocs(makeDoc('d1', 'Alpha'))
    await useTestStore.getState().load()
    fake.store.set.mockClear()
    useTestStore.getState().setSortBy('name')
    useTestStore.getState().setViewMode('compact')
    useTestStore.getState().setEditorMode('preview')
    expect(useTestStore.getState().sortBy).toBe('name')
    expect(useTestStore.getState().viewMode).toBe('compact')
    expect(useTestStore.getState().editorMode).toBe('preview')
    expect(fake.store.set).toHaveBeenLastCalledWith('docPrefs', expect.objectContaining({
      sortBy: 'name',
      viewMode: 'compact',
      editorMode: 'preview',
    }))
  })

  it('setActive 仅设置活动 id，不持久化', async () => {
    seedDocs(makeDoc('d1', 'Alpha'))
    await useTestStore.getState().load()
    fake.store.set.mockClear()
    useTestStore.getState().setActive('d1')
    expect(useTestStore.getState().activeId).toBe('d1')
    expect(fake.store.set).not.toHaveBeenCalled()
  })
})

describe('markdownDocumentParts normalize 注入（planStore 生产接线）', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [], tabs: [], activePlanId: null, activeTabId: null, loaded: false, loadFailed: false })
  })

  it('载入时经 normalize 回填缺失 planType，并随修剪重写落盘', async () => {
    const plan = {
      id: 'p1',
      title: 'Alpha',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      filePath: 'plans/2026-03/p1-alpha.md',
      color: '#60a5fa',
      createdAt: T0,
      updatedAt: T0,
    }
    fake.files.set(plan.filePath, '# Alpha')
    const gone = { ...plan, id: 'p2', filePath: 'plans/2026-03/p2-beta.md' }
    fake.files.set('plans/index.json', JSON.stringify([plan, gone]))
    await usePlanStore.getState().load()
    const expected = { ...plan, planType: 'monthly', tags: [] }
    expect(usePlanStore.getState().loaded).toBe(true)
    expect(usePlanStore.getState().plans).toEqual([expected])
    expect(JSON.parse(fake.files.get('plans/index.json') ?? '[]')).toEqual([expected])
  })
})
