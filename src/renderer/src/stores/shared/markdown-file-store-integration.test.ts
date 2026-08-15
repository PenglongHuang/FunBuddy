import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      get: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
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

import { useNoteStore } from '../noteStore'
import { usePlanStore } from '../planStore'

const storeSources = [
  fileURLToPath(new URL('../noteStore.ts', import.meta.url)),
  fileURLToPath(new URL('../planStore.ts', import.meta.url)),
]

describe('document store Markdown file integration', () => {
  beforeEach(() => {
    fake.files.clear()
    fake.failWritePath = null
    vi.clearAllMocks()
    useNoteStore.setState({ notes: [], tabs: [], activeNoteId: null, activeTabId: null })
    usePlanStore.setState({ plans: [], tabs: [], activePlanId: null, activeTabId: null })
  })

  it('creates a plan by appending to the latest on-disk index', async () => {
    fake.files.set('plans/index.json', JSON.stringify([{ id: 'from-another-window' }]))

    const created = await usePlanStore
      .getState()
      .createPlan('New plan', '2026-08-09', null, 'daily', '# body')

    expect(JSON.parse(fake.files.get('plans/index.json') ?? '[]')).toEqual([
      { id: 'from-another-window' },
      created,
    ])
  })

  it.each([
    ['note', 'notes/index.json', () => useNoteStore.getState().createNote('New note')],
    [
      'plan',
      'plans/index.json',
      () => usePlanStore.getState().createPlan('New plan', '2026-08-09', null, 'daily'),
    ],
  ] as const)('does not publish a new %s in memory when index append fails', async (kind, indexPath, create) => {
    fake.files.set(indexPath, '[]')
    fake.failWritePath = indexPath

    await expect(create()).rejects.toThrow(`write failed: ${indexPath}`)

    expect(kind === 'note' ? useNoteStore.getState().notes : usePlanStore.getState().plans).toEqual([])
  })

  it.each(storeSources)('%s delegates paired file operations to the shared helpers', (sourcePath) => {
    const source = readFileSync(sourcePath, 'utf8')

    expect(source).toContain('appendIndexRecord')
    expect(source).toContain('deleteMarkdownDocument')
    expect(source).toContain('moveMarkdownDocument')
    expect(source).not.toContain('imageApi.cleanup(')
    expect(source).not.toContain('imageApi.moveAssets(')
  })
})
