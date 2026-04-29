import { useEffect, useRef, useCallback } from 'react'
import { usePetStore } from '@/stores/petStore'
import { windowApi, petEvents } from '@/lib/ipc'

const CLICK_THRESHOLD = 5

export function usePetDrag(
  petRef: React.RefObject<HTMLElement | null>,
  options: { isPetMode: boolean; onClick?: () => void }
) {
  const { isPetMode, onClick } = options
  const dragging = useRef(false)
  const startScreen = useRef({ x: 0, y: 0 })
  const moved = useRef(false)

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
    startScreen.current = { x: e.screenX, y: e.screenY }
    windowApi.setPetDragging(true).catch(() => {})
  }, [isPetMode])

  useEffect(() => {
    if (!isPetMode) return

    const handleGlobalMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.screenX - startScreen.current.x
      const dy = e.screenY - startScreen.current.y
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
        moved.current = true
      }
      if (moved.current) {
        windowApi.moveBy(dx, dy).catch(() => {})
        startScreen.current = { x: e.screenX, y: e.screenY }
      }
    }

    const handleGlobalUp = (_e: MouseEvent) => {
      if (!dragging.current) return
      dragging.current = false
      windowApi.setPetDragging(false).catch(() => {})
      if (!moved.current) {
        onClick?.()
      }
    }

    window.addEventListener('mousemove', handleGlobalMove)
    window.addEventListener('mouseup', handleGlobalUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove)
      window.removeEventListener('mouseup', handleGlobalUp)
    }
  }, [isPetMode, onClick])

  return { handleMouseDown }
}
