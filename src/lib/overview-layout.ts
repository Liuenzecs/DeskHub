import type {
  OverviewLayoutPayload,
  OverviewLayoutTemplate,
  OverviewSectionId,
  OverviewWorkflowLinkMode,
} from '../types/items'

export interface OverviewSectionDefinition {
  id: OverviewSectionId
  title: string
  description: string
}

export interface OverviewLayoutPreset {
  id: string
  title: string
  description: string
  sectionOrder: OverviewSectionId[]
  hiddenSections: OverviewSectionId[]
}

export interface ResolvedOverviewLayout {
  id: string
  kind: 'preset' | 'template' | 'custom'
  title: string
}

export const OVERVIEW_SECTION_ORDER_DEFAULT: OverviewSectionId[] = [
  'recent',
  'favorites',
  'workflows',
  'library',
]

export const OVERVIEW_SECTION_DEFINITIONS: OverviewSectionDefinition[] = [
  {
    id: 'recent',
    title: '最近使用',
    description: '最近触发过的条目，适合快速续上当前工作状态。',
  },
  {
    id: 'favorites',
    title: '收藏',
    description: '你固定保留在桌面工作台里的高频入口。',
  },
  {
    id: 'workflows',
    title: '工作流',
    description: '把多步启动动作组织成一条可重复执行的链路。',
  },
  {
    id: 'library',
    title: '资源库概览',
    description: '按类型查看当前工作台里沉淀下来的入口规模。',
  },
]

export const OVERVIEW_SECTION_LABELS = Object.fromEntries(
  OVERVIEW_SECTION_DEFINITIONS.map((section) => [section.id, section.title]),
) as Record<OverviewSectionId, string>

export const OVERVIEW_LAYOUT_PRESETS: OverviewLayoutPreset[] = [
  {
    id: 'balanced',
    title: '均衡',
    description: '保留全部区块，适合日常通用工作台。',
    sectionOrder: ['recent', 'favorites', 'workflows', 'library'],
    hiddenSections: [],
  },
  {
    id: 'focus',
    title: '专注启动',
    description: '把收藏和最近放在最前面，弱化资源库概览。',
    sectionOrder: ['favorites', 'recent', 'workflows', 'library'],
    hiddenSections: ['library'],
  },
  {
    id: 'automation',
    title: '流程优先',
    description: '优先展示工作流和最近执行记录，适合开发开工流。',
    sectionOrder: ['workflows', 'recent', 'favorites', 'library'],
    hiddenSections: [],
  },
  {
    id: 'catalog',
    title: '资源盘点',
    description: '把资源库概览提到最前，适合集中整理条目。',
    sectionOrder: ['library', 'favorites', 'recent', 'workflows'],
    hiddenSections: [],
  },
]

export const OVERVIEW_WORKFLOW_LINK_MODE_LABELS: Record<OverviewWorkflowLinkMode, string> = {
  none: '保持手动布局',
  prioritize_workflows: '有默认工作流时自动置顶工作流区块',
}

const OVERVIEW_LAYOUT_TEMPLATE_LIMIT = 12

function uniqueOverviewSectionIds(sectionIds: OverviewSectionId[]) {
  return sectionIds.filter((sectionId, index) => sectionIds.indexOf(sectionId) === index)
}

export function normalizeOverviewSectionOrder(sectionOrder: OverviewSectionId[]) {
  const seen = new Set<OverviewSectionId>()
  const normalized = sectionOrder.filter((sectionId) => {
    if (seen.has(sectionId)) {
      return false
    }

    seen.add(sectionId)
    return OVERVIEW_SECTION_ORDER_DEFAULT.includes(sectionId)
  })

  for (const sectionId of OVERVIEW_SECTION_ORDER_DEFAULT) {
    if (!seen.has(sectionId)) {
      normalized.push(sectionId)
    }
  }

  return normalized
}

export function normalizeOverviewHiddenSections(hiddenSections: OverviewSectionId[]) {
  return uniqueOverviewSectionIds(
    hiddenSections.filter((sectionId) => OVERVIEW_SECTION_ORDER_DEFAULT.includes(sectionId)),
  )
}

