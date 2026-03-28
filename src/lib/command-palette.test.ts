import { describe, expect, it } from 'vitest'
import {
  createPreparedCommandPaletteEntries,
  getCommandPaletteQuickView,
  searchCommandPaletteEntries,
  toCommandHistoryPayload,
  warmCommandPalette,
} from './command-palette'
import { loadSearchTransliteration } from './search-index'
import type { CommandHistoryEntry, DeskItem } from '../types/items'

const fixtureItems: DeskItem[] = [
  {
    id: 'app-1',
    name: 'VS Code',
    type: 'app',
    description: 'Code editor',
    tags: ['daily'],
    icon: '',
    favorite: true,
    createdAt: '2026-03-24T00:00:00Z',
    updatedAt: '2026-03-24T00:00:00Z',
    lastLaunchedAt: '2026-03-24T08:00:00Z',
    launchTarget: 'C:\\VSCode\\Code.exe',
  },
  {
    id: 'workflow-1',
    name: 'Morning Routine',
    type: 'workflow',
    description: 'Open docs and tools',
    tags: ['automation'],
    icon: '',
    favorite: false,
    createdAt: '2026-03-24T00:00:00Z',
    updatedAt: '2026-03-24T00:00:00Z',
    lastLaunchedAt: null,
    variables: [],
    steps: [{ id: 'step-1', type: 'open_url', url: 'https://example.com', note: '', delayMs: 0 }],
  },
]

