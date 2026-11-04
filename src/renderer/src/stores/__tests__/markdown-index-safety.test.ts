import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  deleteFile: vi.fn(),
}))
vi.mock('@/lib/ipc', () => ({
  fs: {
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
    exists: mocks.exists,
    deleteFile: mocks.deleteFile,
  },
  store: { get: vi.fn(), set: vi.fn() },
  imageApi: { cleanup: vi.fn(), moveAssets: vi.fn() },
  autolaunch: { enable: vi.fn(), disable: vi.fn() },
}))

// 真实 renderer 侧经 Electron invoke 序列化后错误只剩 message（err.code 丢失），
// mock 刻意不带 code，确保守卫只能依赖 message 判定 ENOENT
function enoentError(path: string): Error {
  return new Error(`ENOENT: no such file or directory, open '${path}'`)
}

function eaccesError(path: string): Error {
  return new Error(`EACCES: permission denied, open '${path}'`)
}

describe('noteStore.load 失败安全', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('索引不存在(ENOENT) → 空列表且 loaded', async () => {
    mocks.readFile.mockRejectedValueOnce(enoentError('notes/index.json'))
    const { useNoteStore } = await import('../noteStore')
    await useNoteStore.getState().load()
    expect(useNoteStore.getState().notes).toEqual([])
    expect(useNoteStore.getState().loaded).toBe(true)
  })

  it('读取失败(非 ENOENT) → 不标记 loaded，deleteNote 拒绝写索引', async () => {
    mocks.readFile.mockRejectedValueOnce(eaccesError('notes/index.json'))
    const { useNoteStore } = await import('../noteStore')
    await useNoteStore.getState().load()
    expect(useNoteStore.getState().loaded).toBe(false)
    expect(useNoteStore.getState().loadFailed).toBe(true)
    await expect(useNoteStore.getState().deleteNote('x')).rejects.toThrow()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('索引损坏(非法 JSON) → 不标记 loaded', async () => {
    mocks.readFile.mockResolvedValueOnce('{broken')
    const { useNoteStore } = await import('../noteStore')
    await useNoteStore.getState().load()
    expect(useNoteStore.getState().loaded).toBe(false)
    expect(useNoteStore.getState().loadFailed).toBe(true)
  })

  it('BOM 开头的合法 JSON → 正常解析', async () => {
    mocks.readFile.mockResolvedValueOnce('\uFEFF[]')
    const { useNoteStore } = await import('../noteStore')
    await useNoteStore.getState().load()
    expect(useNoteStore.getState().loaded).toBe(true)
  })

  it('未加载时各写索引操作均拒绝且不触达 writeFile', async () => {
    mocks.readFile.mockResolvedValueOnce('{broken')
    const { useNoteStore } = await import('../noteStore')
    await useNoteStore.getState().load()
    const s = useNoteStore.getState()
    await expect(s.deleteNotes(['x'])).rejects.toThrow()
    await expect(s.updateNoteTags('x', [])).rejects.toThrow()
    await expect(s.renameTag('a', 'b')).rejects.toThrow()
    await expect(s.deleteTag('a')).rejects.toThrow()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('ENOENT 空状态后 createNote 允许且成功（索引缺失时新建数组）', async () => {
    mocks.readFile.mockRejectedValueOnce(enoentError('notes/index.json'))
    const { useNoteStore } = await import('../noteStore')
    await useNoteStore.getState().load()
    const created = await useNoteStore.getState().createNote('新笔记')
    expect(useNoteStore.getState().notes).toEqual([created])
    const indexWrite = mocks.writeFile.mock.calls.find((c) => c[0] === 'notes/index.json')
    expect(indexWrite).toBeTruthy()
    expect(JSON.parse(indexWrite![1])).toEqual([created])
  })
})

describe('planStore.load 失败安全', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('索引不存在(ENOENT) → 空列表且 loaded', async () => {
    mocks.readFile.mockRejectedValueOnce(enoentError('plans/index.json'))
    const { usePlanStore } = await import('../planStore')
    await usePlanStore.getState().load()
    expect(usePlanStore.getState().plans).toEqual([])
    expect(usePlanStore.getState().loaded).toBe(true)
  })

  it('读取失败(非 ENOENT) → 不标记 loaded，deletePlan 拒绝写索引', async () => {
    mocks.readFile.mockRejectedValueOnce(eaccesError('plans/index.json'))
    const { usePlanStore } = await import('../planStore')
    await usePlanStore.getState().load()
    expect(usePlanStore.getState().loaded).toBe(false)
    expect(usePlanStore.getState().loadFailed).toBe(true)
    await expect(usePlanStore.getState().deletePlan('x')).rejects.toThrow()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('索引损坏(非法 JSON) → 不标记 loaded', async () => {
    mocks.readFile.mockResolvedValueOnce('{broken')
    const { usePlanStore } = await import('../planStore')
    await usePlanStore.getState().load()
    expect(usePlanStore.getState().loaded).toBe(false)
    expect(usePlanStore.getState().loadFailed).toBe(true)
  })

  it('BOM 开头的合法 JSON → 正常解析', async () => {
    mocks.readFile.mockResolvedValueOnce('\uFEFF[]')
    const { usePlanStore } = await import('../planStore')
    await usePlanStore.getState().load()
    expect(usePlanStore.getState().loaded).toBe(true)
  })

  it('未加载时各写索引操作均拒绝且不触达 writeFile', async () => {
    mocks.readFile.mockResolvedValueOnce('{broken')
    const { usePlanStore } = await import('../planStore')
    await usePlanStore.getState().load()
    const s = usePlanStore.getState()
    await expect(s.deletePlans(['x'])).rejects.toThrow()
    await expect(s.updatePlanTags('x', [])).rejects.toThrow()
    await expect(s.renameTag('a', 'b')).rejects.toThrow()
    await expect(s.deleteTag('a')).rejects.toThrow()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('ENOENT 空状态后 createPlan 允许且成功（索引缺失时新建数组）', async () => {
    mocks.readFile.mockRejectedValueOnce(enoentError('plans/index.json'))
    const { usePlanStore } = await import('../planStore')
    await usePlanStore.getState().load()
    const created = await usePlanStore.getState().createPlan('新计划', '2026-10-12', null)
    expect(usePlanStore.getState().plans).toEqual([created])
    const indexWrite = mocks.writeFile.mock.calls.find((c) => c[0] === 'plans/index.json')
    expect(indexWrite).toBeTruthy()
    expect(JSON.parse(indexWrite![1])).toEqual([created])
  })
})
