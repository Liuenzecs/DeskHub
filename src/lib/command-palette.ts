import { ITEM_STARTER_TEMPLATES, itemStarterTemplateToFormValues } from './item-templates'
import { getCommandPaletteActionHistoryTarget, toCommandHistoryPayload } from './command-history'
import { getItemTarget, ITEM_TYPE_LABELS, ITEM_TYPES } from './item-utils'
import { NAV_ITEMS } from './navigation'
import {
  buildSearchIndex,
  getSearchRuntimeVersion,
  getSearchMatchKind,
  normalizeSearchQuery,
  scoreSearchIndex,
  type SearchIndex,
  type SearchMatchKind,
} from './search-index'
import { WORKFLOW_TEMPLATES, workflowTemplateToFormValues } from './workflow-templates'
import type {
  CommandHistoryEntry,
  CommandPaletteActionEntry,
  CommandPaletteEntry,
  CommandPaletteItemEntry,
  CommandPaletteRouteEntry,
  DeskItem,
  ItemType,
} from '../types/items'

interface PreparedCommandPaletteEntry {
  entry: CommandPaletteEntry
  searchIndex: SearchIndex
}

interface ParsedPaletteQuery {
  scope:
    | { kind: 'item'; itemType?: ItemType }
    | { kind: 'route' }
    | { kind: 'action' }
    | null
  rawQuery: string
}

interface RankedPaletteEntry {
  entry: CommandPaletteEntry
  score: number
  matchKind: SearchMatchKind
  historyUseCount: number
  historyLastUsedAt: number
}

interface CommandPaletteQuickView {
  recentCommands: CommandPaletteEntry[]
  favoriteItems: CommandPaletteItemEntry[]
  quickRoutes: CommandPaletteRouteEntry[]
  quickActions: CommandPaletteActionEntry[]
}

const PREPARED_COMMAND_PALETTE_CACHE_LIMIT = 8
const COMMAND_PALETTE_RESULT_CACHE_LIMIT = 24
const preparedCommandPaletteEntriesCache = new WeakMap<DeskItem[], Map<string, PreparedCommandPaletteEntry[]>>()
const commandPaletteSearchCache = new WeakMap<
  PreparedCommandPaletteEntry[],
  WeakMap<CommandHistoryEntry[], Map<string, CommandPaletteEntry[]>>
>()
const commandPaletteQuickViewCache = new WeakMap<
  PreparedCommandPaletteEntry[],
  WeakMap<CommandHistoryEntry[], CommandPaletteQuickView>
>()

const QUICK_ACTION_PRIORITY: Partial<
  Record<CommandPaletteActionEntry['action'], (entry: CommandPaletteActionEntry) => number>
> = {
  open_data_tools: () => 0,
  create_item: (entry) => {
    if (entry.itemType === 'app') {
      return 1
    }

    if (entry.itemType === 'workflow') {
      return 2
    }

    return 20
  },
  clear_recent_items: () => 3,
  clear_command_history: () => 4,
  clear_default_workflow: (entry) => (entry.workflowId ? 120 : 5),
  create_from_starter_template: (entry) => (entry.templateId === 'project-web' ? 6 : 40),
  create_from_workflow_template: (entry) => (entry.templateId === 'frontend-start' ? 7 : 41),
}

function compactValue(value: string) {
  return normalizeSearchQuery(value).replace(/\s+/g, '')
}

function buildItemSubtitle(item: DeskItem) {
  const detail = item.description.trim() || getItemTarget(item).trim()
  return detail ? `${ITEM_TYPE_LABELS[item.type]} · ${detail}` : ITEM_TYPE_LABELS[item.type]
}

function buildItemEntry(item: DeskItem): CommandPaletteItemEntry {
  const keywords = [
    item.name,
    item.description,
    item.type,
    ITEM_TYPE_LABELS[item.type],
    ...item.tags,
    getItemTarget(item),
  ]

  return {
    id: `item:${item.id}`,
    kind: 'item',
    item,
    title: item.name,
    subtitle: buildItemSubtitle(item),
    keywords,
    searchText: keywords.join(' '),
  }
}

function buildRouteEntry(route: (typeof NAV_ITEMS)[number]): CommandPaletteRouteEntry {
  const keywords = [route.label, route.to, ...(route.keywords ?? []), '导航', '页面']

  return {
    id: `route:${route.to}`,
    kind: 'route',
    route: route.to,
    title: route.label,
    subtitle: '导航 · 页面',
    keywords,
    searchText: keywords.join(' '),
  }
}

