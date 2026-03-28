import { useEffect, useState } from 'react'
import { LIST_SORT_OPTIONS } from '../lib/item-utils'
import type { ListSortOption } from '../types/items'

interface PersistedListControlsState {
  sortOption: ListSortOption
  selectedTags: string[]
  selectionMode: boolean
}

type PersistedListControlsOverride = Partial<PersistedListControlsState> | null

const DEFAULT_STATE: PersistedListControlsState = {
  sortOption: 'recent',
  selectedTags: [],
  selectionMode: false,
}

function readPersistedState(storageKey: string): PersistedListControlsState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey)
    if (!rawValue) {
      return DEFAULT_STATE
    }

    const parsed = JSON.parse(rawValue) as Partial<PersistedListControlsState>
    return {
      sortOption: LIST_SORT_OPTIONS.includes(parsed.sortOption as ListSortOption)
        ? (parsed.sortOption as ListSortOption)
        : DEFAULT_STATE.sortOption,
      selectedTags: Array.isArray(parsed.selectedTags)
        ? parsed.selectedTags.filter((tag): tag is string => typeof tag === 'string')
        : DEFAULT_STATE.selectedTags,
      selectionMode:
        typeof parsed.selectionMode === 'boolean' ? parsed.selectionMode : DEFAULT_STATE.selectionMode,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function mergePersistedState(
  persistedState: PersistedListControlsState,
  override: PersistedListControlsOverride,
) {
  if (!override) {
    return persistedState
  }

  return {
    sortOption:
      override.sortOption && LIST_SORT_OPTIONS.includes(override.sortOption)
        ? override.sortOption
        : persistedState.sortOption,
    selectedTags: override.selectedTags ?? persistedState.selectedTags,
    selectionMode:
      typeof override.selectionMode === 'boolean'
        ? override.selectionMode
        : persistedState.selectionMode,
  }
}

export function usePersistedListControls(
  storageKey: string,
  initialOverride: PersistedListControlsOverride = null,
) {
  const [state, setState] = useState<PersistedListControlsState>(() =>
    mergePersistedState(readPersistedState(storageKey), initialOverride),
  )

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state, storageKey])

  return {
    sortOption: state.sortOption,
    selectedTags: state.selectedTags,
    selectionMode: state.selectionMode,
    setSortOption: (sortOption: ListSortOption) =>
      setState((currentState) => ({ ...currentState, sortOption })),
    setSelectedTags: (
      selectedTags:
        | string[]
        | ((currentTags: string[]) => string[]),
    ) =>
      setState((currentState) => ({
        ...currentState,
        selectedTags:
          typeof selectedTags === 'function' ? selectedTags(currentState.selectedTags) : selectedTags,
      })),
    setSelectionMode: (
      selectionMode:
        | boolean
        | ((currentSelectionMode: boolean) => boolean),
    ) =>
      setState((currentState) => ({
        ...currentState,
        selectionMode:
          typeof selectionMode === 'function'
            ? selectionMode(currentState.selectionMode)
            : selectionMode,
      })),
  }
}
