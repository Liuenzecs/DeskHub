import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { ArrowDown, ArrowUp, Copy, FolderOpen, Plus, RotateCcw, Search, X } from 'lucide-react'
import { useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ItemsContext } from '../app/items-context'
import { useModalDialog } from '../hooks/useModalDialog'
import { cn } from '../lib/cn'
import {
  getItemStarterTemplates,
  itemStarterTemplateToFormValues,
} from '../lib/item-templates'
import {
  getItemIconOption,
  getItemIconLabel,
  getItemIconOptions,
  hasItemIconOption,
  ITEM_ICON_OPTIONS,
  renderItemIcon,
} from '../lib/item-icons'
import { inspectProjectDirectory } from '../lib/tauri'
import {
  cloneWorkflowVariable,
  cloneWorkflowStep,
  createEmptyFormValues,
  createWorkflowStepCondition,
  createDuplicateItemName,
  createWorkflowVariable,
  createWorkflowStep,
  EXECUTION_MODE_LABELS,
  EXECUTION_MODE_OPTIONS,
  formValuesToPayload,
  getWorkflowStepValue,
  getWorkflowVariablePlaceholder,
  itemToFormValues,
  ITEM_TYPE_LABELS,
  ITEM_TYPES,
  isValidUrlValue,
  validateItemForm,
  WORKFLOW_CONDITION_FAIL_ACTION_LABELS,
  WORKFLOW_CONDITION_OPERATOR_LABELS,
  WORKFLOW_FAILURE_STRATEGY_LABELS,
  WORKFLOW_STEP_LABELS,
  WORKFLOW_STEP_TYPES,
} from '../lib/item-utils'
import { WORKFLOW_TEMPLATES, workflowTemplateToFormValues } from '../lib/workflow-templates'
import { ConfirmDialog } from './ConfirmDialog'
import type {
  CommandExecutionMode,
  DeskItem,
  ItemFormValues,
  ItemPayload,
  ItemType,
  ProjectInspectionResult,
  WorkflowFailureStrategy,
  WorkflowStep,
  WorkflowStepType,
} from '../types/items'

interface ItemFormModalProps {
  open: boolean
  item?: DeskItem | null
  allowedTypes?: ItemType[]
  initialValues?: Partial<ItemFormValues>
  existingItems?: DeskItem[]
  onClose: () => void
  onSubmit: (payload: ItemPayload) => Promise<void>
  onSaveAsNew?: (payload: ItemPayload) => Promise<void>
}

function changeWorkflowStepType(step: WorkflowStep, nextType: WorkflowStepType): WorkflowStep {
  if (nextType === 'open_url') {
    return {
      id: step.id,
      type: nextType,
      url: step.type === 'open_url' ? step.url : '',
      note: step.note,
      delayMs: step.delayMs,
      condition: step.condition ?? null,
    }
  }

  if (nextType === 'run_command') {
    return {
      id: step.id,
      type: nextType,
      command: step.type === 'run_command' ? step.command : '',
      executionMode: step.type === 'run_command' ? step.executionMode : 'new_terminal',
      failureStrategy: step.type === 'run_command' ? step.failureStrategy : 'stop',
      retryCount: step.type === 'run_command' ? step.retryCount : 1,
      retryDelayMs: step.type === 'run_command' ? step.retryDelayMs : 1000,
      note: step.note,
      delayMs: step.delayMs,
      condition: step.condition ?? null,
    }
  }

  return {
    id: step.id,
    type: nextType,
    path: step.type === 'open_path' ? step.path : '',
    note: step.note,
    delayMs: step.delayMs,
    condition: step.condition ?? null,
  }
}

function moveStep(steps: WorkflowStep[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= steps.length) {
    return steps
  }

  const nextSteps = [...steps]
  ;[nextSteps[index], nextSteps[nextIndex]] = [nextSteps[nextIndex], nextSteps[index]]
  return nextSteps
}

function insertStepAfter(steps: WorkflowStep[], index: number) {
  const currentStep = steps[index]
  const nextStep = currentStep ? createWorkflowStep(currentStep.type) : createWorkflowStep()
  return [...steps.slice(0, index + 1), nextStep, ...steps.slice(index + 1)]
}

function duplicateStep(steps: WorkflowStep[], index: number) {
  const currentStep = steps[index]
  if (!currentStep) {
    return steps
  }

  return [...steps.slice(0, index + 1), cloneWorkflowStep(currentStep), ...steps.slice(index + 1)]
}

const PICKER_STATE_KEY = 'deskhub:item-form-picker-state'
const FORM_DRAFTS_KEY = 'deskhub:item-form-drafts'
const RECENT_ICONS_KEY = 'deskhub:item-form-recent-icons'
const RECENT_ICON_LIMIT = 8
const EMPTY_ITEMS: DeskItem[] = []

type PickerField = 'launchTarget' | 'projectPath' | 'path' | 'workflowPath'

interface PickerState {
  launchTarget: string
  projectPath: string
  path: string
  workflowPath: string
}

function createEmptyPickerState(): PickerState {
  return {
    launchTarget: '',
    projectPath: '',
    path: '',
    workflowPath: '',
  }
}

function readPickerState() {
  if (typeof window === 'undefined') {
    return createEmptyPickerState()
  }

  const rawValue = window.localStorage.getItem(PICKER_STATE_KEY)
  if (!rawValue) {
    return createEmptyPickerState()
  }

  try {
    return { ...createEmptyPickerState(), ...JSON.parse(rawValue) }
  } catch {
    return createEmptyPickerState()
  }
}

function writePickerState(nextState: PickerState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PICKER_STATE_KEY, JSON.stringify(nextState))
}

function toPickerDirectory(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  return normalized.replace(/[\\/][^\\/]+$/, '')
}

function getPickerDefaultPath(field: PickerField, currentValue?: string) {
  const trimmedCurrentValue = currentValue?.trim()
  if (trimmedCurrentValue) {
    return field === 'launchTarget' ? toPickerDirectory(trimmedCurrentValue) : trimmedCurrentValue
  }

  return readPickerState()[field]
}

function rememberPickerDirectory(field: PickerField, selectedPath: string) {
  const nextDirectory = field === 'launchTarget' ? toPickerDirectory(selectedPath) : selectedPath.trim()
  if (!nextDirectory) {
    return
  }

  const nextState = { ...readPickerState(), [field]: nextDirectory }
  writePickerState(nextState)
}

function mergeTagValue(tagsValue: string, tagDraft: string) {
  const values = [tagsValue, tagDraft].filter(Boolean).join(', ')
  return values
}

