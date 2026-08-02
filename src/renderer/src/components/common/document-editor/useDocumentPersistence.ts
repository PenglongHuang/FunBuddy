import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { extractH1Title } from '@/utils/markdown'

interface UseDocumentPersistenceOptions {
  documentId: string
  documentTitle: string
  loadContent: () => Promise<string>
  saveContent: (content: string) => Promise<void>
  updateTitle: (title: string) => Promise<void>
  showToast: (message: string) => void
}

interface PersistDocumentContentOptions {
  content: string
  documentTitle: string
  saveContent: (content: string) => Promise<void>
  updateTitle: (title: string) => Promise<void>
}

export function selectDocumentOptions<T>(
  optionsByDocumentId: ReadonlyMap<string, T>,
  documentId: string,
): T | undefined {
  return optionsByDocumentId.get(documentId)
}

export function shouldClearDirtyAfterSave({
  savedDocumentId,
  currentDocumentId,
  savedGeneration,
  currentGeneration,
}: {
  savedDocumentId: string
  currentDocumentId: string
  savedGeneration: number
  currentGeneration: number
}): boolean {
  return savedDocumentId === currentDocumentId && savedGeneration === currentGeneration
}

export async function persistDocumentContent({
  content,
  documentTitle,
  saveContent,
  updateTitle,
}: PersistDocumentContentOptions): Promise<void> {
  await saveContent(content)

  const h1 = extractH1Title(content)
  if (h1 && h1 !== documentTitle) {
    await updateTitle(h1)
  }
}

export function useDocumentPersistence(options: UseDocumentPersistenceOptions): {
  content: string
  contentRef: MutableRefObject<string>
  dirty: boolean
  setContent: Dispatch<SetStateAction<string>>
  handleChange: (nextContent: string) => void
  save: () => Promise<void>
} {
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const contentRef = useRef(content)
  const dirtyRef = useRef(dirty)
  const optionsRef = useRef(options)
  const optionsByDocumentIdRef = useRef(new Map<string, UseDocumentPersistenceOptions>())
  const editGenerationRef = useRef(0)

  contentRef.current = content
  dirtyRef.current = dirty
  optionsRef.current = options
  optionsByDocumentIdRef.current.set(options.documentId, options)

  useEffect(() => {
    let active = true

    options.loadContent()
      .then((loadedContent) => {
        if (!active) return
        contentRef.current = loadedContent
        dirtyRef.current = false
        editGenerationRef.current += 1
        setContent(loadedContent)
        setDirty(false)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [options.documentId, options.loadContent])

  const save = useCallback(async () => {
    const currentOptions = optionsRef.current
    const savedContent = contentRef.current
    const savedDocumentId = currentOptions.documentId
    const savedGeneration = editGenerationRef.current

    try {
      await persistDocumentContent({
        content: savedContent,
        documentTitle: currentOptions.documentTitle,
        saveContent: currentOptions.saveContent,
        updateTitle: currentOptions.updateTitle,
      })
      if (shouldClearDirtyAfterSave({
        savedDocumentId,
        currentDocumentId: optionsRef.current.documentId,
        savedGeneration,
        currentGeneration: editGenerationRef.current,
      })) {
        dirtyRef.current = false
        setDirty(false)
      }
      currentOptions.showToast('淇濆瓨鎴愬姛')
    } catch {
      currentOptions.showToast('淇濆瓨澶辫触')
    }
  }, [])

  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveRef.current()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const cleanupDocumentId = options.documentId

    return () => {
      const cleanupOptions = selectDocumentOptions(optionsByDocumentIdRef.current, cleanupDocumentId)
      optionsByDocumentIdRef.current.delete(cleanupDocumentId)
      if (!dirtyRef.current || !cleanupOptions) return

      void persistDocumentContent({
        content: contentRef.current,
        documentTitle: cleanupOptions.documentTitle,
        saveContent: cleanupOptions.saveContent,
        updateTitle: cleanupOptions.updateTitle,
      }).catch(() => undefined)
    }
  }, [options.documentId])

  const handleChange = useCallback((nextContent: string) => {
    contentRef.current = nextContent
    dirtyRef.current = true
    editGenerationRef.current += 1
    setContent(nextContent)
    setDirty(true)
  }, [])

  return { content, contentRef, dirty, setContent, handleChange, save }
}
