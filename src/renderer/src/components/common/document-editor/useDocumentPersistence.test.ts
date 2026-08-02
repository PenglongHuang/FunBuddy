import { describe, expect, it, vi } from 'vitest'
import { persistDocumentContent } from './useDocumentPersistence'

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
