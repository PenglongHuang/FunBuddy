import { useEffect, useRef, useCallback } from 'react'
import { usePetStore } from '@/stores/petStore'
import { windowApi, petEvents } from '@/lib/ipc'

const CLICK_THRESHOLD = 5

export function usePetDrag(
  _petRef: React.RefObject<HTMLElement | null>,
  options: { isPetMode: boolean; onClick?: () => void }
) {
  const { isPetMode } = options
  const onClickRef = useRef(options.onClick)
  onClickRef.current = options.onClick

  const dragging = useRef(false)
  const startScreen = useRef({ x: 0, y: 0 })
  const moved = useRef(false)
  const pendingCursor = useRef({ x: 0, y: 0 })
  const rafId = useRef(0)
  const skipNext = useRef(false)

  // Start/stop main-process cursor tracking
  useEffect(() => {
    if (!isPetMode) return

    windowApi.startPetTracking().catch(() => {})

    const unsub = petEvents.onCursorHover((hovered) => {
      usePetStore.getState().setPetHovered(hovered)
    })

    return () => {
      unsub()
      windowApi.stopPetTracking().catch(() => {})
    }
  }, [isPetMode])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isPetMode) return
    e.preventDefault()
    dragging.current = true
    moved.current = false
    skipNext.current = false
    startScreen.current = { x: e.screenX, y: e.screenY }
    windowApi.setPetDragging(true, e.screenX, e.screenY).catch(() => {})
  }, [isPetMode])

  useEffect(() => {
    if (!isPetMode) return

    const handleGlobalMove = (e: MouseEvent) => {
      if (!dragging.current) return

      // Skip synthetic mousemove triggered by window repositioning
      if (skipNext.current) {
        skipNext.current = false
        return
      }

      if (!moved.current) {
        const dx = e.screenX - startScreen.current.x
        const dy = e.screenY - startScreen.current.y
        if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
          moved.current = true
        }
      }
      if (moved.current) {
        pendingCursor.current = { x: e.screenX, y: e.screenY }
        if (!rafId.current) {
          rafId.current = requestAnimationFrame(() => {
            rafId.current = 0
            skipNext.current = true
            windowApi.moveBy(pendingCursor.current.x, pendingCursor.current.y)
          })
        }
      }
    }

    const handleGlobalUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = 0
      }
      skipNext.current = false
      windowApi.setPetDragging(false).catch(() => {})
      if (!moved.current) {
        onClickRef.current?.()
      }
    }

    window.addEventListener('mousemove', handleGlobalMove)
    window.addEventListener('mouseup', handleGlobalUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove)
      window.removeEventListener('mouseup', handleGlobalUp)
    }
  }, [isPetMode])

  return { handleMouseDown }
}