function normalizeTagsForDisplay(tagsValue: string, tagDraft = '') {
  return mergeTagValue(tagsValue, tagDraft)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

type ItemFormDraftStore = Partial<Record<ItemType, ItemFormValues>>

function createStoredFormValues(type: ItemType, rawValue: Partial<ItemFormValues>) {
  const baseValues = createEmptyFormValues(type)

  return {
    ...baseValues,
    ...rawValue,
    type,
    steps:
      rawValue.steps?.length
        ? rawValue.steps.map((step) => ({ ...step }))
        : baseValues.steps,
  }
}

function readItemFormDraftStore(): ItemFormDraftStore {
  if (typeof window === 'undefined') {
    return {}
  }

  const rawValue = window.localStorage.getItem(FORM_DRAFTS_KEY)
  if (!rawValue) {
    return {}
  }

  try {
    return JSON.parse(rawValue) as ItemFormDraftStore
  } catch {
    return {}
  }
}

function writeItemFormDraftStore(nextStore: ItemFormDraftStore) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(FORM_DRAFTS_KEY, JSON.stringify(nextStore))
}

function readItemFormDraft(type: ItemType) {
  const rawDraft = readItemFormDraftStore()[type]
  if (!rawDraft) {
    return null
  }

  return createStoredFormValues(type, rawDraft)
}

function hasMeaningfulDraftContent(values: ItemFormValues) {
  if (
    values.name.trim() ||
    values.description.trim() ||
    values.tags.trim() ||
    values.icon.trim() ||
    values.favorite ||
    values.launchTarget.trim() ||
    values.projectPath.trim() ||
    values.devCommand.trim() ||
    values.path.trim() ||
    values.url.trim() ||
    values.command.trim()
  ) {
    return true
  }

  if (values.type !== 'workflow') {
    return false
  }

  if (values.steps.length > 1) {
    return true
  }

  return values.steps.some((step) => {
    if (step.delayMs > 0 || step.note.trim()) {
      return true
    }

    if (step.type === 'open_path') {
      return Boolean(step.path.trim())
    }

    if (step.type === 'open_url') {
      return Boolean(step.url.trim())
    }

    return Boolean(step.command.trim())
  })
}

function writeItemFormDraft(type: ItemType, values: ItemFormValues) {
  const nextStore = { ...readItemFormDraftStore() }
  if (hasMeaningfulDraftContent(values)) {
    nextStore[type] = createStoredFormValues(type, values)
  } else {
    delete nextStore[type]
  }
  writeItemFormDraftStore(nextStore)
}

function clearItemFormDraft(type: ItemType) {
  const nextStore = { ...readItemFormDraftStore() }
  delete nextStore[type]
  writeItemFormDraftStore(nextStore)
}

function readRecentIconKeys() {
  if (typeof window === 'undefined') {
    return [] as string[]
  }

  const rawValue = window.localStorage.getItem(RECENT_ICONS_KEY)
  if (!rawValue) {
    return [] as string[]
  }

  try {
    const values = JSON.parse(rawValue)
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return [] as string[]
  }
}

function writeRecentIconKeys(nextKeys: string[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(nextKeys))
}

function pushRecentIconKey(iconKey: string) {
  if (!hasItemIconOption(iconKey)) {
    return readRecentIconKeys()
  }

  const nextKeys = [iconKey, ...readRecentIconKeys().filter((value) => value !== iconKey)].slice(
    0,
    RECENT_ICON_LIMIT,
  )
  writeRecentIconKeys(nextKeys)
  return nextKeys
}

async function chooseExecutable(defaultPath?: string) {
  const result = await openDialog({
    title: '选择应用程序',
    multiple: false,
    directory: false,
    defaultPath,
    filters: [{ name: 'Windows 可执行文件', extensions: ['exe'] }],
  })

  return typeof result === 'string' ? result : null
}

async function chooseDirectory(title: string, defaultPath?: string) {
  const result = await openDialog({
    title,
    multiple: false,
    directory: true,
    defaultPath,
  })

  return typeof result === 'string' ? result : null
}

function FieldBrowserButton({
  ariaLabel,
  label,
  onClick,
}: {
  ariaLabel?: string
  label: string
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="btn-secondary shrink-0 gap-2 px-3 py-2"
      type="button"
      onClick={() => void onClick()}
    >
      <FolderOpen className="h-4 w-4" />
      {label}
    </button>
  )
}

