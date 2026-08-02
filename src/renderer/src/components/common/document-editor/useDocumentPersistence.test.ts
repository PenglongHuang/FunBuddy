import { describe, expect, it, vi } from 'vitest'
import {
  DocumentPersistenceCoordinator,
  persistDocumentContent,
} from './useDocumentPersistence'

describe('persistDocumentContent', () => {
  it('saves content and updates the title from a changed first H1', async () => {
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const updateTitle = vi.fn().mockResolvedValue(undefined)

    await persistDocumentContent({
      content: '# Renamed\n\nBody',
      documentTitle: 'Original',
      saveContent,
      updateTitle,
    })

    expect(saveContent).toHaveBeenCalledWith('# Renamed\n\nBody')
    expect(updateTitle).toHaveBeenCalledWith('Renamed')
  })

  it('does not update the title when the H1 matches the current title', async () => {
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const updateTitle = vi.fn().mockResolvedValue(undefined)

    await persistDocumentContent({
      content: '# Original\n\nBody',
      documentTitle: 'Original',
      saveContent,
      updateTitle,
    })

    expect(updateTitle).not.toHaveBeenCalled()
  })

  it('does not update the title when there is no H1', async () => {
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const updateTitle = vi.fn().mockResolvedValue(undefined)

    await persistDocumentContent({
      content: 'Body',
      documentTitle: 'Original',
      saveContent,
      updateTitle,
    })

    expect(updateTitle).not.toHaveBeenCalled()
  })

  it('propagates a content save failure', async () => {
    const error = new Error('save failed')
    const saveContent = vi.fn().mockRejectedValue(error)
    const updateTitle = vi.fn().mockResolvedValue(undefined)

    await expect(persistDocumentContent({
      content: '# Renamed',
      documentTitle: 'Original',
      saveContent,
      updateTitle,
    })).rejects.toThrow(error)

    expect(updateTitle).not.toHaveBeenCalled()
  })
})

function createOptions(documentId: string, saveContent = vi.fn().mockResolvedValue(undefined)) {
  return {
    documentId,
    documentTitle: documentId,
    loadContent: vi.fn().mockResolvedValue(''),
    saveContent,
    updateTitle: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
  }
}

describe('DocumentPersistenceCoordinator', () => {
  it('keeps a loading document empty when another dirty document is cleaned up', async () => {
    const coordinator = new DocumentPersistenceCoordinator()
    const saveA = vi.fn().mockResolvedValue(undefined)
    const saveB = vi.fn().mockResolvedValue(undefined)
    const sessionA = coordinator.activate(createOptions('a', saveA))

    coordinator.change(sessionA, '# A\n\nDirty content')
    const sessionB = coordinator.activate(createOptions('b', saveB))
    const sessionC = coordinator.activate(createOptions('c'))

    await coordinator.save(sessionA)

    expect(coordinator.snapshot(sessionB)).toMatchObject({ content: '', dirty: false })
    expect(coordinator.snapshot(sessionC)).toMatchObject({ content: '', dirty: false })
    expect(saveA).toHaveBeenCalledWith('# A\n\nDirty content')
    expect(saveB).not.toHaveBeenCalled()
  })

  it('serializes overlapping saves and persists the newest content last', async () => {
    let settleFirstSave!: () => void
    const firstSave = new Promise<void>((resolve) => { settleFirstSave = resolve })
    const saveContent = vi.fn()
      .mockReturnValueOnce(firstSave)
      .mockResolvedValueOnce(undefined)
    const coordinator = new DocumentPersistenceCoordinator()
    const session = coordinator.activate(createOptions('a', saveContent))

    coordinator.change(session, 'A')
    const savingA = coordinator.save(session)
    coordinator.change(session, 'B')
    const savingB = coordinator.save(session)

    expect(saveContent).toHaveBeenCalledTimes(1)
    expect(saveContent).toHaveBeenLastCalledWith('A')

    settleFirstSave()
    await savingA
    await savingB

    expect(saveContent).toHaveBeenNthCalledWith(2, 'B')
    expect(coordinator.snapshot(session)).toMatchObject({ content: 'B', dirty: false })
  })

  it('continues queued saves after a save failure', async () => {
    const saveContent = vi.fn()
      .mockRejectedValueOnce(new Error('first save failed'))
      .mockResolvedValueOnce(undefined)
    const coordinator = new DocumentPersistenceCoordinator()
    const session = coordinator.activate(createOptions('a', saveContent))

    coordinator.change(session, 'A')
    const failedSave = coordinator.save(session)
    coordinator.change(session, 'B')
    const retrySave = coordinator.save(session)

    await expect(failedSave).rejects.toThrow('first save failed')
    await retrySave

    expect(saveContent).toHaveBeenNthCalledWith(1, 'A')
    expect(saveContent).toHaveBeenNthCalledWith(2, 'B')
    expect(coordinator.snapshot(session)).toMatchObject({ content: 'B', dirty: false })
  })
})
