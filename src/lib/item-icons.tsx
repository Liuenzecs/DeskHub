import {
  AppWindow,
  BriefcaseBusiness,
  Chrome,
  Code2,
  Database,
  Folder,
  FolderKanban,
  Globe,
  Package,
  Rocket,
  TerminalSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ItemType } from '../types/items'

export interface ItemIconOption {
  key: string
  label: string
  icon: LucideIcon
  keywords: string[]
  recommendedTypes: ItemType[]
}

export const ITEM_ICON_OPTIONS: ItemIconOption[] = [
  {
    key: 'app',
    label: '应用窗格',
    icon: AppWindow,
    keywords: ['app', '应用', '软件', '窗口'],
    recommendedTypes: ['app'],
  },
  {
    key: 'project',
    label: '项目文件夹',
    icon: FolderKanban,
    keywords: ['project', '项目', '工程'],
    recommendedTypes: ['project'],
  },
  {
    key: 'folder',
    label: '文件夹',
    icon: Folder,
    keywords: ['folder', '目录', '文件夹'],
    recommendedTypes: ['folder'],
  },
  {
    key: 'website',
    label: '网站',
    icon: Globe,
    keywords: ['url', 'website', '网站', '网页'],
    recommendedTypes: ['url'],
  },
  {
    key: 'script',
    label: '脚本终端',
    icon: TerminalSquare,
    keywords: ['script', '命令', '脚本', '终端'],
    recommendedTypes: ['script'],
  },
  {
    key: 'workflow',
    label: '工作流',
    icon: Workflow,
    keywords: ['workflow', '自动化', '工作流'],
    recommendedTypes: ['workflow'],
  },
  {
    key: 'rocket',
    label: '火箭',
    icon: Rocket,
    keywords: ['rocket', '火箭', '启动', '快速'],
    recommendedTypes: ['app', 'project', 'script', 'workflow'],
  },
  {
    key: 'code',
    label: '代码',
    icon: Code2,
    keywords: ['code', '代码', '开发'],
    recommendedTypes: ['project', 'script'],
  },
  {
    key: 'browser',
    label: '浏览器',
    icon: Chrome,
    keywords: ['browser', 'chrome', '浏览器'],
    recommendedTypes: ['url', 'app'],
  },
  {
    key: 'database',
    label: '数据库',
    icon: Database,
    keywords: ['database', 'db', '数据库'],
    recommendedTypes: ['project', 'workflow', 'script'],
  },
  {
    key: 'briefcase',
    label: '工具箱',
    icon: BriefcaseBusiness,
    keywords: ['briefcase', 'work', '工作', '工具箱'],
    recommendedTypes: ['app', 'project', 'workflow'],
  },
  {
    key: 'package',
    label: '包裹',
    icon: Package,
    keywords: ['package', 'box', '依赖', '包'],
    recommendedTypes: ['project', 'app'],
  },
]

const ITEM_ICON_OPTIONS_BY_KEY = new Map(ITEM_ICON_OPTIONS.map((option) => [option.key, option]))

const DEFAULT_ICON_KEYS: Record<ItemType, string> = {
  app: 'app',
  project: 'project',
  folder: 'folder',
  url: 'website',
  script: 'script',
  workflow: 'workflow',
}

function getDefaultIconOption(type: ItemType) {
  return ITEM_ICON_OPTIONS_BY_KEY.get(DEFAULT_ICON_KEYS[type]) ?? ITEM_ICON_OPTIONS[0]
}

export function getItemIconOptions(type?: ItemType) {
  if (!type) {
    return ITEM_ICON_OPTIONS
  }

  return [...ITEM_ICON_OPTIONS].sort((left, right) => {
    const leftRecommended = left.recommendedTypes.includes(type)
    const rightRecommended = right.recommendedTypes.includes(type)

    if (leftRecommended !== rightRecommended) {
      return Number(rightRecommended) - Number(leftRecommended)
    }

    return left.label.localeCompare(right.label, 'zh-CN')
  })
}

export function hasItemIconOption(iconName?: string | null) {
  const normalizedIconName = iconName?.trim()
  return normalizedIconName ? ITEM_ICON_OPTIONS_BY_KEY.has(normalizedIconName) : false
}

export function getItemIconOption(type: ItemType, iconName?: string | null) {
  const normalizedIconName = iconName?.trim()
  if (normalizedIconName) {
    return ITEM_ICON_OPTIONS_BY_KEY.get(normalizedIconName) ?? getDefaultIconOption(type)
  }

  return getDefaultIconOption(type)
}

export function getItemIconLabel(type: ItemType, iconName?: string | null) {
  const normalizedIconName = iconName?.trim()
  if (normalizedIconName && ITEM_ICON_OPTIONS_BY_KEY.has(normalizedIconName)) {
    return getItemIconOption(type, normalizedIconName).label
  }

  if (normalizedIconName) {
    return `自定义 · ${normalizedIconName}`
  }

  return `${getDefaultIconOption(type).label}（默认）`
}

export function renderItemIcon(type: ItemType, className: string, iconName?: string | null): ReactNode {
  const Icon = getItemIconOption(type, iconName).icon
  return <Icon className={className} />
}
