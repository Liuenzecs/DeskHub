type PinyinRuntime = typeof import('./search-transliteration-runtime')['pinyin']

export interface SearchIndex {
  raw: string
  compactRaw: string
  pinyin: string
  compactPinyin: string
  initials: string
  transliterationReady: boolean
  sourceValues: string[]
}

export type SearchMatchKind = 'raw' | 'pinyin' | 'initials' | null

const SEARCH_INDEX_CACHE_LIMIT = 1200
const searchIndexCache = new Map<string, SearchIndex>()
const searchRuntimeListeners = new Set<() => void>()

let pinyinRuntime: PinyinRuntime | null = null
let pinyinRuntimePromise: Promise<void> | null = null
let searchRuntimeVersion = 0
let scheduledWarmupCleanup: (() => void) | null = null

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function compactValue(value: string) {
  return normalizeValue(value).replace(/\s+/g, '')
}

export function canSearchQueryBenefitFromTransliteration(query: string) {
  return /[a-z]/i.test(query)
}

function notifySearchRuntimeReady() {
  searchRuntimeVersion += 1
  for (const listener of searchRuntimeListeners) {
    listener()
  }
}

function createPinyinValue(value: string, pattern: 'pinyin' | 'first') {
  if (!pinyinRuntime) {
    return ''
  }

  return pinyinRuntime(value, {
    toneType: 'none',
    pattern,
    nonZh: 'consecutive',
    separator: pattern === 'first' ? '' : ' ',
  }).toLowerCase()
}

function enrichSearchIndex(index: SearchIndex) {
  if (!pinyinRuntime || index.transliterationReady) {
    return index
  }

  const pinyinValues = index.sourceValues.map((value) => createPinyinValue(value, 'pinyin'))
  const initialsValues = index.sourceValues.map((value) => createPinyinValue(value, 'first'))

  index.pinyin = pinyinValues.join(' ')
  index.compactPinyin = compactValue(index.pinyin)
  index.initials = initialsValues.join('')
  index.transliterationReady = true
  return index
}

function enrichCachedSearchIndexes() {
  for (const index of searchIndexCache.values()) {
    enrichSearchIndex(index)
  }
}

function setCachedSearchIndex(cacheKey: string, index: SearchIndex) {
  if (searchIndexCache.size >= SEARCH_INDEX_CACHE_LIMIT) {
    const oldestKey = searchIndexCache.keys().next().value
    if (oldestKey) {
      searchIndexCache.delete(oldestKey)
    }
  }

  searchIndexCache.set(cacheKey, index)
}

export function getSearchRuntimeVersion() {
  return searchRuntimeVersion
}

export function subscribeSearchRuntime(listener: () => void) {
  searchRuntimeListeners.add(listener)

  return () => {
    searchRuntimeListeners.delete(listener)
  }
}

export function isSearchTransliterationReady() {
  return pinyinRuntime !== null
}

export async function loadSearchTransliteration() {
  if (pinyinRuntime) {
    return
  }

  if (!pinyinRuntimePromise) {
    pinyinRuntimePromise = import('./search-transliteration-runtime')
      .then((module) => {
        pinyinRuntime = module.pinyin
        enrichCachedSearchIndexes()
        notifySearchRuntimeReady()
      })
      .catch((error) => {
        pinyinRuntimePromise = null
        throw error
      })
  }

  return pinyinRuntimePromise
}

export function scheduleSearchTransliterationWarmup() {
  if (pinyinRuntime || scheduledWarmupCleanup) {
    return scheduledWarmupCleanup ?? (() => undefined)
  }

  if (typeof window === 'undefined') {
    void loadSearchTransliteration()
    return () => undefined
  }

  const browserWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (
    typeof browserWindow.requestIdleCallback === 'function' &&
    typeof browserWindow.cancelIdleCallback === 'function'
  ) {
    const handle = browserWindow.requestIdleCallback(() => {
      scheduledWarmupCleanup = null
      void loadSearchTransliteration()
    }, { timeout: 1500 })

    scheduledWarmupCleanup = () => {
      browserWindow.cancelIdleCallback?.(handle)
      scheduledWarmupCleanup = null
    }

    return scheduledWarmupCleanup
  }

  const timeoutId = globalThis.setTimeout(() => {
    scheduledWarmupCleanup = null
    void loadSearchTransliteration()
  }, 0)

  scheduledWarmupCleanup = () => {
    globalThis.clearTimeout(timeoutId)
    scheduledWarmupCleanup = null
  }

  return scheduledWarmupCleanup
}

