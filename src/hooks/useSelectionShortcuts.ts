import { useEffect } from 'react'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

interface UseSelectionShortcutsOptions {
  enabled: boolean
  hasSelection: boolean
  onSelectAll: () => void
  onExit: () => void
  onDelete?: () => void
}

export function useSelectionShortcuts({
  enabled,
  hasSelection,
  onSelectAll,
  onExit,
  onDelete,
}: UseSelectionShortcutsOptions) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        onSelectAll()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
        return
      }

      if (hasSelection && onDelete && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        onDelete()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, hasSelection, onDelete, onExit, onSelectAll])
}