function buildActionEntry(entry: Omit<CommandPaletteActionEntry, 'kind'>): CommandPaletteActionEntry {
  return {
    ...entry,
    kind: 'action',
  }
}

function buildOpenDataToolsActionEntry(): CommandPaletteActionEntry {
  const title = '打开数据工具'

  return buildActionEntry({
    id: 'action:open_data_tools',
    action: 'open_data_tools',
    title,
    subtitle: '动作 · 备份、导入、健康检查',
    keywords: [title, '备份', '恢复', '导入', '导出', '数据库', '健康检查', 'data tools'],
    searchText: `${title} 备份 恢复 导入 导出 健康检查`,
  })
}

function buildClearRecentItemsActionEntry(): CommandPaletteActionEntry {
  const title = '清空最近使用'

  return buildActionEntry({
    id: 'action:clear_recent_items',
    action: 'clear_recent_items',
    title,
    subtitle: '动作 · 重置最近记录',
    keywords: [title, '最近', '历史', '清空', 'recent'],
    searchText: `${title} 最近 历史 清空`,
  })
}

function buildClearCommandHistoryActionEntry(): CommandPaletteActionEntry {
  const title = '清空命令历史'

  return buildActionEntry({
    id: 'action:clear_command_history',
    action: 'clear_command_history',
    title,
    subtitle: '动作 · 清空命令面板历史',
    keywords: [title, '命令面板', '历史', '学习', '清空', 'command history'],
    searchText: `${title} 命令面板 历史 清空`,
  })
}

function buildCreateItemActionEntry(itemType: ItemType): CommandPaletteActionEntry {
  const title = `新建${ITEM_TYPE_LABELS[itemType]}`

  return buildActionEntry({
    id: `action:create_item:${itemType}`,
    action: 'create_item',
    itemType,
    title,
    subtitle: `动作 · 新建${ITEM_TYPE_LABELS[itemType]}`,
    keywords: [title, itemType, ITEM_TYPE_LABELS[itemType], '添加', '创建', '表单'],
    searchText: `${title} ${ITEM_TYPE_LABELS[itemType]} 添加 创建 表单`,
  })
}

function buildStarterTemplateActionEntry(
  template: (typeof ITEM_STARTER_TEMPLATES)[number],
): CommandPaletteActionEntry {
  const title = `模板新建 · ${template.name}`

  return buildActionEntry({
    id: `action:create_from_starter_template:${template.id}`,
    action: 'create_from_starter_template',
    itemType: template.type,
    templateId: template.id,
    initialValues: itemStarterTemplateToFormValues(template),
    title,
    subtitle: `模板 · ${ITEM_TYPE_LABELS[template.type]}`,
    keywords: [
      title,
      template.name,
      template.type,
      ITEM_TYPE_LABELS[template.type],
      template.summary,
      template.description,
      ...template.tags,
      '模板',
      'starter',
    ],
    searchText: `${title} ${template.summary} ${template.description}`,
  })
}

function buildWorkflowTemplateActionEntry(
  template: (typeof WORKFLOW_TEMPLATES)[number],
): CommandPaletteActionEntry {
  const title = `模板工作流 · ${template.name}`

  return buildActionEntry({
    id: `action:create_from_workflow_template:${template.id}`,
    action: 'create_from_workflow_template',
    itemType: 'workflow',
    templateId: template.id,
    initialValues: workflowTemplateToFormValues(template),
    title,
    subtitle: '模板 · 工作流',
    keywords: [
      title,
      template.name,
      template.summary,
      template.description,
      ...template.tags,
      '工作流',
      '模板',
      'workflow',
    ],
    searchText: `${title} ${template.summary} ${template.description}`,
  })
}

function buildClearDefaultWorkflowActionEntry(
  workflow: Extract<DeskItem, { type: 'workflow' }>,
): CommandPaletteActionEntry {
  return buildActionEntry({
    id: 'action:clear_default_workflow',
    action: 'clear_default_workflow',
    title: '清空默认工作流',
    subtitle: `动作 · 当前默认是 ${workflow.name}`,
    keywords: ['清空默认工作流', workflow.name, '默认', '工作流'],
    searchText: `清空默认工作流 ${workflow.name}`,
  })
}

