import { useRef, useCallback } from 'react'
import { usePetStore } from '@/stores/petStore'
import PetAvatar from './PetAvatar'
import { usePetDrag } from '@/hooks/usePetDrag'

export default function PetModeView() {
  const setWindowMode = usePetStore((s) => s.setWindowMode)
  const petRef = useRef<HTMLDivElement>(null)

  const handleExpand = useCallback(async () => {
    setWindowMode('expanded')
  }, [setWindowMode])

  const { handleMouseDown } = usePetDrag(petRef, {
    isPetMode: true,
    onClick: handleExpand,
  })

  return (
    <div className="w-full h-full flex flex-col items-center justify-center" style={{ overflow: 'visible' }}>
      <div ref={petRef} onMouseDown={handleMouseDown}>
        <PetAvatar size={80} />
      </div>
    </div>
  )
}