function maybeRequestSearchTransliteration(query: string) {
  if (!pinyinRuntime && canSearchQueryBenefitFromTransliteration(query)) {
    void loadSearchTransliteration()
  }
}

export function buildSearchIndex(values: string[], cacheKey?: string) {
  if (cacheKey) {
    const cachedIndex = searchIndexCache.get(cacheKey)
    if (cachedIndex) {
      return pinyinRuntime ? enrichSearchIndex(cachedIndex) : cachedIndex
    }
  }

  const normalizedValues = values.map(normalizeValue).filter(Boolean)
  const raw = normalizedValues.join(' ')

  const index = {
    raw,
    compactRaw: compactValue(raw),
    pinyin: '',
    compactPinyin: '',
    initials: '',
    transliterationReady: false,
    sourceValues: normalizedValues,
  } satisfies SearchIndex

  if (pinyinRuntime) {
    enrichSearchIndex(index)
  }

  if (cacheKey) {
    setCachedSearchIndex(cacheKey, index)
  }

  return index
}

export function normalizeSearchQuery(query: string) {
  return normalizeValue(query)
}

export function scoreSearchIndex(index: SearchIndex, query: string) {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) {
    return 0
  }

  const compactQuery = compactValue(normalizedQuery)
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  let score = 0

  if (index.raw === normalizedQuery) score += 1500
  if (index.raw.startsWith(normalizedQuery)) score += 1100
  else if (index.raw.includes(normalizedQuery)) score += 780

  if (index.compactRaw.startsWith(compactQuery)) score += 720
  else if (index.compactRaw.includes(compactQuery)) score += 520

  if (index.transliterationReady) {
    if (index.pinyin.startsWith(normalizedQuery)) score += 900
    else if (index.pinyin.includes(normalizedQuery)) score += 680

    if (index.compactPinyin.startsWith(compactQuery)) score += 740
    else if (index.compactPinyin.includes(compactQuery)) score += 560

    if (index.initials.startsWith(compactQuery)) score += 620
    else if (index.initials.includes(compactQuery)) score += 460
  } else {
    maybeRequestSearchTransliteration(normalizedQuery)
  }

  for (const token of tokens) {
    const compactToken = compactValue(token)
    if (index.raw.startsWith(token)) score += 160
    if (index.raw.includes(token)) score += 90

    if (index.transliterationReady) {
      if (index.pinyin.includes(token)) score += 80
      if (index.initials.includes(compactToken)) score += 70
    }
  }

  return score
}

export function getSearchMatchKind(index: SearchIndex, query: string): SearchMatchKind {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) {
    return null
  }

  const compactQuery = compactValue(normalizedQuery)

  if (
    index.raw === normalizedQuery ||
    index.raw.startsWith(normalizedQuery) ||
    index.raw.includes(normalizedQuery) ||
    index.compactRaw.startsWith(compactQuery) ||
    index.compactRaw.includes(compactQuery)
  ) {
    return 'raw'
  }

  if (!index.transliterationReady) {
    maybeRequestSearchTransliteration(normalizedQuery)
    return null
  }

  if (
    index.pinyin.startsWith(normalizedQuery) ||
    index.pinyin.includes(normalizedQuery) ||
    index.compactPinyin.startsWith(compactQuery) ||
    index.compactPinyin.includes(compactQuery)
  ) {
    return 'pinyin'
  }

  if (index.initials.startsWith(compactQuery) || index.initials.includes(compactQuery)) {
    return 'initials'
  }

  return null
}
