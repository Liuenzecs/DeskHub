import {
  buildSearchIndex,
  getSearchRuntimeVersion,
  normalizeSearchQuery,
  scoreSearchIndex,
  type SearchIndex,
} from './search-index'
import type {
  CommandExecutionMode,
  DeskItem,
  ItemFormErrors,
  ItemFormValues,
  ItemsExportFile,
  ItemPayload,
  ItemType,
  ListSortOption,
  WorkflowConditionFailAction,
  WorkflowConditionOperator,
  WorkflowStepCondition,
  WorkflowFailureStrategy,
  WorkflowItem,
  WorkflowVariable,
  WorkflowVariableInput,
  WorkflowStep,
  WorkflowStepType,
} from '../types/items'

export const ITEM_TYPES: ItemType[] = ['app', 'project', 'url', 'folder', 'script', 'workflow']
export const WORKFLOW_STEP_TYPES: WorkflowStepType[] = ['open_path', 'open_url', 'run_command']
export const EXECUTION_MODE_OPTIONS: CommandExecutionMode[] = [
  'blocking',
  'new_terminal',
  'background',
]
export const LIST_SORT_OPTIONS: ListSortOption[] = ['recent', 'name', 'favorite']

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  app: '应用',
  project: '项目',
  folder: '文件夹',
  url: '网站',
  script: '脚本',
  workflow: '工作流',
}

export const WORKFLOW_STEP_LABELS: Record<WorkflowStepType, string> = {
  open_path: '打开路径',
  open_url: '打开网站',
  run_command: '运行命令',
}

export const EXECUTION_MODE_LABELS: Record<CommandExecutionMode, string> = {
  blocking: '阻塞等待',
  new_terminal: '新终端运行',
  background: '后台运行',
}

export const WORKFLOW_FAILURE_STRATEGY_LABELS: Record<WorkflowFailureStrategy, string> = {
  stop: '失败即停止',
  continue: '',
  retry: '',
}

WORKFLOW_FAILURE_STRATEGY_LABELS.stop = '失败即停止'
WORKFLOW_FAILURE_STRATEGY_LABELS.continue = '失败后继续'
WORKFLOW_FAILURE_STRATEGY_LABELS.retry = '失败后重试'

export const WORKFLOW_CONDITION_OPERATOR_LABELS: Record<WorkflowConditionOperator, string> = {
  equals: '等于',
  not_equals: '不等于',
  contains: '包含',
  not_contains: '不包含',
  is_empty: '为空',
  not_empty: '不为空',
}

export const WORKFLOW_CONDITION_FAIL_ACTION_LABELS: Record<WorkflowConditionFailAction, string> = {
  skip: '跳过当前步骤',
  jump: '跳转到其他步骤',
}

export const LIST_SORT_LABELS: Record<ListSortOption, string> = {
  recent: '最近使用',
  name: '名称',
  favorite: '收藏优先',
}

const ITEM_SEARCH_RESULT_CACHE_LIMIT = 24
const itemSearchResultCache = new WeakMap<DeskItem[], Map<string, DeskItem[]>>()