export function normalizeOverviewLayout(payload: OverviewLayoutPayload): OverviewLayoutPayload {
  return {
    sectionOrder: normalizeOverviewSectionOrder(payload.sectionOrder),
    hiddenSections: normalizeOverviewHiddenSections(payload.hiddenSections),
    layoutTemplates:
      payload.layoutTemplates === undefined
        ? undefined
        : normalizeOverviewLayoutTemplates(payload.layoutTemplates),
    workflowLinkMode: payload.workflowLinkMode ?? 'none',
  }
}

export function normalizeOverviewLayoutTemplates(layoutTemplates: OverviewLayoutTemplate[] | null | undefined) {
  if (!Array.isArray(layoutTemplates)) {
    return []
  }

  const seenIds = new Set<string>()
  const normalized: OverviewLayoutTemplate[] = []

  for (const layoutTemplate of layoutTemplates) {
    const id = layoutTemplate.id.trim()
    const name = layoutTemplate.name.trim()

    if (!id || !name || seenIds.has(id)) {
      continue
    }

    seenIds.add(id)
    normalized.push({
      id,
      name,
      sectionOrder: normalizeOverviewSectionOrder(layoutTemplate.sectionOrder),
      hiddenSections: normalizeOverviewHiddenSections(layoutTemplate.hiddenSections),
    })

    if (normalized.length >= OVERVIEW_LAYOUT_TEMPLATE_LIMIT) {
      break
    }
  }

  return normalized
}

export function getOverviewLayoutPreset(id: string) {
  return OVERVIEW_LAYOUT_PRESETS.find((preset) => preset.id === id) ?? null
}

export function resolveOverviewLayoutPreset(
  sectionOrder: OverviewSectionId[],
  hiddenSections: OverviewSectionId[],
) {
  const normalized = normalizeOverviewLayout({ sectionOrder, hiddenSections })
  return (
    OVERVIEW_LAYOUT_PRESETS.find(
      (preset) =>
        preset.sectionOrder.join('|') === normalized.sectionOrder.join('|') &&
        preset.hiddenSections.join('|') === normalized.hiddenSections.join('|'),
    ) ?? null
  )
}

export function resolveOverviewLayoutTemplate(
  sectionOrder: OverviewSectionId[],
  hiddenSections: OverviewSectionId[],
  layoutTemplates: OverviewLayoutTemplate[],
) {
  const normalized = normalizeOverviewLayout({ sectionOrder, hiddenSections })
  return (
    normalizeOverviewLayoutTemplates(layoutTemplates).find(
      (layoutTemplate) =>
        layoutTemplate.sectionOrder.join('|') === normalized.sectionOrder.join('|') &&
        layoutTemplate.hiddenSections.join('|') === normalized.hiddenSections.join('|'),
    ) ?? null
  )
}

export function resolveOverviewLayout(
  sectionOrder: OverviewSectionId[],
  hiddenSections: OverviewSectionId[],
  layoutTemplates: OverviewLayoutTemplate[],
): ResolvedOverviewLayout {
  const preset = resolveOverviewLayoutPreset(sectionOrder, hiddenSections)
  if (preset) {
    return {
      id: preset.id,
      kind: 'preset',
      title: preset.title,
    }
  }

  const layoutTemplate = resolveOverviewLayoutTemplate(sectionOrder, hiddenSections, layoutTemplates)
  if (layoutTemplate) {
    return {
      id: layoutTemplate.id,
      kind: 'template',
      title: layoutTemplate.name,
    }
  }

  return {
    id: 'custom',
    kind: 'custom',
    title: '自定义',
  }
}

export function applyOverviewWorkflowLinkMode(
  visibleSectionIds: OverviewSectionId[],
  workflowLinkMode: OverviewWorkflowLinkMode,
  hasDefaultWorkflow: boolean,
): OverviewSectionId[] {
  if (!hasDefaultWorkflow || workflowLinkMode !== 'prioritize_workflows') {
    return visibleSectionIds
  }

  return [
    'workflows',
    ...visibleSectionIds.filter((sectionId) => sectionId !== 'workflows'),
  ]
}
