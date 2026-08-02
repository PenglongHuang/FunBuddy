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

interface DocumentSession {
  options: UseDocumentPersistenceOptions
  content: string
  dirty: boolean
  generation: number
  queue: Promise<void> | null
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

export class DocumentPersistenceCoordinator {
  private activeSession: DocumentSession | null = null

  activate(options: UseDocumentPersistenceOptions): DocumentSession {
    if (this.activeSession?.options.documentId === options.documentId) {
      this.activeSession.options = options
      return this.activeSession
    }

    const session: DocumentSession = {
      options,
      content: '',
      dirty: false,
      generation: 0,
      queue: null,
    }
    this.activeSession = session
    return session
  }

  snapshot(session: DocumentSession): Pick<DocumentSession, 'content' | 'dirty' | 'generation'> {
    return {
      content: session.content,
      dirty: session.dirty,
      generation: session.generation,
    }
  }

  isActive(session: DocumentSession): boolean {
    return this.activeSession === session
  }

  isDirty(session: DocumentSession): boolean {
    return session.dirty
  }

  load(session: DocumentSession, content: string): boolean {
    if (!this.isActive(session)) return false

    session.content = content
    session.dirty = false
    session.generation += 1
    return true
  }

  change(session: DocumentSession, content: string): void {
    session.content = content
    session.dirty = true
    session.generation += 1
  }

  save(session: DocumentSession): Promise<void> {
    const snapshot = {
      content: session.content,
      generation: session.generation,
      options: session.options,
    }
    const persist = async () => {
      await persistDocumentContent({
        content: snapshot.content,
        documentTitle: snapshot.options.documentTitle,
        saveContent: snapshot.options.saveContent,
        updateTitle: snapshot.options.updateTitle,
      })
      if (session.generation === snapshot.generation) {
        session.dirty = false
      }
    }
    const queuedSave = session.queue ? session.queue.then(persist, persist) : persist()

    session.queue = queuedSave.then(() => undefined, () => undefined)
    return queuedSave
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
  const [, refresh] = useState(0)
  const coordinatorRef = useRef<DocumentPersistenceCoordinator | null>(null)
  const activeSessionRef = useRef<DocumentSession | null>(null)
  const contentRef = useRef('')

  if (!coordinatorRef.current) {
    coordinatorRef.current = new DocumentPersistenceCoordinator()
  }
  const coordinator = coordinatorRef.current
  const activeSession = coordinator.activate(options)
  activeSessionRef.current = activeSession
  const activeSnapshot = coordinator.snapshot(activeSession)
  contentRef.current = activeSnapshot.content

  useEffect(() => {
    let active = true
    const loadingSession = activeSession

    options.loadContent()
      .then((loadedContent) => {
        if (active && coordinator.load(loadingSession, loadedContent)) {
          contentRef.current = loadedContent
          refresh((version) => version + 1)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [options.documentId, options.loadContent, activeSession, coordinator])

  const save = useCallback(async () => {
    const session = activeSessionRef.current
    if (!session) return

    try {
      await coordinator.save(session)
      if (coordinator.isActive(session)) {
        contentRef.current = coordinator.snapshot(session).content
        refresh((version) => version + 1)
      }
      session.options.showToast('淇濆瓨鎴愬姛')
    } catch {
      session.options.showToast('淇濆瓨澶辫触')
    }
  }, [coordinator])

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
    const cleanupSession = activeSession

    return () => {
      if (coordinator.isDirty(cleanupSession)) {
        void coordinator.save(cleanupSession).catch(() => undefined)
      }
    }
  }, [options.documentId, activeSession, coordinator])

  const handleChange = useCallback((nextContent: string) => {
    const session = activeSessionRef.current
    if (!session) return

    coordinator.change(session, nextContent)
    contentRef.current = nextContent
    refresh((version) => version + 1)
  }, [coordinator])

  const setContent = useCallback((nextContent: SetStateAction<string>) => {
    const session = activeSessionRef.current
    if (!session) return

    const currentContent = coordinator.snapshot(session).content
    handleChange(typeof nextContent === 'function' ? nextContent(currentContent) : nextContent)
  }, [coordinator, handleChange])

  return {
    content: activeSnapshot.content,
    contentRef,
    dirty: activeSnapshot.dirty,
    setContent,
    handleChange,
    save,
  }
}
