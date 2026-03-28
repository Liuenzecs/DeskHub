import {
  AppWindow,
  Clock3,
  Folder,
  FolderKanban,
  Globe,
  LayoutGrid,
  TerminalSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { ItemType } from '../types/items'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  keywords?: string[]
}

export interface ResourcePageConfig {
  route: string
  type: Exclude<ItemType, 'workflow'>
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  addLabel: string
  searchPlaceholder: string
}

export const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: '导航',
    items: [
      { to: '/overview', label: '总览', icon: LayoutGrid, end: true, keywords: ['首页', 'overview'] },
      { to: '/apps', label: '应用', icon: AppWindow, keywords: ['软件', 'app'] },
      { to: '/projects', label: '项目', icon: FolderKanban, keywords: ['工程', 'project'] },
      { to: '/websites', label: '网站', icon: Globe, keywords: ['网址', 'url', 'web'] },
      { to: '/folders', label: '文件夹', icon: Folder, keywords: ['目录', 'folder'] },
      { to: '/scripts', label: '脚本', icon: TerminalSquare, keywords: ['命令', 'script'] },
    ],
  },
  {
    title: '工作流',
    items: [
      { to: '/workflows', label: '工作流', icon: Workflow, keywords: ['自动化', 'workflow'] },
      { to: '/recent', label: '最近使用', icon: Clock3, keywords: ['历史', 'recent'] },
    ],
  },
]

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

export function findNavItem(route: string) {
  return NAV_ITEMS.find((item) => item.to === route) ?? null
}

export const RESOURCE_PAGES: ResourcePageConfig[] = [
  {
    route: '/apps',
    type: 'app',
    title: '应用',
    description: '集中管理你常用的软件入口，保持桌面启动路径清爽一致。',
    emptyTitle: '还没有应用',
    emptyDescription: '把常用软件放进 DeskHub，之后就能直接搜索或一键打开。',
    addLabel: '添加应用',
    searchPlaceholder: '按名称、标签或路径筛选应用',
  },
  {
    route: '/projects',
    type: 'project',
    title: '项目',
    description: '把开发项目和启动命令收在同一处，进入工作状态更直接。',
    emptyTitle: '还没有项目',
    emptyDescription: '添加一个项目后，可以直接打开目录或运行开发命令。',
    addLabel: '添加项目',
    searchPlaceholder: '按名称、标签、路径或命令筛选项目',
  },
  {
    route: '/websites',
    type: 'url',
    title: '网站',
    description: '把 GitHub、文档和工作后台整齐放在一个工作台里。',
    emptyTitle: '还没有网站',
    emptyDescription: '添加一个常用网址后，就能从 DeskHub 直接跳转。',
    addLabel: '添加网站',
    searchPlaceholder: '按名称、标签或网址筛选网站',
  },
  {
    route: '/folders',
    type: 'folder',
    title: '文件夹',
    description: '常开目录不再埋在资源管理器里，统一收进 DeskHub。',
    emptyTitle: '还没有文件夹',
    emptyDescription: '添加常用文件夹，让资料和工作目录始终一键可达。',
    addLabel: '添加文件夹',
    searchPlaceholder: '按名称、标签或路径筛选文件夹',
  },
  {
    route: '/scripts',
    type: 'script',
    title: '脚本',
    description: '把常用命令脚本集中起来，减少重复敲命令的时间。',
    emptyTitle: '还没有脚本',
    emptyDescription: '添加一个命令或脚本入口后，就能从这里快速触发。',
    addLabel: '添加脚本',
    searchPlaceholder: '按名称、标签或命令筛选脚本',
  },
]
