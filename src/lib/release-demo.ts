import { LIST_SORT_OPTIONS } from './item-utils'
import type { ListSortOption } from '../types/items'

const RELEASE_DEMO_FLAG = 'release-assets'

type ReleaseOverlay = 'palette' | 'data-tools' | null

export interface ReleaseCaptureConfig {
  enabled: boolean
  overlay: ReleaseOverlay
  paletteQuery: string
  listQuery: string
  sortOption: ListSortOption | null
  selectedTags: string[]
  selectionMode: boolean
}

function getSearchParams(search?: string) {
  const value =
    search ?? (typeof window !== 'undefined' ? window.location.search : '')

  return new URLSearchParams(value)
}

export function hasTauriRuntime() {
  if (typeof window === 'undefined') {
    return false
  }

  const runtimeWindow = window as Window & {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }

  return Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__)
}

export function isReleaseDemoEnabled(search?: string) {
  if (hasTauriRuntime()) {
    return false
  }

  return getSearchParams(search).get('demo') === RELEASE_DEMO_FLAG
}

function parseSortOption(value: string | null): ListSortOption | null {
  if (!value) {
    return null
  }

  return LIST_SORT_OPTIONS.includes(value as ListSortOption)
    ? (value as ListSortOption)
    : null
}

function parseTags(value: string | null) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function getReleaseCaptureConfig(search?: string): ReleaseCaptureConfig {
  if (!isReleaseDemoEnabled(search)) {
    return {
      enabled: false,
      overlay: null,
      paletteQuery: '',
      listQuery: '',
      sortOption: null,
      selectedTags: [],
      selectionMode: false,
    }
  }

  const params = getSearchParams(search)
  const overlay = params.get('open')
  const selection = params.get('selection')

  return {
    enabled: true,
    overlay: overlay === 'palette' || overlay === 'data-tools' ? overlay : null,
    paletteQuery: params.get('paletteQuery')?.trim() ?? '',
    listQuery: params.get('query')?.trim() ?? '',
    sortOption: parseSortOption(params.get('sort')),
    selectedTags: parseTags(params.get('tags')),
    selectionMode: selection === 'mode',
  }
}