function buildWorkflowActionEntry(
  workflow: Extract<DeskItem, { type: 'workflow' }>,
  defaultWorkflowId: string | null,
): CommandPaletteActionEntry {
  const isDefault = workflow.id === defaultWorkflowId
  const action = isDefault ? 'clear_default_workflow' : 'set_default_workflow'
  const title = isDefault ? `取消默认 · ${workflow.name}` : `设为默认 · ${workflow.name}`

  return buildActionEntry({
    id: `action:${action}:${workflow.id}`,
    action,
    workflowId: workflow.id,
    title,
    subtitle: '动作 · 默认工作流',
    keywords: [title, workflow.name, '默认', '工作流'],
    searchText: `${title} ${workflow.name} 默认 工作流`,
  })
}

export function createCommandPaletteEntries(items: DeskItem[], defaultWorkflowId: string | null) {
  const defaultWorkflow =
    items.find(
      (item): item is Extract<DeskItem, { type: 'workflow' }> =>
        item.type === 'workflow' && item.id === defaultWorkflowId,
    ) ?? null

  return [
    buildOpenDataToolsActionEntry(),
    buildClearRecentItemsActionEntry(),
    buildClearCommandHistoryActionEntry(),
    ...ITEM_TYPES.map((itemType) => buildCreateItemActionEntry(itemType)),
    ...ITEM_STARTER_TEMPLATES.map((template) => buildStarterTemplateActionEntry(template)),
    ...WORKFLOW_TEMPLATES.map((template) => buildWorkflowTemplateActionEntry(template)),
    ...(defaultWorkflow ? [buildClearDefaultWorkflowActionEntry(defaultWorkflow)] : []),
    ...items.map((item) => buildItemEntry(item)),
    ...NAV_ITEMS.map((item) => buildRouteEntry(item)),
    ...items
      .filter((item): item is Extract<DeskItem, { type: 'workflow' }> => item.type === 'workflow')
      .map((workflow) => buildWorkflowActionEntry(workflow, defaultWorkflowId)),
  ]
}

const ITEM_SCOPE_PREFIXES: Record<string, ItemType> = {
  app: 'app',
  application: 'app',
  应用: 'app',
  project: 'project',
  项目: 'project',
  folder: 'folder',
  文件夹: 'folder',
  dir: 'folder',
  directory: 'folder',
  url: 'url',
  website: 'url',
  web: 'url',
  网站: 'url',
  script: 'script',
  脚本: 'script',
  workflow: 'workflow',
  工作流: 'workflow',
}

function parsePaletteQuery(query: string): ParsedPaletteQuery {
  const normalized = normalizeSearchQuery(query)
  const scopeMatch = normalized.match(/^([a-z\u4e00-\u9fa5_]+):(.*)$/i)

  if (!scopeMatch) {
    return { scope: null, rawQuery: query.trim() }
  }

  const [, rawScope = '', rawQuery = ''] = scopeMatch
  const scopeToken = rawScope.trim().toLowerCase()

  if (scopeToken === 'route' || scopeToken === 'nav' || scopeToken === '导航') {
    return { scope: { kind: 'route' }, rawQuery: rawQuery.trim() }
  }

  if (scopeToken === 'action' || scopeToken === '动作') {
    return { scope: { kind: 'action' }, rawQuery: rawQuery.trim() }
  }

  const itemType = ITEM_SCOPE_PREFIXES[rawScope.trim()] ?? ITEM_SCOPE_PREFIXES[scopeToken]
  if (itemType) {
    return { scope: { kind: 'item', itemType }, rawQuery: rawQuery.trim() }
  }

  if (scopeToken === 'item' || scopeToken === '条目') {
    return { scope: { kind: 'item' }, rawQuery: rawQuery.trim() }
  }

  return { scope: null, rawQuery: query.trim() }
}

export function getCommandPaletteHighlightQuery(query: string) {
  return parsePaletteQuery(query).rawQuery
}

function matchesQueryScope(entry: CommandPaletteEntry, parsedQuery: ParsedPaletteQuery) {
  if (!parsedQuery.scope) {
    return true
  }

  if (parsedQuery.scope.kind === 'route') {
    return entry.kind === 'route'
  }

  if (parsedQuery.scope.kind === 'action') {
    return entry.kind === 'action'
  }

  if (entry.kind !== 'item') {
    return false
  }

  if (!parsedQuery.scope.itemType) {
    return true
  }

  return entry.item.type === parsedQuery.scope.itemType
}

function historyKey(entry: CommandPaletteEntry) {
  if (entry.kind === 'item') {
    return `item:${entry.item.id}`
  }

  if (entry.kind === 'route') {
    return `route:${entry.route}`
  }

  return `action:${getCommandPaletteActionHistoryTarget(entry)}`
}

