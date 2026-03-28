import type { ItemFormValues, ItemType } from '../types/items'

export interface ItemStarterTemplate {
  id: string
  type: Exclude<ItemType, 'workflow'>
  name: string
  summary: string
  description: string
  tags: string[]
  icon: string
  launchTarget?: string
  projectPath?: string
  devCommand?: string
  path?: string
  url?: string
  command?: string
  executionMode?: ItemFormValues['executionMode']
}

export const ITEM_STARTER_TEMPLATES: ItemStarterTemplate[] = [
  {
    id: 'app-editor',
    type: 'app',
    name: '代码编辑器',
    summary: '适合把 VS Code、Cursor、IDEA 这类高频桌面应用快速录入。',
    description: '高频开发入口，适合作为日常工作台常驻应用。',
    tags: ['daily', 'dev'],
    icon: 'code',
  },
  {
    id: 'app-browser',
    type: 'app',
    name: '主力浏览器',
    summary: '适合 Chrome、Edge、Arc 等桌面浏览器入口。',
    description: '浏览器主入口，可配合默认工作流和网站收藏使用。',
    tags: ['daily', 'browser'],
    icon: 'browser',
  },
  {
    id: 'project-web',
    type: 'project',
    name: 'Web 项目',
    summary: '预填常见前端项目描述和 `npm run dev` 启动方式。',
    description: '前端或全栈项目，点击后优先启动开发命令。',
    tags: ['frontend', 'daily'],
    icon: 'project',
    devCommand: 'npm run dev',
  },
  {
    id: 'project-rust',
    type: 'project',
    name: 'Rust 服务',
    summary: '适合本地服务或 CLI 工程，默认带 `cargo run`。',
    description: 'Rust 项目入口，适合后端服务或命令行工具开发。',
    tags: ['backend', 'rust'],
    icon: 'script',
    devCommand: 'cargo run',
  },
  {
    id: 'folder-assets',
    type: 'folder',
    name: '素材目录',
    summary: '适合设计稿、截图、文档等长期需要反复打开的文件夹。',
    description: '高频资料目录，方便从 DeskHub 直接进入。',
    tags: ['assets', 'docs'],
    icon: 'folder',
  },
  {
    id: 'folder-workspace',
    type: 'folder',
    name: '工作区目录',
    summary: '适合统一放项目、脚本和资料的本地工作区。',
    description: '常驻工作目录，适合作为每日开工入口。',
    tags: ['workspace', 'daily'],
    icon: 'folder',
  },
  {
    id: 'url-docs',
    type: 'url',
    name: '文档入口',
    summary: '适合项目文档、知识库或协作文档主页。',
    description: '常用文档入口，方便从命令面板和总览快速打开。',
    tags: ['docs', 'reference'],
    icon: 'website',
    url: 'https://example.com/docs',
  },
  {
    id: 'url-console',
    type: 'url',
    name: '工作后台',
    summary: '适合管理后台、监控面板或发布控制台。',
    description: '工作后台入口，适合配合工作流和最近使用记录。',
    tags: ['ops', 'dashboard'],
    icon: 'website',
    url: 'https://example.com/admin',
  },
  {
    id: 'script-dev-server',
    type: 'script',
    name: '开发服务',
    summary: '默认新终端运行，适合本地开发服务或 watcher。',
    description: '开发命令入口，适合长期运行在独立终端中的任务。',
    tags: ['dev', 'automation'],
    icon: 'script',
    command: 'npm run dev',
    executionMode: 'new_terminal',
  },
  {
    id: 'script-maintenance',
    type: 'script',
    name: '维护脚本',
    summary: '适合数据库清理、构建打包或一次性运维命令。',
    description: '维护脚本入口，适合重复执行的工程命令。',
    tags: ['ops', 'script'],
    icon: 'package',
    command: 'npm run check',
    executionMode: 'new_terminal',
  },
]

export function getItemStarterTemplates(type: Exclude<ItemType, 'workflow'>) {
  return ITEM_STARTER_TEMPLATES.filter((template) => template.type === type)
}

export function itemStarterTemplateToFormValues(template: ItemStarterTemplate): Partial<ItemFormValues> {
  return {
    type: template.type,
    name: template.name,
    description: template.description,
    tags: template.tags.join(', '),
    icon: template.icon,
    launchTarget: template.launchTarget ?? '',
    projectPath: template.projectPath ?? '',
    devCommand: template.devCommand ?? '',
    path: template.path ?? '',
    url: template.url ?? '',
    command: template.command ?? '',
    executionMode: template.executionMode ?? 'new_terminal',
    favorite: false,
  }
}