function timestampToNumber(value: string | null) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function normalizeTags(tags: string) {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function createWorkflowStepCondition(): WorkflowStepCondition {
  return {
    variableKey: '',
    operator: 'equals',
    value: '',
    onFalseAction: 'skip',
    jumpToStepId: null,
  }
}

function normalizeWorkflowStepCondition(
  condition?: WorkflowStepCondition | null,
): WorkflowStepCondition | null {
  if (!condition) {
    return null
  }

  return {
    variableKey: condition.variableKey.trim(),
    operator: condition.operator,
    value: condition.value.trim(),
    onFalseAction: condition.onFalseAction,
    jumpToStepId: condition.jumpToStepId?.trim() || null,
  }
}

export function sortItemsByUpdated(items: DeskItem[]) {
  return [...items].sort((left, right) => timestampToNumber(right.updatedAt) - timestampToNumber(left.updatedAt))
}

export function sortItemsByRecent(items: DeskItem[]) {
  return [...items].sort(
    (left, right) => timestampToNumber(right.lastLaunchedAt) - timestampToNumber(left.lastLaunchedAt),
  )
}

export function sortItemsByName(items: DeskItem[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function sortItemsByFavorite(items: DeskItem[]) {
  return [...items].sort((left, right) => {
    if (left.favorite !== right.favorite) {
      return Number(right.favorite) - Number(left.favorite)
    }

    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

export function sortItems(items: DeskItem[], sortOption: ListSortOption) {
  switch (sortOption) {
    case 'name':
      return sortItemsByName(items)
    case 'favorite':
      return sortItemsByFavorite(items)
    case 'recent':
    default:
      return sortItemsByRecent(items)
  }
}

export function createWorkflowStep(type: WorkflowStepType = 'open_path'): WorkflowStep {
  const id = crypto.randomUUID()

  if (type === 'open_url') {
    return { id, type, url: '', note: '', delayMs: 0, condition: null }
  }

  if (type === 'run_command') {
    return {
      id,
      type,
      command: '',
      executionMode: 'new_terminal',
      failureStrategy: 'stop',
      retryCount: 1,
      retryDelayMs: 1000,
      note: '',
      delayMs: 0,
      condition: null,
    }
  }

  return { id, type, path: '', note: '', delayMs: 0, condition: null }
}

export function cloneWorkflowStep(step: WorkflowStep): WorkflowStep {
  const id = crypto.randomUUID()

  if (step.type === 'open_url') {
    return {
      ...step,
      id,
      url: step.url,
      note: step.note,
      delayMs: step.delayMs,
      condition: normalizeWorkflowStepCondition(step.condition),
    }
  }

  if (step.type === 'run_command') {
    return {
      ...step,
      id,
      command: step.command,
      executionMode: step.executionMode,
      failureStrategy: step.failureStrategy ?? 'stop',
      retryCount: step.retryCount ?? 1,
      retryDelayMs: step.retryDelayMs ?? 1000,
      note: step.note,
      delayMs: step.delayMs,
      condition: normalizeWorkflowStepCondition(step.condition),
    }
  }

  return {
    ...step,
    id,
    path: step.path,
    note: step.note,
    delayMs: step.delayMs,
    condition: normalizeWorkflowStepCondition(step.condition),
  }
}

export function createWorkflowVariable(): WorkflowVariable {
  return {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    defaultValue: '',
    required: false,
  }
}

export function cloneWorkflowVariable(variable: WorkflowVariable): WorkflowVariable {
  return {
    ...variable,
    id: crypto.randomUUID(),
  }
}

export function createDuplicateItemName(name: string) {
  const trimmed = name.trim()
  const match = trimmed.match(/^(.*)\s副本(?:\s(\d+))?$/)

  if (!match) {
    return `${trimmed} 副本`
  }

  const baseName = match[1]?.trim() || trimmed
  const copyIndex = Number(match[2] ?? '1')
  return `${baseName} 副本 ${copyIndex + 1}`
}

export function createEmptyFormValues(type: ItemType = 'app'): ItemFormValues {
  return {
    name: '',
    type,
    description: '',
    tags: '',
    icon: '',
    favorite: false,
    launchTarget: '',
    projectPath: '',
    devCommand: '',
    path: '',
    url: '',
    command: '',
    executionMode: 'new_terminal',
    variables: [],
    steps: type === 'workflow' ? [createWorkflowStep()] : [],
  }
}

export function itemToFormValues(item: DeskItem): ItemFormValues {
  const base = {
    name: item.name,
    type: item.type,
    description: item.description,
    tags: item.tags.join(', '),
    icon: item.icon,
    favorite: item.favorite,
    launchTarget: '',
    projectPath: '',
    devCommand: '',
    path: '',
    url: '',
    command: '',
    executionMode: 'new_terminal' as CommandExecutionMode,
    variables: [] as WorkflowVariable[],
    steps: [] as WorkflowStep[],
  }

  switch (item.type) {
    case 'app':
      return { ...base, launchTarget: item.launchTarget }
    case 'project':
      return { ...base, projectPath: item.projectPath, devCommand: item.devCommand }
    case 'folder':
      return { ...base, path: item.path }
    case 'url':
      return { ...base, url: item.url }
    case 'script':
      return { ...base, command: item.command, executionMode: item.executionMode }
    case 'workflow': {
      return {
        ...base,
        variables: (item.variables ?? []).map((variable) => ({ ...variable })),
        steps: item.steps.map((step) =>
          step.type === 'run_command'
            ? {
                ...step,
                failureStrategy: step.failureStrategy ?? 'stop',
                retryCount: step.retryCount ?? 1,
                retryDelayMs: step.retryDelayMs ?? 1000,
                condition: normalizeWorkflowStepCondition(step.condition),
              }
            : {
                ...step,
                condition: normalizeWorkflowStepCondition(step.condition),
              },
        ),
      }
    }
  }
}

export function formValuesToPayload(values: ItemFormValues): ItemPayload {
  const base = {
    name: values.name.trim(),
    type: values.type,
    description: values.description.trim(),
    tags: normalizeTags(values.tags),
    icon: values.icon.trim(),
    favorite: values.favorite,
  }

  switch (values.type) {
    case 'app':
      return { ...base, type: 'app', launchTarget: values.launchTarget.trim() }
    case 'project':
      return {
        ...base,
        type: 'project',
        projectPath: values.projectPath.trim(),
        devCommand: values.devCommand.trim(),
      }
    case 'folder':
      return { ...base, type: 'folder', path: values.path.trim() }
    case 'url':
      return { ...base, type: 'url', url: values.url.trim() }
    case 'script':
      return {
        ...base,
        type: 'script',
        command: values.command.trim(),
        executionMode: values.executionMode,
      }
    case 'workflow': {
      return {
        ...base,
        type: 'workflow',
        variables: values.variables.map((variable) => ({
          ...variable,
          key: variable.key.trim(),
          label: variable.label.trim(),
          defaultValue: variable.defaultValue.trim(),
        })),
        steps: values.steps.map((step) => {
          if (step.type === 'open_url') {
            return {
              ...step,
              url: step.url.trim(),
              note: step.note.trim(),
              delayMs: Math.max(0, step.delayMs),
              condition: normalizeWorkflowStepCondition(step.condition),
            }
          }

          if (step.type === 'run_command') {
            return {
              ...step,
              command: step.command.trim(),
              executionMode: step.executionMode,
              failureStrategy: step.failureStrategy ?? 'stop',
              retryCount: Math.max(1, Math.floor(step.retryCount ?? 1)),
              retryDelayMs: Math.max(0, Math.floor(step.retryDelayMs ?? 1000)),
              note: step.note.trim(),
              delayMs: Math.max(0, step.delayMs),
              condition: normalizeWorkflowStepCondition(step.condition),
            }
          }

          return {
            ...step,
            path: step.path.trim(),
            note: step.note.trim(),
            delayMs: Math.max(0, step.delayMs),
            condition: normalizeWorkflowStepCondition(step.condition),
          }
        }),
      }
    }
  }
}

export function itemToDuplicatePayload(item: DeskItem): ItemPayload {
  const base = {
    name: createDuplicateItemName(item.name),
    description: item.description,
    tags: [...item.tags],
    icon: item.icon,
    favorite: false,
  }

  switch (item.type) {
    case 'app':
      return {
        ...base,
        type: 'app',
        launchTarget: item.launchTarget,
      }
    case 'project':
      return {
        ...base,
        type: 'project',
        projectPath: item.projectPath,
        devCommand: item.devCommand,
      }
    case 'folder':
      return {
        ...base,
        type: 'folder',
        path: item.path,
      }
    case 'url':
      return {
        ...base,
        type: 'url',
        url: item.url,
      }
    case 'script':
      return {
        ...base,
        type: 'script',
        command: item.command,
        executionMode: item.executionMode,
      }
    case 'workflow': {
      return {
        ...base,
        type: 'workflow',
        variables: (item.variables ?? []).map(cloneWorkflowVariable),
        steps: item.steps.map(cloneWorkflowStep),
      }
    }
  }
}

function isValidWorkflowVariableKey(key: string) {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)
}

export function isValidUrlValue(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function validateItemForm(values: ItemFormValues): ItemFormErrors {
  const errors: ItemFormErrors = {}

  if (!values.name.trim()) {
    errors.name = '名称不能为空。'
  }

  switch (values.type) {
    case 'app':
      if (!values.launchTarget.trim()) {
        errors.launchTarget = '应用启动路径不能为空。'
      }
      break
    case 'project':
      if (!values.projectPath.trim()) {
        errors.projectPath = '项目路径不能为空。'
      }
      break
    case 'folder':
      if (!values.path.trim()) {
        errors.path = '文件夹路径不能为空。'
      }
      break
    case 'url':
      if (!values.url.trim()) {
        errors.url = '网站地址不能为空。'
      } else if (!isValidUrlValue(values.url.trim())) {
        errors.url = '请输入有效的网址。'
      }
      break
    case 'script':
      if (!values.command.trim()) {
        errors.command = '命令不能为空。'
      }
      break
    case 'workflow': {
      if (
        values.variables.some((variable) => {
          const key = variable.key.trim()
          if (!key || !isValidWorkflowVariableKey(key)) {
            return true
          }

          return false
        })
      ) {
        errors.steps = '工作流变量 key 不能为空，且只能使用字母、数字和下划线，并以字母开头。'
        break
      }

      if (new Set(values.variables.map((variable) => variable.key.trim()).filter(Boolean)).size !== values.variables.length) {
        errors.steps = '工作流变量 key 不能重复。'
        break
      }

      if (!values.steps.length) {
        errors.steps = '至少保留一个工作流步骤。'
        break
      }

      const variableKeys = new Set(values.variables.map((variable) => variable.key.trim()).filter(Boolean))
      const stepIds = new Set(values.steps.map((step) => step.id))

      for (const step of values.steps) {
        if (step.type === 'run_command') {
          if (step.failureStrategy === 'retry' && (step.retryCount < 1 || Number.isNaN(step.retryCount))) {
            errors.steps = '重试步骤的 retryCount 必须至少为 1。'
            break
          }

          if (step.retryDelayMs < 0 || Number.isNaN(step.retryDelayMs)) {
            errors.steps = '重试间隔必须是大于等于 0 的数字。'
            break
          }
        }

        const condition = normalizeWorkflowStepCondition(step.condition)
        if (!condition) {
          continue
        }

        if (!condition.variableKey || !variableKeys.has(condition.variableKey)) {
          errors.steps = '条件执行必须引用一个已定义的工作流变量。'
          break
        }

        if (
          condition.operator !== 'is_empty' &&
          condition.operator !== 'not_empty' &&
          !condition.value
        ) {
          errors.steps = '条件执行需要填写比较值。'
          break
        }

        if (condition.onFalseAction === 'jump') {
          if (!condition.jumpToStepId) {
            errors.steps = '跳转条件必须选择目标步骤。'
            break
          }

          if (condition.jumpToStepId === step.id) {
            errors.steps = '条件跳转不能指向当前步骤本身。'
            break
          }

          if (!stepIds.has(condition.jumpToStepId)) {
            errors.steps = '条件跳转引用了不存在的步骤。'
            break
          }
        }
      }

      if (errors.steps) {
        break
      }

      if (
        values.steps.some((step) => {
          if (step.delayMs < 0 || Number.isNaN(step.delayMs)) {
            return true
          }

          if (step.type === 'open_url') {
            return !step.url.trim() || !isValidUrlValue(step.url.trim())
          }

          if (step.type === 'run_command') {
            return !step.command.trim()
          }

          return !step.path.trim()
        })
      ) {
        errors.steps = '每个工作流步骤都需要完整且合法的内容。'
      }
      break
    }
  }

  return errors
}

export function getWorkflowStepValue(step: WorkflowStep) {
  if (step.type === 'open_url') {
    return step.url
  }

  if (step.type === 'run_command') {
    return step.command
  }

  return step.path
}

export function getItemTarget(item: DeskItem) {
  switch (item.type) {
    case 'app':
      return item.launchTarget
    case 'project':
      return item.devCommand ? `${item.projectPath} · ${item.devCommand}` : item.projectPath
    case 'folder':
      return item.path
    case 'url':
      return item.url
    case 'script':
      return `${item.command} · ${EXECUTION_MODE_LABELS[item.executionMode]}`
    case 'workflow':
      return `${item.steps.length} 个步骤 · ${(item.variables ?? []).length} 个变量`
  }
}

function collectSearchFields(item: DeskItem) {
  const baseFields = [item.name, item.description, item.type, ITEM_TYPE_LABELS[item.type], ...item.tags]

  switch (item.type) {
    case 'app':
      return [...baseFields, item.launchTarget]
    case 'project':
      return [...baseFields, item.projectPath, item.devCommand]
    case 'folder':
      return [...baseFields, item.path]
    case 'url':
      return [...baseFields, item.url]
    case 'script':
      return [...baseFields, item.command, EXECUTION_MODE_LABELS[item.executionMode]]
    case 'workflow':
      return [
        ...baseFields,
        ...(item.variables ?? []).flatMap((variable) => [variable.key, variable.label, variable.defaultValue]),
        ...item.steps.map((step) => getWorkflowStepValue(step)),
      ]
  }
}

function getItemSearchCacheKey(item: DeskItem) {
  return `item-search:${item.id}:${item.updatedAt}`
}

function getItemSearchResultCache(items: DeskItem[]) {
  const existingCache = itemSearchResultCache.get(items)
  if (existingCache) {
    return existingCache
  }

  const nextCache = new Map<string, DeskItem[]>()
  itemSearchResultCache.set(items, nextCache)
  return nextCache
}

function setCachedItemSearchResult(items: DeskItem[], cacheKey: string, result: DeskItem[]) {
  const cache = getItemSearchResultCache(items)
  if (cache.size >= ITEM_SEARCH_RESULT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  cache.set(cacheKey, result)
}

export function getDeskItemSearchIndex(item: DeskItem): SearchIndex {
  return buildSearchIndex(collectSearchFields(item), getItemSearchCacheKey(item))
}

export function warmDeskItemSearchIndexes(items: DeskItem[]) {
  for (const item of items) {
    getDeskItemSearchIndex(item)
  }
}

export function matchesSearch(item: DeskItem, query: string) {
  if (!query.trim()) {
    return true
  }

  return scoreSearchIndex(getDeskItemSearchIndex(item), query) > 0
}

export function searchItems(items: DeskItem[], query: string) {
  const normalizedQuery = normalizeSearchQuery(query)
  const cacheKey = `${getSearchRuntimeVersion()}:${normalizedQuery || '__recent__'}`
  const cachedResult = getItemSearchResultCache(items).get(cacheKey)

  if (cachedResult) {
    return cachedResult
  }

  if (!normalizedQuery) {
    const recentItems = sortItemsByRecent(items)
    setCachedItemSearchResult(items, cacheKey, recentItems)
    return recentItems
  }

  const result = [...items]
    .map((item) => {
      let score = scoreSearchIndex(getDeskItemSearchIndex(item), normalizedQuery)

      if (item.favorite) score += 70
      if (item.lastLaunchedAt) score += 35

      return { item, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.item.favorite !== left.item.favorite) {
        return Number(right.item.favorite) - Number(left.item.favorite)
      }

      return timestampToNumber(right.item.lastLaunchedAt) - timestampToNumber(left.item.lastLaunchedAt)
    })
    .map((entry) => entry.item)

  setCachedItemSearchResult(items, cacheKey, result)
  return result
}

export function collectItemTags(items: DeskItem[]) {
  return [...new Set(items.flatMap((item) => item.tags))].sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  )
}

export function filterItemsByTags<T extends DeskItem>(items: T[], selectedTags: string[]) {
  if (!selectedTags.length) {
    return items
  }

  const selected = new Set(selectedTags)
  return items.filter((item) => item.tags.some((tag) => selected.has(tag)))
}

export function formatTimestamp(value: string | null) {
  if (!value) {
    return '尚未启动'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未知'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatRelativeTimestamp(value: string | null) {
  if (!value) {
    return '未使用'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未知'
  }

  const delta = Date.now() - date.getTime()
  const minutes = Math.round(delta / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.round(hours / 24)
  if (days < 7) return `${days} 天前`

  return formatTimestamp(value)
}

export function isWorkflowItem(item: DeskItem): item is WorkflowItem {
  return item.type === 'workflow'
}

export function getWorkflowPreview(item: WorkflowItem, maxSteps = 4) {
  return item.steps.slice(0, maxSteps).map((step) => {
    const value = getWorkflowStepValue(step)
    const summary = value.length > 22 ? `${value.slice(0, 22)}...` : value
    const delayText = step.delayMs > 0 ? ` · ${formatDelayMs(step.delayMs)}` : ''
    return `${WORKFLOW_STEP_LABELS[step.type]} · ${summary}${delayText}`
  })
}

export function getWorkflowVariablePlaceholder(variable: Pick<WorkflowVariable, 'key'>) {
  return `{{${variable.key.trim()}}}`
}

export function createWorkflowVariableInputs(variables: WorkflowVariable[]): WorkflowVariableInput[] {
  return variables.map((variable) => ({
    key: variable.key,
    value: variable.defaultValue,
  }))
}

export function resolveWorkflowPlaceholders(
  value: string,
  inputs: Record<string, string> | Map<string, string>,
) {
  return value.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    if (inputs instanceof Map) {
      return inputs.get(key) ?? ''
    }

    return inputs[key] ?? ''
  })
}

export function formatDelayMs(delayMs: number) {
  if (delayMs < 1000) {
    return `${delayMs}ms`
  }

  const seconds = delayMs / 1000
  if (Number.isInteger(seconds)) {
    return `${seconds}s`
  }

  return `${seconds.toFixed(1)}s`
}

export function buildItemsExportFile(items: DeskItem[]): ItemsExportFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  }
}