describe('command-palette', () => {
  it('supports item type scoped queries like app:', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, null)
    const results = searchCommandPaletteEntries(entries, [], 'app: code')

    expect(results[0]).toMatchObject({
      kind: 'item',
      item: { id: 'app-1', type: 'app' },
    })
    expect(results.every((entry) => entry.kind !== 'item' || entry.item.type === 'app')).toBe(true)
  })

  it('supports route scoped queries like route:', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, null)
    const results = searchCommandPaletteEntries(entries, [], 'route: 最近')

    expect(results[0]).toMatchObject({
      kind: 'route',
      route: '/recent',
    })
  })

  it('supports pinyin route matching for Chinese navigation labels', () => {
    return loadSearchTransliteration().then(() => {
      const entries = createPreparedCommandPaletteEntries(fixtureItems, null)
      const results = searchCommandPaletteEntries(entries, [], 'route: gongzuoliu')

      expect(results[0]).toMatchObject({
        kind: 'route',
        route: '/workflows',
      })
    })
  })

  it('exposes create item actions and records typed history targets', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, 'workflow-1')
    const results = searchCommandPaletteEntries(entries, [], 'action: 新建应用')
    const createAppAction = results.find(
      (entry) => entry.kind === 'action' && entry.action === 'create_item' && entry.itemType === 'app',
    )

    expect(createAppAction).toBeTruthy()
    expect(toCommandHistoryPayload(createAppAction!)).toEqual({
      kind: 'action',
      target: 'create_item:app',
      title: '新建应用',
    })
  })

  it('adds a global clear default workflow action when a default exists', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, 'workflow-1')
    const results = searchCommandPaletteEntries(entries, [], 'action: 清空默认')

    expect(results.some((entry) => entry.kind === 'action' && entry.title === '清空默认工作流')).toBe(true)
  })

  it('exposes starter and workflow template actions with template-specific history targets', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, null)
    const starterTemplateAction = searchCommandPaletteEntries(entries, [], 'action: 模板 web 项目').find(
      (entry) =>
        entry.kind === 'action' &&
        entry.action === 'create_from_starter_template' &&
        entry.templateId === 'project-web',
    )
    const workflowTemplateAction = searchCommandPaletteEntries(entries, [], 'action: 模板 前端开工').find(
      (entry) =>
        entry.kind === 'action' &&
        entry.action === 'create_from_workflow_template' &&
        entry.templateId === 'frontend-start',
    )

    expect(starterTemplateAction).toBeTruthy()
    expect(workflowTemplateAction).toBeTruthy()
    expect(toCommandHistoryPayload(starterTemplateAction!)).toEqual({
      kind: 'action',
      target: 'create_from_starter_template:project-web',
      title: '模板新建 · Web 项目',
    })
    expect(toCommandHistoryPayload(workflowTemplateAction!)).toEqual({
      kind: 'action',
      target: 'create_from_workflow_template:frontend-start',
      title: '模板工作流 · 前端开工',
    })
  })

  it('learns from recent command history for cleanup actions', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, null)
    const history: CommandHistoryEntry[] = [
      {
        kind: 'action',
        target: 'clear_recent_items',
        title: '清空最近使用',
        lastUsedAt: new Date().toISOString(),
        useCount: 8,
      },
    ]

    const results = searchCommandPaletteEntries(entries, history, 'action: 清空')

    expect(results[0]).toMatchObject({
      kind: 'action',
      action: 'clear_recent_items',
    })
  })

  it('prefers recent commands in the quick view and keeps favorites separate', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, null)
    const history: CommandHistoryEntry[] = [
      {
        kind: 'item',
        target: 'app-1',
        title: 'VS Code',
        lastUsedAt: '2026-03-24T09:00:00Z',
        useCount: 3,
      },
    ]

    const quickView = getCommandPaletteQuickView(entries, history)

    expect(quickView.recentCommands[0]).toMatchObject({
      kind: 'item',
      item: { id: 'app-1' },
    })
    expect(quickView.favoriteItems.some((entry) => entry.kind === 'item' && entry.item.id === 'app-1')).toBe(
      false,
    )
    expect(quickView.quickRoutes.some((entry) => entry.kind === 'route' && entry.route === '/overview')).toBe(
      true,
    )
    expect(
      quickView.quickActions.some(
        (entry) => entry.kind === 'action' && entry.action === 'clear_recent_items',
      ),
    ).toBe(true)
    expect(
      quickView.quickActions.some(
        (entry) =>
          entry.kind === 'action' &&
          entry.action === 'create_from_starter_template' &&
          entry.templateId === 'project-web',
      ),
    ).toBe(true)
    expect(
      quickView.quickActions.some(
        (entry) =>
          entry.kind === 'action' &&
          entry.action === 'create_from_workflow_template' &&
          entry.templateId === 'frontend-start',
      ),
    ).toBe(true)
  })

  it('reuses prepared entries, search results and quick view cache for the same inputs', () => {
    const entries = createPreparedCommandPaletteEntries(fixtureItems, 'workflow-1')
    const sameEntries = createPreparedCommandPaletteEntries(fixtureItems, 'workflow-1')
    const history: CommandHistoryEntry[] = [
      {
        kind: 'route',
        target: '/overview',
        title: '总览',
        lastUsedAt: '2026-03-24T09:00:00Z',
        useCount: 2,
      },
    ]

    const firstSearch = searchCommandPaletteEntries(entries, history, 'route: 总览')
    const secondSearch = searchCommandPaletteEntries(entries, history, 'route: 总览')
    const firstQuickView = getCommandPaletteQuickView(entries, history)
    const secondQuickView = getCommandPaletteQuickView(entries, history)

    expect(sameEntries).toBe(entries)
    expect(secondSearch).toBe(firstSearch)
    expect(secondQuickView).toBe(firstQuickView)
  })

  it('keeps command palette search stable for larger synthetic datasets', () => {
    const manyItems: DeskItem[] = Array.from({ length: 1200 }, (_, index) => ({
      id: `app-${index}`,
      name: index === 777 ? 'DeskHub Target Entry' : `Resource ${index}`,
      type: 'app',
      description: index === 777 ? 'special launch profile' : `Synthetic item ${index}`,
      tags: index === 777 ? ['focus', 'synthetic'] : ['synthetic'],
      icon: '',
      favorite: index % 17 === 0,
      createdAt: '2026-03-24T00:00:00Z',
      updatedAt: `2026-03-24T00:${String(index % 60).padStart(2, '0')}:00Z`,
      lastLaunchedAt: index % 19 === 0 ? `2026-03-24T08:${String(index % 60).padStart(2, '0')}:00Z` : null,
      launchTarget: `C:\\Tools\\Tool-${index}.exe`,
    }))
    const entries = createPreparedCommandPaletteEntries(manyItems, null)

    const results = searchCommandPaletteEntries(entries, [], 'target entry')

    expect(results[0]).toMatchObject({
      kind: 'item',
      item: { id: 'app-777' },
    })
  })

  it('warms command palette prepared entries together with quick view cache', () => {
    const history: CommandHistoryEntry[] = [
      {
        kind: 'item',
        target: 'app-1',
        title: 'VS Code',
        lastUsedAt: '2026-03-24T09:30:00Z',
        useCount: 5,
      },
    ]

    const warmedEntries = warmCommandPalette(fixtureItems, history, 'workflow-1')
    const sameEntries = warmCommandPalette(fixtureItems, history, 'workflow-1')
    const quickView = getCommandPaletteQuickView(warmedEntries, history)

    expect(sameEntries).toBe(warmedEntries)
    expect(quickView.recentCommands[0]).toMatchObject({
      kind: 'item',
      item: { id: 'app-1' },
    })
  })
})
