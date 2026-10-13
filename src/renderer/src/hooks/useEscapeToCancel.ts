import { useEffect } from 'react'

/** 对话框打开期间按 Escape 触发 onCancel。capture 阶段先于 App 的冒泡全局监听，阻止其把应用折叠成宠物模式。 */
export default function useEscapeToCancel(enabled: boolean, onCancel: () => void) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, onCancel])
}
