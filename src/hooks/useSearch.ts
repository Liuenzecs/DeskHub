import { useDeferredValue, useMemo } from 'react'
import { useSearchRuntime } from './useSearchRuntime'
import { searchItems } from '../lib/item-utils'
import type { DeskItem } from '../types/items'

export function useSearch<T extends DeskItem>(items: T[], query: string) {
  const deferredQuery = useDeferredValue(query)
  const searchRuntimeVersion = useSearchRuntime(deferredQuery)

  return useMemo(() => {
    void searchRuntimeVersion

    if (!deferredQuery.trim()) {
      return items
    }

    return searchItems(items, deferredQuery) as T[]
  }, [deferredQuery, items, searchRuntimeVersion])
}
