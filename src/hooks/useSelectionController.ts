import { useMemo, useState } from 'react'
import type { SelectionInteraction } from '../types/items'

function toOrderedSelection(visibleIds: string[], selectedSet: Set<string>) {
  return visibleIds.filter((id) => selectedSet.has(id))
}

export function useSelectionController(visibleIds: string[]) {
  const [rawSelectedIds, setRawSelectedIds] = useState<string[]>([])
  const [anchorId, setAnchorId] = useState<string | null>(null)

  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds])
  const selectedIds = useMemo(
    () => rawSelectedIds.filter((id) => visibleIdSet.has(id)),
    [rawSelectedIds, visibleIdSet],
  )

  const clearSelection = () => {
    setRawSelectedIds([])
    setAnchorId(null)
  }

  const selectAll = () => {
    setRawSelectedIds(visibleIds)
    setAnchorId(visibleIds[0] ?? null)
  }

  const handleSelect = (id: string, interaction: SelectionInteraction = {}) => {
    const { shiftKey = false, ctrlKey = false, metaKey = false } = interaction
    const keepExisting = ctrlKey || metaKey

    if (!visibleIdSet.has(id)) {
      return
    }

    if (shiftKey && anchorId && visibleIdSet.has(anchorId)) {
      const anchorIndex = visibleIds.indexOf(anchorId)
      const currentIndex = visibleIds.indexOf(id)
      const [startIndex, endIndex] =
        anchorIndex < currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex]
      const rangeIds = visibleIds.slice(startIndex, endIndex + 1)
      const nextSelected = keepExisting ? new Set(selectedIds) : new Set<string>()

      rangeIds.forEach((rangeId) => nextSelected.add(rangeId))
      setRawSelectedIds(toOrderedSelection(visibleIds, nextSelected))
      return
    }

    if (keepExisting) {
      const nextSelected = new Set(selectedIds)
      if (nextSelected.has(id)) {
        nextSelected.delete(id)
      } else {
        nextSelected.add(id)
      }

      setRawSelectedIds(toOrderedSelection(visibleIds, nextSelected))
      setAnchorId(id)
      return
    }

    setRawSelectedIds([id])
    setAnchorId(id)
  }

  return {
    selectedIds,
    clearSelection,
    selectAll,
    handleSelect,
  }
}