function getEntryHistory(entry: CommandPaletteEntry, historyMap: Map<string, CommandHistoryEntry>) {
  return historyMap.get(historyKey(entry)) ?? null
}

function historyBoost(
  entry: CommandPaletteEntry,
  historyMap: Map<string, CommandHistoryEntry>,
  hasQuery: boolean,
) {
  const history = getEntryHistory(entry, historyMap)
  if (!history) {
    return 0
  }

  const lastUsedAt = new Date(history.lastUsedAt).getTime()
  const hoursSinceLastUse =
    Number.isNaN(lastUsedAt) || lastUsedAt <= 0 ? Number.POSITIVE_INFINITY : (Date.now() - lastUsedAt) / 3_600_000
  const recencyBoost = Number.isFinite(hoursSinceLastUse)
    ? Math.max(0, (hasQuery ? 180 : 240) - Math.floor(hoursSinceLastUse * 4))
    : 0
  const useCountBoost = Math.min(history.useCount * (hasQuery ? 48 : 68), hasQuery ? 320 : 420)

  return useCountBoost + recencyBoost
}

function getHistoryUseCount(entry: CommandPaletteEntry, historyMap: Map<string, CommandHistoryEntry>) {
  return getEntryHistory(entry, historyMap)?.useCount ?? 0
}