export function ItemFormModal({
  open,
  item,
  allowedTypes = ITEM_TYPES,
  initialValues,
  existingItems,
  onClose,
  onSubmit,
  onSaveAsNew,
}: ItemFormModalProps) {
  const itemsContext = useContext(ItemsContext)
  const items = existingItems ?? itemsContext?.items ?? EMPTY_ITEMS
  const fixedType = allowedTypes.length === 1 ? allowedTypes[0] : null
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const [values, setValues] = useState<ItemFormValues>(createEmptyFormValues(fixedType ?? 'app'))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [iconSearch, setIconSearch] = useState('')
  const [recentIconKeys, setRecentIconKeys] = useState<string[]>(() => readRecentIconKeys())
  const [projectInspection, setProjectInspection] = useState<ProjectInspectionResult | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [draftRestored, setDraftRestored] = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  function handleModalDismiss() {
    if (submitting) {
      return
    }

    if (isDirty) {
      setCloseConfirmOpen(true)
      return
    }

    onClose()
  }

  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose: handleModalDismiss,
    initialFocusRef: nameInputRef,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    const initialType = fixedType ?? initialValues?.type ?? allowedTypes[0] ?? 'app'
    const baseValues = item ? itemToFormValues(item) : createEmptyFormValues(initialType)

    const nextInitialValues =
      item || !initialValues
        ? baseValues
        : {
            ...baseValues,
            ...initialValues,
            steps:
              initialValues.steps?.length
                ? initialValues.steps.map(cloneWorkflowStep)
                : baseValues.steps,
          }

    const nextValues =
      !item && !initialValues
        ? readItemFormDraft(initialType) ?? nextInitialValues
        : nextInitialValues

    const normalizedValues = fixedType ? { ...nextValues, type: fixedType } : nextValues

    setValues(normalizedValues)
    setErrors({})
    setSubmitting(false)
    setTagDraft('')
    setIconSearch('')
    setRecentIconKeys(readRecentIconKeys())
    setProjectInspection(null)
    setDraftRestored(Boolean(!item && !initialValues && readItemFormDraft(initialType)))
    setCloseConfirmOpen(false)
    setInitialSnapshot(JSON.stringify(formValuesToPayload(normalizedValues)))
  }, [allowedTypes, fixedType, initialValues, item, open])

  useEffect(() => {
    if (!open || item) {
      return
    }

    writeItemFormDraft(values.type, values)
  }, [item, open, values])

  const title = item
    ? `编辑${ITEM_TYPE_LABELS[item.type]}`
    : fixedType
      ? `新建${ITEM_TYPE_LABELS[fixedType]}`
      : '新建条目'

  const tagChips = normalizeTagsForDisplay(values.tags, tagDraft)
  const selectedTagSet = useMemo(() => new Set(tagChips), [tagChips])
  const recommendedTags = useMemo(() => {
    const tagWeights = new Map<string, { total: number; sameType: number }>()

    for (const item of items) {
      for (const tag of item.tags) {
        const current = tagWeights.get(tag) ?? { total: 0, sameType: 0 }
        current.total += 1
        if (item.type === values.type) {
          current.sameType += 1
        }
        tagWeights.set(tag, current)
      }
    }

    return [...tagWeights.entries()]
      .filter(([tag]) => !selectedTagSet.has(tag))
      .sort((left, right) => {
        if (right[1].sameType !== left[1].sameType) {
          return right[1].sameType - left[1].sameType
        }

        if (right[1].total !== left[1].total) {
          return right[1].total - left[1].total
        }

        return left[0].localeCompare(right[0], 'zh-CN')
      })
      .slice(0, 8)
      .map(([tag]) => tag)
  }, [items, selectedTagSet, values.type])
  const iconOptions = getItemIconOptions(values.type)
  const normalizedIconValue = values.icon.trim()
  const hasKnownIcon = hasItemIconOption(normalizedIconValue)
  const defaultIconKey = getItemIconOption(values.type).key
  const selectedIconLabel = getItemIconLabel(values.type, values.icon)
  const filteredIconOptions = useMemo(() => {
    const normalizedQuery = iconSearch.trim().toLocaleLowerCase()
    if (!normalizedQuery) {
      return iconOptions
    }

    return iconOptions.filter((option) =>
      [option.key, option.label, ...option.keywords].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      ),
    )
  }, [iconOptions, iconSearch])
  const recentIconOptions = useMemo(
    () =>
      recentIconKeys
        .map((key) => ITEM_ICON_OPTIONS.find((option) => option.key === key))
        .filter((option): option is (typeof ITEM_ICON_OPTIONS)[number] => Boolean(option))
        .filter((option) =>
          iconSearch.trim()
            ? [option.key, option.label, ...option.keywords].some((value) =>
                value.toLocaleLowerCase().includes(iconSearch.trim().toLocaleLowerCase()),
              )
            : true,
        ),
    [iconSearch, recentIconKeys],
  )
  const hasProjectInspectionInfo = Boolean(
    projectInspection &&
      (projectInspection.detectedFiles.length ||
        projectInspection.suggestedCommand ||
        projectInspection.suggestedName ||
        projectInspection.commandSuggestions?.length),
  )
  const isDirty =
    JSON.stringify(
      formValuesToPayload({
        ...(fixedType ? { ...values, type: fixedType } : values),
        tags: mergeTagValue(values.tags, tagDraft),
      }),
    ) !== initialSnapshot

  const handleValueChange = <K extends keyof ItemFormValues>(key: K, nextValue: ItemFormValues[K]) => {
    setValues((currentValues) => ({ ...currentValues, [key]: nextValue }))

    if (key === 'projectPath') {
      setProjectInspection(null)
    }

    if (key === 'url') {
      const nextUrl = String(nextValue).trim()
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors }
        if (!nextUrl || isValidUrlValue(nextUrl)) {
          delete nextErrors.url
        } else {
          nextErrors.url = '请输入有效的网址。'
        }
        return nextErrors
      })
    }
  }

  const applyProjectInspection = (inspection: ProjectInspectionResult, selectedPath: string) => {
    setProjectInspection(inspection)
    setValues((currentValues) => {
      const nextValues = { ...currentValues, projectPath: selectedPath }

      if (!currentValues.name.trim() && inspection.suggestedName) {
        nextValues.name = inspection.suggestedName
      }

      const preferredCommand = inspection.commandSuggestions?.[0] ?? inspection.suggestedCommand
      if (!currentValues.devCommand.trim() && preferredCommand) {
        nextValues.devCommand = preferredCommand
      }

      return nextValues
    })
  }

  const inspectCurrentProjectPath = async (selectedPath: string) => {
    const trimmedPath = selectedPath.trim()
    if (!trimmedPath) {
      setProjectInspection(null)
      return
    }

    setValues((currentValues) => ({ ...currentValues, projectPath: trimmedPath }))

    try {
      const inspection = await inspectProjectDirectory(trimmedPath)
      applyProjectInspection(inspection, trimmedPath)
    } catch {
      setProjectInspection(null)
    }
  }

  const commitTagDraft = () => {
    const normalizedDraft = tagDraft.trim().replace(/^,+|,+$/g, '')
    if (!normalizedDraft) {
      setTagDraft('')
      return
    }

    const nextTags = normalizeTagsForDisplay(values.tags, normalizedDraft).join(', ')
    handleValueChange('tags', nextTags)
    setTagDraft('')
  }

  const removeTag = (tag: string) => {
    const nextTags = normalizeTagsForDisplay(values.tags)
      .filter((currentTag) => currentTag !== tag)
      .join(', ')
    handleValueChange('tags', nextTags)
  }

  const addTag = (tag: string) => {
    if (!tag.trim() || selectedTagSet.has(tag)) {
      return
    }

    handleValueChange('tags', [...normalizeTagsForDisplay(values.tags), tag].join(', '))
  }

  const handleIconSelect = (iconKey: string) => {
    handleValueChange('icon', iconKey)
    setRecentIconKeys(pushRecentIconKey(iconKey))
  }

  const handleTypeChange = (nextType: ItemType) => {
    if (nextType !== 'project') {
      setProjectInspection(null)
    }

    setValues((currentValues) => {
      const nextValues = { ...currentValues, type: nextType }

      if (nextType === 'workflow' && nextValues.steps.length === 0) {
        nextValues.steps = [createWorkflowStep()]
      }

      if (nextType === 'script') {
        nextValues.executionMode = 'new_terminal'
      }

      return nextValues
    })
  }

  const handleStepChange = (index: number, nextStep: WorkflowStep) => {
    setValues((currentValues) => ({
      ...currentValues,
      steps: currentValues.steps.map((step, stepIndex) => (stepIndex === index ? nextStep : step)),
    }))
  }

  const handleVariableChange = (
    index: number,
    field: 'key' | 'label' | 'defaultValue' | 'required',
    nextValue: string | boolean,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      variables: currentValues.variables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, [field]: nextValue } : variable,
      ),
    }))
  }

  const handleBrowse = async (field: 'launchTarget' | 'projectPath' | 'path') => {
    const defaultPath = getPickerDefaultPath(
      field === 'launchTarget' ? 'launchTarget' : field,
      field === 'launchTarget'
        ? values.launchTarget
        : field === 'projectPath'
          ? values.projectPath
          : values.path,
    )
    const selectedValue =
      field === 'launchTarget'
        ? await chooseExecutable(defaultPath)
        : await chooseDirectory(field === 'projectPath' ? '选择项目目录' : '选择文件夹', defaultPath)

    if (!selectedValue) {
      return
    }

    rememberPickerDirectory(field === 'launchTarget' ? 'launchTarget' : field, selectedValue)

    if (field === 'projectPath') {
      await inspectCurrentProjectPath(selectedValue)
      return
    }

    handleValueChange(field, selectedValue)
  }

  const handleWorkflowPathBrowse = async (index: number, currentPath: string) => {
    const selectedValue = await chooseDirectory(
      '选择工作流路径',
      getPickerDefaultPath('workflowPath', currentPath),
    )

    if (!selectedValue) {
      return
    }

    rememberPickerDirectory('workflowPath', selectedValue)
    const step = values.steps[index]
    if (step?.type !== 'open_path') {
      return
    }

    handleStepChange(index, { ...step, path: selectedValue })
  }

  const handleStepExecutionModeChange = (index: number, nextMode: CommandExecutionMode) => {
    const step = values.steps[index]
    if (step?.type !== 'run_command') {
      return
    }

    handleStepChange(index, { ...step, executionMode: nextMode })
  }

  const handleStepFailureStrategyChange = (
    index: number,
    nextStrategy: WorkflowFailureStrategy,
  ) => {
    const step = values.steps[index]
    if (step?.type !== 'run_command') {
      return
    }

    handleStepChange(index, {
      ...step,
      failureStrategy: nextStrategy,
      retryCount: step.retryCount || 1,
      retryDelayMs: step.retryDelayMs || 1000,
    })
  }

  const handleStepConditionToggle = (index: number, enabled: boolean) => {
    const step = values.steps[index]
    if (!step) {
      return
    }

    handleStepChange(index, {
      ...step,
      condition: enabled ? step.condition ?? createWorkflowStepCondition() : null,
    })
  }

  const handleStepConditionChange = (
    index: number,
    field: 'variableKey' | 'operator' | 'value' | 'onFalseAction' | 'jumpToStepId',
    nextValue: string,
  ) => {
    const step = values.steps[index]
    if (!step) {
      return
    }

    const nextCondition = {
      ...(step.condition ?? createWorkflowStepCondition()),
      [field]: nextValue,
    }

    if (field === 'operator' && (nextValue === 'is_empty' || nextValue === 'not_empty')) {
      nextCondition.value = ''
    }

    if (field === 'onFalseAction' && nextValue !== 'jump') {
      nextCondition.jumpToStepId = null
    }

    handleStepChange(index, {
      ...step,
      condition: nextCondition,
    })
  }

  const applyWorkflowTemplate = (templateId: string) => {
    const template = WORKFLOW_TEMPLATES.find((entry) => entry.id === templateId)
    if (!template) {
      return
    }

    const nextTemplateValues = workflowTemplateToFormValues(template)
    setValues((currentValues) => ({
      ...currentValues,
      ...nextTemplateValues,
      type: 'workflow',
      steps:
        nextTemplateValues.steps?.map(cloneWorkflowStep) ??
        currentValues.steps.map(cloneWorkflowStep),
    }))
  }

  const applyStarterTemplate = (templateId: string) => {
    if (values.type === 'workflow') {
      return
    }

    const template = getItemStarterTemplates(values.type).find((entry) => entry.id === templateId)
    if (!template) {
      return
    }

    const nextTemplateValues = itemStarterTemplateToFormValues(template)
    setProjectInspection(null)
    setValues((currentValues) => ({
      ...currentValues,
      ...nextTemplateValues,
      type: template.type,
    }))
  }

  const clearDraft = () => {
    const resetType = fixedType ?? values.type
    const resetValues = createEmptyFormValues(resetType)
    clearItemFormDraft(resetType)
    setDraftRestored(false)
    setTagDraft('')
    setIconSearch('')
    setProjectInspection(null)
    setValues(resetValues)
    setInitialSnapshot(JSON.stringify(formValuesToPayload(resetValues)))
  }

  const handleRequestClose = () => {
    handleModalDismiss()
  }

  const handleSaveAsNew = async () => {
    if (!onSaveAsNew) {
      return
    }

    const nextValues = {
      ...(fixedType ? { ...values, type: fixedType } : values),
      tags: mergeTagValue(values.tags, tagDraft),
      name: createDuplicateItemName(values.name || item?.name || '未命名工作流'),
    }
    const nextErrors = validateItemForm(nextValues)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length) {
      return
    }

    setSubmitting(true)
    try {
      await onSaveAsNew(formValuesToPayload(nextValues))
      clearItemFormDraft(nextValues.type)
      setDraftRestored(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextValues = {
      ...(fixedType ? { ...values, type: fixedType } : values),
      tags: mergeTagValue(values.tags, tagDraft),
    }
    const nextErrors = validateItemForm(nextValues)
    setErrors(nextErrors)
    setTagDraft('')

    if (Object.keys(nextErrors).length) {
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(formValuesToPayload(nextValues))
      clearItemFormDraft(nextValues.type)
      setDraftRestored(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop overflow-y-auto" onClick={handleRequestClose}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-w-4xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div>
            <div className="modal-kicker">
              DeskHub 条目
            </div>
            <h2 className="modal-title" id={titleId}>{title}</h2>
            <p className="modal-description" id={descriptionId}>
              保存一个可以被搜索、收藏和一键启动的入口。
            </p>
          </div>
          <button aria-label="关闭表单" className="btn-icon" type="button" onClick={handleRequestClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="modal-body grid gap-5" onSubmit={handleSubmit}>
          {!item ? (
            <section className="surface-muted flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="text-sm text-[color:var(--text-muted)]">
                {draftRestored
                  ? `已恢复${ITEM_TYPE_LABELS[values.type]}草稿，继续补完后保存即可。`
                  : `当前${ITEM_TYPE_LABELS[values.type]}表单会自动暂存，避免中途丢失输入。`}
              </div>
              <button className="btn-secondary gap-2 px-3 py-2 text-xs" type="button" onClick={clearDraft}>
                <RotateCcw className="h-3.5 w-3.5" />
                清空当前类型草稿
              </button>
            </section>
          ) : null}

          <section className="modal-panel">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              基础信息
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="field-label" htmlFor="name">
                  名称
                </label>
                <input
                  id="name"
                  className="field"
                  ref={nameInputRef}
                  placeholder="例如：VS Code、主站后台、科研资料夹"
                  value={values.name}
                  onChange={(event) => handleValueChange('name', event.target.value)}
                />
                {errors.name ? <p className="mt-2 text-sm text-red-600">{errors.name}</p> : null}
              </div>

              <div>
                <label className="field-label" htmlFor="type">
                  类型
                </label>
                <select
                  id="type"
                  className="field"
                  disabled={Boolean(fixedType)}
                  value={fixedType ?? values.type}
                  onChange={(event) => handleTypeChange(event.target.value as ItemType)}
                >
                  {allowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {ITEM_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--text)]">
                <input
                  checked={values.favorite}
                  className="h-4 w-4 rounded border-slate-300"
                  type="checkbox"
                  onChange={(event) => handleValueChange('favorite', event.target.checked)}
                />
                设为收藏
              </label>

              <div className="md:col-span-2">
                <label className="field-label" htmlFor="description">
                  描述
                </label>
                <textarea
                  id="description"
                  className="field min-h-24 resize-y"
                  placeholder="说明这个入口的用途，帮助以后快速辨认。"
                  value={values.description}
                  onChange={(event) => handleValueChange('description', event.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="tag-input">
                  标签
                </label>
                <div className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2">
                  {tagChips.length ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {tagChips.map((tag) => (
                        <button
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-white"
                          type="button"
                          onClick={() => removeTag(tag)}
                        >
                          <span>{tag}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    id="tag-input"
                    className="w-full border-0 bg-transparent p-0 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
                    placeholder="输入标签后按 Enter 或逗号"
                    value={tagDraft}
                    onBlur={commitTagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault()
                        commitTagDraft()
                      }
                    }}
                  />
                </div>
                {recommendedTags.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[color:var(--text-soft)]">常用标签</span>
                    {recommendedTags.map((tag) => (
                      <button
                        key={tag}
                        className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs text-[color:var(--text-muted)] transition hover:border-[color:var(--accent)] hover:bg-white hover:text-[color:var(--accent)]"
                        type="button"
                        onClick={() => addTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className="field-label" htmlFor="icon">
                  图标
                </label>
                <div className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                        {renderItemIcon(values.type, 'h-5 w-5', values.icon)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[color:var(--text)]">当前图标</div>
                        <div className="text-sm text-[color:var(--text-muted)]">{selectedIconLabel}</div>
                      </div>
                    </div>
                    <button
                      className="btn-secondary px-3 py-2 text-xs"
                      type="button"
                      onClick={() => handleValueChange('icon', '')}
                    >
                      使用类型默认
                    </button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-[1fr,auto]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
                      <input
                        className="field pl-10"
                        placeholder="搜索图标名称、关键词或用途"
                        value={iconSearch}
                        onChange={(event) => setIconSearch(event.target.value)}
                      />
                    </label>
                    <button
                      className="btn-secondary px-3 py-2"
                      type="button"
                      onClick={() => setIconSearch('')}
                    >
                      清空搜索
                    </button>
                  </div>

                  {recentIconOptions.length ? (
                    <div className="grid gap-2">
                      <div className="text-xs font-medium text-[color:var(--text-soft)]">最近使用</div>
                      <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
                        {recentIconOptions.map((option) => (
                          <button
                            key={`recent-${option.key}`}
                            aria-label={`选择最近使用图标 ${option.label}`}
                            className={cn(
                              'group flex items-center justify-center rounded-lg border px-2 py-2 transition',
                              normalizedIconValue === option.key
                                ? 'border-[color:var(--accent)] bg-[#f5f9ff] text-[color:var(--accent)]'
                                : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-white',
                            )}
                            title={option.label}
                            type="button"
                            onClick={() => handleIconSelect(option.key)}
                          >
                            <option.icon className="h-4.5 w-4.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                    {filteredIconOptions.map((option) => {
                      const selected = hasKnownIcon
                        ? normalizedIconValue === option.key
                        : !normalizedIconValue && option.key === defaultIconKey

                      return (
                        <button
                          key={option.key}
                          aria-label={`选择图标 ${option.label}`}
                          className={cn(
                            'group flex flex-col items-center gap-2 rounded-lg border px-2 py-3 text-center transition',
                            selected
                              ? 'border-[color:var(--accent)] bg-[#f5f9ff] text-[color:var(--accent)]'
                              : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-white',
                          )}
                          type="button"
                          onClick={() => handleIconSelect(option.key)}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                            <option.icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="text-[11px] font-medium leading-4">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {!filteredIconOptions.length ? (
                    <div className="rounded-lg border border-dashed border-[color:var(--border)] px-3 py-4 text-center text-xs text-[color:var(--text-soft)]">
                      没有匹配的图标，仍然可以在下面直接输入自定义 icon key。
                    </div>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-[1fr,auto]">
                    <input
                      id="icon"
                      className="field"
                      placeholder="高级：输入自定义 icon key"
                      value={values.icon}
                      onChange={(event) => handleValueChange('icon', event.target.value)}
                    />
                    <button
                      className="btn-secondary px-3 py-2"
                      type="button"
                      onClick={() => handleValueChange('icon', '')}
                    >
                      清空
                    </button>
                  </div>

                  <p className="text-xs text-[color:var(--text-soft)]">
                    常用场景直接点上面的图标即可；留空时会按条目类型显示默认图标。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-muted p-4">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              {values.type === 'workflow' ? '工作流配置' : '启动配置'}
            </div>

            {!item && values.type !== 'workflow' ? (
              <div className="mb-4 rounded-lg border border-[color:var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--text)]">快速模板</h3>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                      先套一个高频录入模板，再把真实路径、网址或命令补进去。
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {getItemStarterTemplates(values.type).map((template) => (
                    <button
                      key={template.id}
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3 text-left transition hover:border-[color:var(--accent)] hover:bg-white"
                      type="button"
                      onClick={() => applyStarterTemplate(template.id)}
                    >
                      <div className="text-sm font-semibold text-[color:var(--text)]">{template.name}</div>
                      <div className="mt-1 text-xs text-[color:var(--text-muted)]">{template.summary}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {values.type === 'app' ? (
              <div>
                <label className="field-label" htmlFor="launchTarget">
                  应用启动路径
                </label>
                <div className="flex gap-2">
                  <input
                    id="launchTarget"
                    className="field"
                    placeholder="C:\\Program Files\\App\\app.exe"
                    value={values.launchTarget}
                    onChange={(event) => handleValueChange('launchTarget', event.target.value)}
                  />
                  <FieldBrowserButton label="选择 exe" onClick={() => handleBrowse('launchTarget')} />
                </div>
                {errors.launchTarget ? <p className="mt-2 text-sm text-red-600">{errors.launchTarget}</p> : null}
              </div>
            ) : null}

            {values.type === 'project' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="projectPath">
                    项目路径
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="projectPath"
                      className="field"
                      placeholder="C:\\dev\\deskhub"
                      value={values.projectPath}
                      onChange={(event) => handleValueChange('projectPath', event.target.value)}
                    />
                    <FieldBrowserButton label="选择目录" onClick={() => handleBrowse('projectPath')} />
                    <button
                      className="btn-secondary shrink-0 px-3 py-2"
                      disabled={!values.projectPath.trim()}
                      type="button"
                      onClick={() => void inspectCurrentProjectPath(values.projectPath)}
                    >
                      智能识别
                    </button>
                  </div>
                  {errors.projectPath ? <p className="mt-2 text-sm text-red-600">{errors.projectPath}</p> : null}
                </div>
                <div>
                  <label className="field-label" htmlFor="devCommand">
                    启动命令
                  </label>
                  <input
                    id="devCommand"
                    className="field"
                    placeholder="npm run dev"
                    value={values.devCommand}
                    onChange={(event) => handleValueChange('devCommand', event.target.value)}
                  />
                  <p className="mt-2 text-xs text-[color:var(--text-soft)]">
                    不填时，点击项目会直接打开目录。
                  </p>
                </div>

                {hasProjectInspectionInfo ? (
                  <div className="md:col-span-2 rounded-lg border border-[color:var(--border)] bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      项目识别建议
                    </div>
                    <div className="mt-2 grid gap-3 text-sm text-[color:var(--text-muted)] md:grid-cols-2">
                      <div>
                        <div className="font-medium text-[color:var(--text)]">检测到的文件</div>
                        <div className="mt-1">
                          {projectInspection?.detectedFiles.length
                            ? projectInspection.detectedFiles.join(' / ')
                            : '未识别到常见项目文件'}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <div>
                          <div className="font-medium text-[color:var(--text)]">建议名称</div>
                          <div className="mt-1">{projectInspection?.suggestedName ?? '暂无建议'}</div>
                        </div>
                        <div>
                          <div className="font-medium text-[color:var(--text)]">首选命令</div>
                          <div className="mt-1">{projectInspection?.suggestedCommand ?? '暂无建议'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {projectInspection?.suggestedName && projectInspection.suggestedName !== values.name ? (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => handleValueChange('name', projectInspection.suggestedName ?? '')}
                        >
                          应用建议名称
                        </button>
                      ) : null}
                    </div>

                    {projectInspection?.commandSuggestions?.length ? (
                      <div className="mt-3 grid gap-2">
                        <div className="text-xs font-medium text-[color:var(--text-soft)]">可用命令候选</div>
                        <div className="flex flex-wrap gap-2">
                          {projectInspection.commandSuggestions.map((commandSuggestion) => {
                            const selected = commandSuggestion === values.devCommand

                            return (
                              <button
                                key={commandSuggestion}
                                className={cn(
                                  'rounded-full border px-3 py-1.5 text-xs transition',
                                  selected
                                    ? 'border-[color:var(--accent)] bg-[#f4f8fd] text-[color:var(--accent)]'
                                    : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--accent)] hover:bg-white hover:text-[color:var(--accent)]',
                                )}
                                type="button"
                                onClick={() => handleValueChange('devCommand', commandSuggestion)}
                              >
                                {commandSuggestion}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    {!projectInspection?.commandSuggestions?.length &&
                    projectInspection?.suggestedCommand &&
                    projectInspection.suggestedCommand !== values.devCommand ? (
                      <div className="mt-3">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => handleValueChange('devCommand', projectInspection.suggestedCommand ?? '')}
                        >
                          应用建议命令
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {values.type === 'folder' ? (
              <div>
                <label className="field-label" htmlFor="path">
                  文件夹路径
                </label>
                <div className="flex gap-2">
                  <input
                    id="path"
                    className="field"
                    placeholder="C:\\Users\\you\\Documents"
                    value={values.path}
                    onChange={(event) => handleValueChange('path', event.target.value)}
                  />
                  <FieldBrowserButton label="选择目录" onClick={() => handleBrowse('path')} />
                </div>
                {errors.path ? <p className="mt-2 text-sm text-red-600">{errors.path}</p> : null}
              </div>
            ) : null}

            {values.type === 'url' ? (
              <div>
                <label className="field-label" htmlFor="url">
                  网站地址
                </label>
                <input
                  id="url"
                  className="field"
                  placeholder="https://example.com"
                  value={values.url}
                  onChange={(event) => handleValueChange('url', event.target.value)}
                />
                {errors.url ? <p className="mt-2 text-sm text-red-600">{errors.url}</p> : null}
              </div>
            ) : null}

            {values.type === 'script' ? (
              <div className="grid gap-4 md:grid-cols-[1fr,220px]">
                <div>
                  <label className="field-label" htmlFor="command">
                    命令
                  </label>
                  <textarea
                    id="command"
                    className="field min-h-24 resize-y"
                    placeholder="npm test && npm run build"
                    value={values.command}
                    onChange={(event) => handleValueChange('command', event.target.value)}
                  />
                  {errors.command ? <p className="mt-2 text-sm text-red-600">{errors.command}</p> : null}
                </div>
                <div>
                  <label className="field-label" htmlFor="executionMode">
                    执行方式
                  </label>
                  <select
                    id="executionMode"
                    className="field"
                    value={values.executionMode}
                    onChange={(event) =>
                      handleValueChange('executionMode', event.target.value as CommandExecutionMode)
                    }
                  >
                    {EXECUTION_MODE_OPTIONS.map((mode) => (
                      <option key={mode} value={mode}>
                        {EXECUTION_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-[color:var(--text-soft)]">
                    新建脚本默认会在新终端中启动，不阻塞 DeskHub。
                  </p>
                </div>
              </div>
            ) : null}

            {values.type === 'workflow' ? (
              <div className="grid gap-4">
                {!item ? (
                  <div className="rounded-lg border border-[color:var(--border)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[color:var(--text)]">从模板开始</h3>
                        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                          先套一个结构，再把路径、网址和命令改成你自己的。
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {WORKFLOW_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3 text-left transition hover:border-[color:var(--accent)] hover:bg-white"
                          type="button"
                          onClick={() => applyWorkflowTemplate(template.id)}
                        >
                          <div className="text-sm font-semibold text-[color:var(--text)]">{template.name}</div>
                          <div className="mt-1 text-xs text-[color:var(--text-muted)]">{template.summary}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border border-[color:var(--border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[color:var(--text)]">工作流变量</h3>
                      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                        用变量把同一套工作流模板复用到不同项目或环境里，步骤中可直接写
                        {' '}
                        <code className="rounded bg-[color:var(--surface-muted)] px-1 py-0.5 text-xs">
                          {'{{variableKey}}'}
                        </code>
                        。
                      </p>
                    </div>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        setValues((currentValues) => ({
                          ...currentValues,
                          variables: [...currentValues.variables, createWorkflowVariable()],
                        }))
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      添加变量
                    </button>
                  </div>

                  {values.variables.length ? (
                    <div className="mt-4 grid gap-3">
                      {values.variables.map((variable, index) => (
                        <div
                          key={variable.id}
                          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                              Variable {index + 1}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                aria-label={`复制变量 ${index + 1}`}
                                className="btn-icon"
                                type="button"
                                onClick={() =>
                                  setValues((currentValues) => ({
                                    ...currentValues,
                                    variables: [
                                      ...currentValues.variables.slice(0, index + 1),
                                      cloneWorkflowVariable(variable),
                                      ...currentValues.variables.slice(index + 1),
                                    ],
                                  }))
                                }
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                aria-label={`删除变量 ${index + 1}`}
                                className="btn-icon"
                                type="button"
                                onClick={() =>
                                  setValues((currentValues) => ({
                                    ...currentValues,
                                    variables: currentValues.variables.filter(
                                      (_, variableIndex) => variableIndex !== index,
                                    ),
                                  }))
                                }
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="field-label" htmlFor={`workflow-variable-label-${variable.id}`}>
                                变量名称
                              </label>
                              <input
                                id={`workflow-variable-label-${variable.id}`}
                                className="field"
                                placeholder="例如：项目目录"
                                value={variable.label}
                                onChange={(event) =>
                                  handleVariableChange(index, 'label', event.target.value)
                                }
                              />
                            </div>

                            <div>
                              <label className="field-label" htmlFor={`workflow-variable-key-${variable.id}`}>
                                变量 key
                              </label>
                              <input
                                id={`workflow-variable-key-${variable.id}`}
                                className="field"
                                placeholder="例如：projectPath"
                                value={variable.key}
                                onChange={(event) =>
                                  handleVariableChange(index, 'key', event.target.value)
                                }
                              />
                              <p className="mt-2 text-xs text-[color:var(--text-soft)]">
                                占位符：
                                {' '}
                                <code className="rounded bg-white px-1 py-0.5 text-[11px]">
                                  {getWorkflowVariablePlaceholder(variable)}
                                </code>
                              </p>
                            </div>

                            <div className="md:col-span-2 grid gap-3 md:grid-cols-[1fr,140px]">
                              <div>
                                <label
                                  className="field-label"
                                  htmlFor={`workflow-variable-default-${variable.id}`}
                                >
                                  默认值
                                </label>
                                <input
                                  id={`workflow-variable-default-${variable.id}`}
                                  className="field"
                                  placeholder="启动时可覆盖，不填则保持为空"
                                  value={variable.defaultValue}
                                  onChange={(event) =>
                                    handleVariableChange(index, 'defaultValue', event.target.value)
                                  }
                                />
                              </div>

                              <label className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--text)]">
                                <input
                                  checked={variable.required}
                                  className="h-4 w-4 rounded border-slate-300"
                                  type="checkbox"
                                  onChange={(event) =>
                                    handleVariableChange(index, 'required', event.target.checked)
                                  }
                                />
                                必填
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-[color:var(--border)] px-3 py-4 text-sm text-[color:var(--text-muted)]">
                      当前工作流没有变量，会直接按静态步骤执行。
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--text)]">工作流步骤</h3>
                    <p className="text-sm text-[color:var(--text-muted)]">
                      按顺序执行路径、网站或命令，每步都可以补充备注和延迟。
                    </p>
                  </div>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() =>
                      setValues((currentValues) => ({
                        ...currentValues,
                        steps: [...currentValues.steps, createWorkflowStep()],
                      }))
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    添加步骤
                  </button>
                </div>

                {values.steps.map((step, index) => (
                  <div key={step.id} className="rounded-lg border border-[color:var(--border)] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                          Step {index + 1}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                          {WORKFLOW_STEP_LABELS[step.type]}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          aria-label={`在下方插入步骤 ${index + 1}`}
                          className="btn-icon"
                          type="button"
                          onClick={() =>
                            setValues((currentValues) => ({
                              ...currentValues,
                              steps: insertStepAfter(currentValues.steps, index),
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`复制步骤 ${index + 1}`}
                          className="btn-icon"
                          type="button"
                          onClick={() =>
                            setValues((currentValues) => ({
                              ...currentValues,
                              steps: duplicateStep(currentValues.steps, index),
                            }))
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`上移步骤 ${index + 1}`}
                          className="btn-icon"
                          disabled={index === 0}
                          type="button"
                          onClick={() =>
                            setValues((currentValues) => ({
                              ...currentValues,
                              steps: moveStep(currentValues.steps, index, -1),
                            }))
                          }
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`下移步骤 ${index + 1}`}
                          className="btn-icon"
                          disabled={index === values.steps.length - 1}
                          type="button"
                          onClick={() =>
                            setValues((currentValues) => ({
                              ...currentValues,
                              steps: moveStep(currentValues.steps, index, 1),
                            }))
                          }
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`删除步骤 ${index + 1}`}
                          className="btn-icon"
                          type="button"
                          onClick={() =>
                            setValues((currentValues) => ({
                              ...currentValues,
                              steps: currentValues.steps.filter((_, stepIndex) => stepIndex !== index),
                            }))
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[180px,1fr]">
                      <div>
                        <label className="field-label" htmlFor={`step-type-${step.id}`}>
                          步骤 {index + 1}
                        </label>
                        <select
                          id={`step-type-${step.id}`}
                          className="field"
                          value={step.type}
                          onChange={(event) =>
                            handleStepChange(
                              index,
                              changeWorkflowStepType(step, event.target.value as WorkflowStepType),
                            )
                          }
                        >
                          {WORKFLOW_STEP_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {WORKFLOW_STEP_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-3">
                        <div className="grid gap-3 md:grid-cols-[1fr,220px]">
                          <div className={step.type === 'run_command' ? '' : 'md:col-span-2'}>
                            <label className="field-label" htmlFor={`step-value-${step.id}`}>
                              {WORKFLOW_STEP_LABELS[step.type]}
                            </label>
                            {step.type === 'open_path' ? (
                              <div className="flex gap-2">
                                <input
                                  id={`step-value-${step.id}`}
                                  className="field"
                                  placeholder="C:\\path\\to\\resource"
                                  value={getWorkflowStepValue(step)}
                                  onChange={(event) =>
                                    handleStepChange(index, { ...step, path: event.target.value })
                                  }
                                />
                                <FieldBrowserButton
                                  ariaLabel={`为步骤 ${index + 1} 选择目录`}
                                  label="选择目录"
                                  onClick={() => handleWorkflowPathBrowse(index, step.path)}
                                />
                              </div>
                            ) : (
                              <input
                                id={`step-value-${step.id}`}
                                className="field"
                                placeholder={
                                  step.type === 'run_command' ? 'npm run dev' : 'https://example.com'
                                }
                                value={getWorkflowStepValue(step)}
                                onChange={(event) => {
                                  if (step.type === 'run_command') {
                                    handleStepChange(index, { ...step, command: event.target.value })
                                    return
                                  }

                                  handleStepChange(index, { ...step, url: event.target.value })
                                }}
                              />
                            )}
                            {step.type === 'open_url' && step.url.trim() && !isValidUrlValue(step.url.trim()) ? (
                              <p className="mt-2 text-xs text-red-600">请输入有效的网址。</p>
                            ) : null}
                          </div>

                          {step.type === 'run_command' ? (
                            <div>
                              <label className="field-label" htmlFor={`step-mode-${step.id}`}>
                                执行方式
                              </label>
                              <select
                                id={`step-mode-${step.id}`}
                                className="field"
                                value={step.executionMode}
                                onChange={(event) =>
                                  handleStepExecutionModeChange(
                                    index,
                                    event.target.value as CommandExecutionMode,
                                  )
                                }
                              >
                                {EXECUTION_MODE_OPTIONS.map((mode) => (
                                  <option key={mode} value={mode}>
                                    {EXECUTION_MODE_LABELS[mode]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>

                        {step.type === 'run_command' ? (
                          <div className="grid gap-3 md:grid-cols-[220px,140px,180px]">
                            <div>
                              <label className="field-label" htmlFor={`step-failure-${step.id}`}>
                                失败策略
                              </label>
                              <select
                                id={`step-failure-${step.id}`}
                                className="field"
                                value={step.failureStrategy}
                                onChange={(event) =>
                                  handleStepFailureStrategyChange(
                                    index,
                                    event.target.value as WorkflowFailureStrategy,
                                  )
                                }
                              >
                                {(Object.keys(WORKFLOW_FAILURE_STRATEGY_LABELS) as WorkflowFailureStrategy[]).map(
                                  (strategy) => (
                                    <option key={strategy} value={strategy}>
                                      {WORKFLOW_FAILURE_STRATEGY_LABELS[strategy]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="field-label" htmlFor={`step-retry-count-${step.id}`}>
                                重试次数
                              </label>
                              <input
                                id={`step-retry-count-${step.id}`}
                                className="field"
                                min={1}
                                type="number"
                                value={step.retryCount}
                                disabled={step.failureStrategy !== 'retry'}
                                onChange={(event) =>
                                  handleStepChange(index, {
                                    ...step,
                                    retryCount: Math.max(1, Number(event.target.value || 1)),
                                  })
                                }
                              />
                            </div>

                            <div>
                              <label className="field-label" htmlFor={`step-retry-delay-${step.id}`}>
                                重试间隔(ms)
                              </label>
                              <input
                                id={`step-retry-delay-${step.id}`}
                                className="field"
                                min={0}
                                type="number"
                                value={step.retryDelayMs}
                                disabled={step.failureStrategy !== 'retry'}
                                onChange={(event) =>
                                  handleStepChange(index, {
                                    ...step,
                                    retryDelayMs: Math.max(0, Number(event.target.value || 0)),
                                  })
                                }
                              />
                            </div>
                          </div>
                        ) : null}

                        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[color:var(--text)]">条件执行</div>
                              <div className="text-xs text-[color:var(--text-soft)]">
                                只有满足条件时才执行当前步骤，不满足时可跳过或跳转。
                              </div>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-[color:var(--text)]">
                              <input
                                checked={Boolean(step.condition)}
                                className="h-4 w-4 rounded border-slate-300"
                                type="checkbox"
                                onChange={(event) =>
                                  handleStepConditionToggle(index, event.target.checked)
                                }
                              />
                              启用条件
                            </label>
                          </div>

                          {step.condition ? (
                            <div className="mt-3 grid gap-3">
                              <div className="grid gap-3 md:grid-cols-[1fr,180px,1fr]">
                                <div>
                                  <label className="field-label" htmlFor={`step-condition-variable-${step.id}`}>
                                    变量
                                  </label>
                                  <select
                                    id={`step-condition-variable-${step.id}`}
                                    className="field"
                                    value={step.condition.variableKey}
                                    onChange={(event) =>
                                      handleStepConditionChange(index, 'variableKey', event.target.value)
                                    }
                                  >
                                    <option value="">选择变量</option>
                                    {values.variables.map((variable) => (
                                      <option key={variable.id} value={variable.key}>
                                        {variable.label || variable.key}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="field-label" htmlFor={`step-condition-operator-${step.id}`}>
                                    条件
                                  </label>
                                  <select
                                    id={`step-condition-operator-${step.id}`}
                                    className="field"
                                    value={step.condition.operator}
                                    onChange={(event) =>
                                      handleStepConditionChange(index, 'operator', event.target.value)
                                    }
                                  >
                                    {(
                                      Object.keys(
                                        WORKFLOW_CONDITION_OPERATOR_LABELS,
                                      ) as Array<keyof typeof WORKFLOW_CONDITION_OPERATOR_LABELS>
                                    ).map((operator) => (
                                      <option key={operator} value={operator}>
                                        {WORKFLOW_CONDITION_OPERATOR_LABELS[operator]}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {step.condition.operator === 'is_empty' || step.condition.operator === 'not_empty' ? (
                                  <div className="rounded-lg border border-dashed border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-soft)]">
                                    当前条件不需要填写比较值。
                                  </div>
                                ) : (
                                  <div>
                                    <label className="field-label" htmlFor={`step-condition-value-${step.id}`}>
                                      比较值
                                    </label>
                                    <input
                                      id={`step-condition-value-${step.id}`}
                                      className="field"
                                      placeholder="例如：production"
                                      value={step.condition.value}
                                      onChange={(event) =>
                                        handleStepConditionChange(index, 'value', event.target.value)
                                      }
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="grid gap-3 md:grid-cols-[220px,1fr]">
                                <div>
                                  <label className="field-label" htmlFor={`step-condition-fail-${step.id}`}>
                                    条件不满足时
                                  </label>
                                  <select
                                    id={`step-condition-fail-${step.id}`}
                                    className="field"
                                    value={step.condition.onFalseAction}
                                    onChange={(event) =>
                                      handleStepConditionChange(index, 'onFalseAction', event.target.value)
                                    }
                                  >
                                    {(
                                      Object.keys(
                                        WORKFLOW_CONDITION_FAIL_ACTION_LABELS,
                                      ) as Array<keyof typeof WORKFLOW_CONDITION_FAIL_ACTION_LABELS>
                                    ).map((action) => (
                                      <option key={action} value={action}>
                                        {WORKFLOW_CONDITION_FAIL_ACTION_LABELS[action]}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {step.condition.onFalseAction === 'jump' ? (
                                  <div>
                                    <label className="field-label" htmlFor={`step-condition-jump-${step.id}`}>
                                      跳转目标
                                    </label>
                                    <select
                                      id={`step-condition-jump-${step.id}`}
                                      className="field"
                                      value={step.condition.jumpToStepId ?? ''}
                                      onChange={(event) =>
                                        handleStepConditionChange(index, 'jumpToStepId', event.target.value)
                                      }
                                    >
                                      <option value="">选择目标步骤</option>
                                      {values.steps
                                        .filter((candidate) => candidate.id !== step.id)
                                        .map((candidate, candidateIndex) => (
                                          <option key={candidate.id} value={candidate.id}>
                                            Step {candidateIndex + 1} · {WORKFLOW_STEP_LABELS[candidate.type]}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-soft)]">
                                    当前会直接跳过此步骤，继续执行后续流程。
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-lg border border-dashed border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-soft)]">
                              关闭后，该步骤会始终按顺序执行。
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-[1fr,180px]">
                          <div>
                            <label className="field-label" htmlFor={`step-note-${step.id}`}>
                              步骤备注
                            </label>
                            <input
                              id={`step-note-${step.id}`}
                              className="field"
                              placeholder="可选，说明这一步会做什么"
                              value={step.note}
                              onChange={(event) => handleStepChange(index, { ...step, note: event.target.value })}
                            />
                          </div>

                          <div>
                            <label className="field-label" htmlFor={`step-delay-${step.id}`}>
                              延迟（毫秒）
                            </label>
                            <input
                              id={`step-delay-${step.id}`}
                              className="field"
                              min={0}
                              placeholder="0"
                              type="number"
                              value={step.delayMs}
                              onChange={(event) =>
                                handleStepChange(index, {
                                  ...step,
                                  delayMs: Math.max(0, Number(event.target.value || 0)),
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {errors.steps ? <p className="text-sm text-red-600">{errors.steps}</p> : null}
              </div>
            ) : null}
          </section>

          <div className="modal-footer px-0 pb-0 sm:justify-between">
            <div>
              {item?.type === 'workflow' && onSaveAsNew ? (
                <button className="btn-secondary" disabled={submitting} type="button" onClick={() => void handleSaveAsNew()}>
                  另存为新工作流
                </button>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button className="btn-secondary" type="button" onClick={handleRequestClose}>
                取消
              </button>
              <button className="btn-primary" disabled={submitting} type="submit">
                {submitting ? '保存中...' : item ? '保存修改' : '创建条目'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        cancelLabel="继续编辑"
        confirmLabel="放弃修改"
        description="当前表单还有未保存的修改。确认关闭后，这些改动会被丢弃。"
        open={closeConfirmOpen}
        title="放弃未保存的修改？"
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={() => {
          setCloseConfirmOpen(false)
          onClose()
        }}
      />
    </div>
  )
}