function getHistoryLastUsedAt(entry: CommandPaletteEntry, historyMap: Map<string, CommandHistoryEntry>) {
  const timestamp = new Date(getEntryHistory(entry, historyMap)?.lastUsedAt ?? '').getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function timestampBoost(value: string | null, maxBoost: number) {
  const timestamp = new Date(value ?? '').getTime()
  if (Number.isNaN(timestamp) || timestamp <= 0) {
    return 0
  }

  const hoursSince = (Date.now() - timestamp) / 3_600_000
  return Math.max(0, maxBoost - Math.floor(hoursSince * 3))
}

function matchKindBoost(matchKind: SearchMatchKind) {
  switch (matchKind) {
    case 'raw':
      return 42
    case 'pinyin':
      return 24
    case 'initials':
      return 10
    default:
      return 0
  }
}

function titleIntentBoost(entry: CommandPaletteEntry, rawQuery: string) {
  const normalizedQuery = normalizeSearchQuery(rawQuery)
  if (!normalizedQuery) {
    return 0
  }

  const normalizedTitle = normalizeSearchQuery(entry.title)
  const compactQuery = compactValue(rawQuery)
  const compactTitle = compactValue(entry.title)

  if (normalizedTitle === normalizedQuery) {
    return 260
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 180
  }

  if (compactTitle.startsWith(compactQuery)) {
    return 120
  }

  return 0
}

function actionIntentBoost(entry: CommandPaletteEntry, rawQuery: string) {
  if (entry.kind !== 'action') {
    return 0
  }

  const normalizedQuery = normalizeSearchQuery(rawQuery)
  if (!normalizedQuery) {
    return 0
  }

  if (
    (entry.action === 'create_item' ||
      entry.action === 'create_from_starter_template' ||
      entry.action === 'create_from_workflow_template') &&
    /模板|新建|创建/.test(normalizedQuery)
  ) {
    return 90
  }

  if (
    (entry.action === 'open_data_tools' ||
      entry.action === 'clear_recent_items' ||
      entry.action === 'clear_command_history') &&
    /数据|备份|恢复|导入|导出|最近|历史|工具/.test(normalizedQuery)
  ) {
    return 80
  }

  if (
    (entry.action === 'set_default_workflow' || entry.action === 'clear_default_workflow') &&
    /默认|工作流/.test(normalizedQuery)
  ) {
    return 88
  }

  return 0
}

function entryKindPriority(entry: CommandPaletteEntry) {
  if (entry.kind === 'action') {
    return 3
  }

  if (entry.kind === 'route') {
    return 2
  }

  return 1
}

function getEntrySearchCacheKey(entry: CommandPaletteEntry) {
  if (entry.kind === 'item') {
    return `palette:item:${entry.item.id}:${entry.item.updatedAt}`
  }

  if (entry.kind === 'route') {
    return `palette:route:${entry.route}`
  }

  return `palette:action:${getCommandPaletteActionHistoryTarget(entry)}:${entry.title}`
}

function prepareEntry(entry: CommandPaletteEntry): PreparedCommandPaletteEntry {
  return {
    entry,
    searchIndex: buildSearchIndex(
      [entry.title, entry.subtitle, entry.searchText, ...entry.keywords],
      getEntrySearchCacheKey(entry),
    ),
  }
}

function sortCommandHistory(history: CommandHistoryEntry[]) {
  return [...history].sort((left, right) => {
    const rightLastUsedAt = new Date(right.lastUsedAt).getTime()
    const leftLastUsedAt = new Date(left.lastUsedAt).getTime()

    if (rightLastUsedAt !== leftLastUsedAt) {
      return rightLastUsedAt - leftLastUsedAt
    }

    if (right.useCount !== left.useCount) {
      return right.useCount - left.useCount
    }

    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

function getQuickActionPriority(entry: CommandPaletteActionEntry) {
  return QUICK_ACTION_PRIORITY[entry.action]?.(entry) ?? 100
}

function isQuickActionEntry(entry: CommandPaletteActionEntry) {
  return getQuickActionPriority(entry) < 100
}

function getPreparedEntriesCacheKey(defaultWorkflowId: string | null) {
  return defaultWorkflowId ?? '__none__'
}

function getPreparedEntriesCache(items: DeskItem[]) {
  const existingCache = preparedCommandPaletteEntriesCache.get(items)
  if (existingCache) {
    return existingCache
  }

  const nextCache = new Map<string, PreparedCommandPaletteEntry[]>()
  preparedCommandPaletteEntriesCache.set(items, nextCache)
  return nextCache
}

function setPreparedEntriesCacheResult(
  items: DeskItem[],
  cacheKey: string,
  preparedEntries: PreparedCommandPaletteEntry[],
) {
  const cache = getPreparedEntriesCache(items)
  if (cache.size >= PREPARED_COMMAND_PALETTE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  cache.set(cacheKey, preparedEntries)
}

function getPaletteSearchCache(entries: PreparedCommandPaletteEntry[], history: CommandHistoryEntry[]) {
  const historyCache = commandPaletteSearchCache.get(entries) ?? new WeakMap<CommandHistoryEntry[], Map<string, CommandPaletteEntry[]>>()
  if (!commandPaletteSearchCache.has(entries)) {
    commandPaletteSearchCache.set(entries, historyCache)
  }

  const existingCache = historyCache.get(history)
  if (existingCache) {
    return existingCache
  }

  const nextCache = new Map<string, CommandPaletteEntry[]>()
  historyCache.set(history, nextCache)
  return nextCache
}

function setPaletteSearchCacheResult(
  entries: PreparedCommandPaletteEntry[],
  history: CommandHistoryEntry[],
  cacheKey: string,
  result: CommandPaletteEntry[],
) {
  const cache = getPaletteSearchCache(entries, history)
  if (cache.size >= COMMAND_PALETTE_RESULT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  cache.set(cacheKey, result)
}

function getPaletteQuickViewCache(entries: PreparedCommandPaletteEntry[]) {
  const historyCache = commandPaletteQuickViewCache.get(entries) ?? new WeakMap<CommandHistoryEntry[], CommandPaletteQuickView>()
  if (!commandPaletteQuickViewCache.has(entries)) {
    commandPaletteQuickViewCache.set(entries, historyCache)
  }

  return historyCache
}

export function createPreparedCommandPaletteEntries(
  items: DeskItem[],
  defaultWorkflowId: string | null,
) {
  const cacheKey = getPreparedEntriesCacheKey(defaultWorkflowId)
  const cachedEntries = getPreparedEntriesCache(items).get(cacheKey)
  if (cachedEntries) {
    return cachedEntries
  }

  const preparedEntries = createCommandPaletteEntries(items, defaultWorkflowId).map(prepareEntry)
  setPreparedEntriesCacheResult(items, cacheKey, preparedEntries)
  return preparedEntries
}

export function warmCommandPalette(
  items: DeskItem[],
  history: CommandHistoryEntry[],
  defaultWorkflowId: string | null,
) {
  const preparedEntries = createPreparedCommandPaletteEntries(items, defaultWorkflowId)
  void getCommandPaletteQuickView(preparedEntries, history)
  return preparedEntries
}

export function searchCommandPaletteEntries(
  entries: PreparedCommandPaletteEntry[],
  history: CommandHistoryEntry[],
  query: string,
) {
  const cacheKey = `${getSearchRuntimeVersion()}:${normalizeSearchQuery(query)}`
  const cachedResult = getPaletteSearchCache(entries, history).get(cacheKey)
  if (cachedResult) {
    return cachedResult
  }

  const parsedQuery = parsePaletteQuery(query)
  const historyMap = new Map(history.map((entry) => [`${entry.kind}:${entry.target}`, entry]))

  const result = [...entries]
    .map((preparedEntry): RankedPaletteEntry => {
      const entry = preparedEntry.entry
      if (!matchesQueryScope(entry, parsedQuery)) {
        return {
          entry,
          score: -1,
          matchKind: null,
          historyUseCount: 0,
          historyLastUsedAt: 0,
        }
      }

      let score = parsedQuery.rawQuery ? scoreSearchIndex(preparedEntry.searchIndex, parsedQuery.rawQuery) : 96
      const matchKind = parsedQuery.rawQuery
        ? getSearchMatchKind(preparedEntry.searchIndex, parsedQuery.rawQuery)
        : null

      if (entry.kind === 'item') {
        if (entry.item.favorite) {
          score += 110
        }

        score += timestampBoost(entry.item.lastLaunchedAt, 72)
      }

      if (entry.kind === 'route') {
        score += 16
      }

      if (entry.kind === 'action') {
        score += 20
      }

      if (parsedQuery.scope?.kind === 'route' && entry.kind === 'route') score += 220
      if (parsedQuery.scope?.kind === 'action' && entry.kind === 'action') score += 220
      if (parsedQuery.scope?.kind === 'item' && entry.kind === 'item') score += 220

      score += matchKindBoost(matchKind)
      score += titleIntentBoost(entry, parsedQuery.rawQuery)
      score += actionIntentBoost(entry, parsedQuery.rawQuery)
      score += historyBoost(entry, historyMap, Boolean(parsedQuery.rawQuery))

      return {
        entry,
        score,
        matchKind,
        historyUseCount: getHistoryUseCount(entry, historyMap),
        historyLastUsedAt: getHistoryLastUsedAt(entry, historyMap),
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.historyUseCount !== left.historyUseCount) {
        return right.historyUseCount - left.historyUseCount
      }

      if (right.historyLastUsedAt !== left.historyLastUsedAt) {
        return right.historyLastUsedAt - left.historyLastUsedAt
      }

      if (entryKindPriority(right.entry) !== entryKindPriority(left.entry)) {
        return entryKindPriority(right.entry) - entryKindPriority(left.entry)
      }

      return left.entry.title.localeCompare(right.entry.title, 'zh-CN')
    })
    .map((entry) => entry.entry)

  setPaletteSearchCacheResult(entries, history, cacheKey, result)
  return result
}

export function getPreparedCommandPaletteEntryMatchKind(
  entry: PreparedCommandPaletteEntry,
  query: string,
): SearchMatchKind {
  return getSearchMatchKind(entry.searchIndex, parsePaletteQuery(query).rawQuery)
}

export function getCommandPaletteQuickView(
  entries: PreparedCommandPaletteEntry[],
  history: CommandHistoryEntry[],
) {
  const quickViewCache = getPaletteQuickViewCache(entries)
  const cachedQuickView = quickViewCache.get(history)
  if (cachedQuickView) {
    return cachedQuickView
  }

  const normalizedEntries = entries.map((entry) => entry.entry)
  const historyMap = new Map(normalizedEntries.map((entry) => [historyKey(entry), entry]))
  const recentCommands = sortCommandHistory(history)
    .map((entry) => historyMap.get(`${entry.kind}:${entry.target}`) ?? null)
    .filter((entry): entry is CommandPaletteEntry => entry !== null)
    .slice(0, 6)

  const recentKeys = new Set(recentCommands.map((entry) => entry.id))
  const favoriteItems = normalizedEntries
    .filter((entry): entry is CommandPaletteItemEntry => entry.kind === 'item' && entry.item.favorite)
    .filter((entry) => !recentKeys.has(entry.id))
    .slice(0, 6)

  const quickRoutes = normalizedEntries
    .filter((entry): entry is CommandPaletteRouteEntry => entry.kind === 'route')
    .slice(0, 8)

  const quickActions = normalizedEntries
    .filter((entry): entry is CommandPaletteActionEntry => entry.kind === 'action')
    .filter(isQuickActionEntry)
    .sort((left, right) => {
      const leftPriority = getQuickActionPriority(left)
      const rightPriority = getQuickActionPriority(right)

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.title.localeCompare(right.title, 'zh-CN')
    })
    .slice(0, 8)

  const quickView = { recentCommands, favoriteItems, quickRoutes, quickActions }
  quickViewCache.set(history, quickView)
  return quickView
}
export { toCommandHistoryPayload }
