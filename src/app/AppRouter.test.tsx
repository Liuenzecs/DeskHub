import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemsProvider } from './ItemsContext'
import { AppRouter } from './AppRouter'
import type {
  ClearCommandHistoryResponse,
  ClearDataToolHistoryResponse,
  CommandHistoryCollection,
  CommandHistoryPayload,
  DataToolHistoryCollection,
  DatabaseConsistencyReport,
  DeskItem,
  DatabaseHealthReport,
  DatabaseMaintenanceResponse,
  ExportTextReportResponse,
  FileOperationResponse,
  ImportItemsPreviewResponse,
  ImportItemsResponse,
  ItemCollection,
  ItemPayload,
  ProjectInspectionResult,
  UiSettings,
} from '../types/items'

const tauriMocks = vi.hoisted(() => ({
  getItems: vi.fn<() => Promise<ItemCollection>>(),
  getCommandHistory: vi.fn<() => Promise<CommandHistoryCollection>>(),
  getDataToolHistory: vi.fn<() => Promise<DataToolHistoryCollection>>(),
  recordCommandHistory: vi.fn(),
  recordDataToolHistory: vi.fn(),
  clearDataToolHistory: vi.fn<() => Promise<ClearDataToolHistoryResponse>>(),
  clearCommandHistory: vi.fn<() => Promise<ClearCommandHistoryResponse>>(),
  getUiSettings: vi.fn<() => Promise<UiSettings>>(),
  updateOverviewLayout: vi.fn(),
  inspectProjectDirectory: vi.fn<() => Promise<ProjectInspectionResult>>(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  deleteItems: vi.fn(),
  toggleFavorite: vi.fn(),
  setItemsFavorite: vi.fn(),
  batchEditItems: vi.fn(),
  launchItem: vi.fn(),
  launchWorkflow: vi.fn(),
  clearRecentItems: vi.fn(),
  setDefaultWorkflow: vi.fn(),
  exportItems: vi.fn(),
  previewImportItems: vi.fn<() => Promise<ImportItemsPreviewResponse>>(),
  importItems: vi.fn<() => Promise<ImportItemsResponse>>(),
  scanBrowserBookmarks: vi.fn(),
  importBrowserBookmarks: vi.fn(),
  scanProjectDirectories: vi.fn(),
  importProjectDirectories: vi.fn(),
  backupDatabase: vi.fn<() => Promise<FileOperationResponse>>(),
  restoreDatabase: vi.fn<() => Promise<FileOperationResponse>>(),
  runDatabaseHealthCheck: vi.fn<() => Promise<DatabaseHealthReport>>(),
  runDataConsistencyCheck: vi.fn<() => Promise<DatabaseConsistencyReport>>(),
  optimizeDatabase: vi.fn<() => Promise<DatabaseMaintenanceResponse>>(),
  openBackupsDirectory: vi.fn<() => Promise<FileOperationResponse>>(),
  exportTextReport: vi.fn<() => Promise<ExportTextReportResponse>>(),
  updateUiSettings: vi.fn(),
  exportStructuredReport: vi.fn(),
}))

vi.mock('../lib/tauri', () => tauriMocks)

const fixtureItems: DeskItem[] = [
  {
    id: 'app-1',
    name: 'VS Code',
    type: 'app',
    description: 'Code editor',
    tags: ['daily', 'tool'],
    icon: '',
    favorite: true,
    createdAt: '2026-03-23T00:00:00Z',
    updatedAt: '2026-03-23T00:00:00Z',
    lastLaunchedAt: '2026-03-23T09:12:00Z',
    launchTarget: 'C:\\VSCode\\Code.exe',
  },
  {
    id: 'project-1',
    name: 'DeskHub API',
    type: 'project',
    description: 'Backend workspace',
    tags: ['backend'],
    icon: '',
    favorite: false,
    createdAt: '2026-03-23T00:00:00Z',
    updatedAt: '2026-03-23T00:00:00Z',
    lastLaunchedAt: null,
    projectPath: 'C:\\dev\\deskhub',
    devCommand: 'pnpm dev',
  },
  {
    id: 'url-1',
    name: 'GitHub',
    type: 'url',
    description: 'Code hosting',
    tags: ['docs'],
    icon: '',
    favorite: false,
    createdAt: '2026-03-23T00:00:00Z',
    updatedAt: '2026-03-23T00:00:00Z',
    lastLaunchedAt: '2026-03-23T08:00:00Z',
    url: 'https://github.com',
  },
  {
    id: 'workflow-1',
    name: 'Morning Routine',
    type: 'workflow',
    description: 'Open docs and start tooling',
    tags: ['automation'],
    icon: '',
    favorite: true,
    createdAt: '2026-03-23T00:00:00Z',
    updatedAt: '2026-03-23T00:00:00Z',
    lastLaunchedAt: '2026-03-23T07:00:00Z',
    variables: [],
    steps: [
      { id: 'step-1', type: 'open_url', url: 'https://example.com', note: '', delayMs: 0 },
      {
        id: 'step-2',
        type: 'run_command',
        command: 'pnpm dev',
        executionMode: 'new_terminal',
        failureStrategy: 'stop',
        retryCount: 1,
        retryDelayMs: 1000,
        note: '',
        delayMs: 0,
        condition: null,
      },
    ],
  },
]

function materializeItemFromPayload(payload: ItemPayload): DeskItem {
  const base = {
    id: 'created-item',
    createdAt: '2026-03-24T00:00:00Z',
    updatedAt: '2026-03-24T00:00:00Z',
    lastLaunchedAt: null,
  }

  return {
    ...base,
    ...payload,
  } as DeskItem
}

function renderApp(initialEntries: string[] = ['/overview']) {
  return render(
    <ItemsProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRouter />
      </MemoryRouter>
    </ItemsProvider>,
  )
}

async function openCommandPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  return screen.findByRole('combobox', { name: '全局搜索' }, { timeout: 15000 })
}

describe('AppRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    tauriMocks.getItems.mockResolvedValue({ items: fixtureItems })
    tauriMocks.getUiSettings.mockResolvedValue({
      defaultWorkflowId: null,
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      backupRetentionCount: 7,
      diagnosticMode: false,
      lastAutoBackupAt: null,
      overviewSectionOrder: ['recent', 'favorites', 'workflows', 'library'],
      overviewHiddenSections: [],
      overviewLayoutTemplates: [],
      overviewWorkflowLinkMode: 'none',
    })
    tauriMocks.getCommandHistory.mockResolvedValue({ entries: [] })
    tauriMocks.getDataToolHistory.mockResolvedValue({ records: [] })
    tauriMocks.recordCommandHistory.mockImplementation(async (payload: CommandHistoryPayload) => ({
      ...payload,
      lastUsedAt: '2026-03-23T10:00:00Z',
      useCount: 1,
    }))
    tauriMocks.recordDataToolHistory.mockImplementation(async (payload) => ({
      id: 'history-1',
      occurredAt: '2026-03-23T10:00:00Z',
      itemNames: [],
      errors: [],
      extra: { tableCounts: {}, ...(payload.extra ?? {}) },
      ...payload,
    }))
    tauriMocks.clearDataToolHistory.mockResolvedValue({ cleared: 0 })
    tauriMocks.clearCommandHistory.mockResolvedValue({ cleared: 0 })
    tauriMocks.inspectProjectDirectory.mockResolvedValue({
      suggestedName: 'DeskHub',
      suggestedCommand: 'pnpm dev',
      commandSuggestions: ['pnpm dev', 'npm run dev'],
      detectedFiles: ['package.json'],
    })
    tauriMocks.launchItem.mockImplementation(async (id: string) => ({
      item: fixtureItems.find((item) => item.id === id)!,
      success: true,
      message: 'Launched.',
    }))
    tauriMocks.launchWorkflow.mockImplementation(async (id: string) => ({
      item: fixtureItems.find((item) => item.id === id)!,
      success: true,
      message: 'Workflow launched.',
      startedStepIndex: 0,
      executedStepCount: 2,
      totalStepCount: 2,
    }))
    tauriMocks.toggleFavorite.mockImplementation(async (id: string, favorite: boolean) => {
      const item = fixtureItems.find((entry) => entry.id === id)!
      return { ...item, favorite }
    })
    tauriMocks.batchEditItems.mockResolvedValue({ items: [] })
    tauriMocks.createItem.mockImplementation(async (payload: ItemPayload) => materializeItemFromPayload(payload))
    tauriMocks.setItemsFavorite.mockImplementation(async (ids: string[], favorite: boolean) => ({
      items: fixtureItems
        .filter((item) => ids.includes(item.id))
        .map((item) => ({ ...item, favorite })),
    }))
    tauriMocks.deleteItems.mockImplementation(async (ids: string[]) => ({ ids }))
    tauriMocks.clearRecentItems.mockResolvedValue({ cleared: 3 })
    tauriMocks.exportItems.mockResolvedValue({ path: 'C:\\temp\\items.json', exportedCount: 1 })
    tauriMocks.previewImportItems.mockResolvedValue({
      path: 'C:\\temp\\items.json',
      version: 1,
      validCount: 1,
      invalidCount: 0,
      items: [],
      errors: [],
    })
    tauriMocks.importItems.mockResolvedValue({ items: [], errors: [] })
    tauriMocks.scanBrowserBookmarks.mockResolvedValue({
      sourceCount: 0,
      candidateCount: 0,
      importableCount: 0,
      existingCount: 0,
      sources: [],
      candidates: [],
    })
    tauriMocks.importBrowserBookmarks.mockResolvedValue({
      items: [],
      skippedUrls: [],
      errors: [],
    })
    tauriMocks.backupDatabase.mockResolvedValue({ path: 'C:\\temp\\backup.db' })
    tauriMocks.restoreDatabase.mockResolvedValue({ path: 'C:\\temp\\backup.db' })
    tauriMocks.runDatabaseHealthCheck.mockResolvedValue({
      checkedAt: '2026-03-23T10:00:00Z',
      path: 'C:\\temp\\deskhub.db',
      backupsDirectory: 'C:\\temp\\backups',
      schemaVersion: 5,
      quickCheck: 'ok',
      foreignKeysEnabled: true,
      tableCounts: {
        items: 4,
        item_tags: 3,
        workflow_steps: 2,
        workflow_variables: 0,
        app_settings: 1,
        command_history: 0,
        data_tool_history: 0,
      },
    })
    tauriMocks.runDataConsistencyCheck.mockResolvedValue({
      checkedAt: '2026-03-23T10:00:00Z',
      path: 'C:\\temp\\deskhub.db',
      ok: true,
      issueCount: 0,
      warningCount: 0,
      errorCount: 0,
      issues: [],
      tableCounts: {
        items: 4,
        item_tags: 3,
        workflow_steps: 2,
        workflow_variables: 0,
        app_settings: 1,
        command_history: 0,
        data_tool_history: 0,
      },
    })
    tauriMocks.optimizeDatabase.mockResolvedValue({
      path: 'C:\\temp\\deskhub.db',
      quickCheck: 'ok',
      pageCountBefore: 24,
      pageCountAfter: 18,
      freelistCountBefore: 6,
      freelistCountAfter: 0,
      sizeBeforeBytes: 98304,
      sizeAfterBytes: 73728,
    })
    tauriMocks.openBackupsDirectory.mockResolvedValue({ path: 'C:\\temp\\backups' })
    tauriMocks.exportTextReport.mockResolvedValue({ path: 'C:\\temp\\report.txt', lineCount: 1 })
    tauriMocks.setDefaultWorkflow.mockImplementation(async (id: string | null) => ({
      defaultWorkflowId: id,
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      backupRetentionCount: 7,
      diagnosticMode: false,
      lastAutoBackupAt: null,
      overviewSectionOrder: ['recent', 'favorites', 'workflows', 'library'],
      overviewHiddenSections: [],
      overviewLayoutTemplates: [],
      overviewWorkflowLinkMode: 'none',
    }))
    tauriMocks.updateOverviewLayout.mockImplementation(async (payload) => ({
      defaultWorkflowId: null,
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      backupRetentionCount: 7,
      diagnosticMode: false,
      lastAutoBackupAt: null,
      overviewSectionOrder: payload.sectionOrder,
      overviewHiddenSections: payload.hiddenSections,
      overviewLayoutTemplates: payload.layoutTemplates ?? [],
      overviewWorkflowLinkMode: payload.workflowLinkMode ?? 'none',
    }))
  })

  it('renders the navigation shell and overview sections', async () => {
    renderApp(['/overview'])

    expect(await screen.findByRole('link', { name: '总览' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '应用' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '项目' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '网站' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '文件夹' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '脚本' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '工作流' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '最近使用' })).toBeInTheDocument()

    expect((await screen.findAllByText('VS Code', {}, { timeout: 15000 })).length).toBeGreaterThan(0)
    expect(await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })).toBeInTheDocument()
    expect((await screen.findAllByText(/Morning Routine/, {}, { timeout: 15000 })).length).toBeGreaterThan(0)
  }, 30000)

  it('can customize overview layout and hide a section', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    expect(await screen.findByRole('heading', { name: '最近使用' }, { timeout: 15000 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '自定义总览' }))
    await user.click(await screen.findByRole('button', { name: '隐藏 最近使用' }, { timeout: 15000 }))
    await user.click(screen.getByRole('button', { name: '保存布局' }))

    await waitFor(() => {
      expect(tauriMocks.updateOverviewLayout).toHaveBeenCalledWith({
        sectionOrder: ['recent', 'favorites', 'workflows', 'library'],
        hiddenSections: ['recent'],
        layoutTemplates: [],
        workflowLinkMode: 'none',
      })
      expect(screen.queryByRole('heading', { name: '最近使用' })).not.toBeInTheDocument()
    })
  }, 30000)

  it('can apply an overview preset layout', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: /自定义总览/ }, { timeout: 15000 })

    await user.click(screen.getByRole('button', { name: /自定义总览/ }))
    await user.click(screen.getByRole('button', { name: /流程优先/ }))
    await user.click(screen.getByRole('button', { name: /保存布局/ }))

    await waitFor(() => {
      expect(tauriMocks.updateOverviewLayout).toHaveBeenCalledWith({
        sectionOrder: ['workflows', 'recent', 'favorites', 'library'],
        hiddenSections: [],
        layoutTemplates: [],
        workflowLinkMode: 'none',
      })
    })
  }, 30000)

  it('can save the current overview as a named layout template', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: /自定义总览/ }, { timeout: 15000 })

    await user.click(screen.getByRole('button', { name: /自定义总览/ }))
    await user.click(screen.getByRole('button', { name: '隐藏 资源库概览' }))
    await user.type(screen.getByLabelText('布局模板名称'), '晨间开工')
    await user.click(screen.getByRole('button', { name: '保存为模板' }))

    expect(await screen.findByRole('button', { name: '应用模板 晨间开工' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '保存布局' }))

    await waitFor(() => {
      expect(tauriMocks.updateOverviewLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          sectionOrder: ['recent', 'favorites', 'workflows', 'library'],
          hiddenSections: ['library'],
          workflowLinkMode: 'none',
          layoutTemplates: [
            expect.objectContaining({
              name: '晨间开工',
              sectionOrder: ['recent', 'favorites', 'workflows', 'library'],
              hiddenSections: ['library'],
            }),
          ],
        }),
      )
    })
  }, 30000)

  it('prioritizes the workflows section when a default workflow link mode is enabled', async () => {
    tauriMocks.getUiSettings.mockResolvedValue({
      defaultWorkflowId: 'workflow-1',
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      backupRetentionCount: 7,
      diagnosticMode: false,
      lastAutoBackupAt: null,
      overviewSectionOrder: ['recent', 'favorites', 'workflows', 'library'],
      overviewHiddenSections: ['workflows'],
      overviewLayoutTemplates: [],
      overviewWorkflowLinkMode: 'prioritize_workflows',
    })

    renderApp(['/overview'])

    expect(
      await screen.findByText(/默认工作流：\s*Morning Routine/, {}, { timeout: 15000 }),
    ).toBeInTheDocument()
    const sectionHeadings = await screen.findAllByRole('heading', { level: 2 }, { timeout: 15000 })
    expect(sectionHeadings[0]).toHaveTextContent('工作流')
    expect(screen.getAllByText('Morning Routine').length).toBeGreaterThan(0)
  }, 30000)

  it('filters items on a type page', async () => {
    const user = userEvent.setup()
    renderApp(['/websites'])

    const searchInput = await screen.findByLabelText('筛选条目', {}, { timeout: 15000 })

    await user.type(searchInput, 'git')

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.queryByText('VS Code')).not.toBeInTheDocument()
  }, 30000)

  it('opens the command palette with Ctrl+K, launches an item and records history', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, 'morning')
    await user.keyboard('{Enter}')
    await user.click(await screen.findByRole('button', { name: /执行整个工作流/ }))

    await waitFor(() => {
      expect(tauriMocks.launchWorkflow).toHaveBeenCalledWith('workflow-1', 0, [])
      expect(tauriMocks.recordCommandHistory).toHaveBeenCalledWith({
        kind: 'item',
        target: 'workflow-1',
        title: 'Morning Routine',
      })
    })
  }, 30000)

  it('can search to a route entry in the command palette', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, 'route: 最近')
    await user.click(await screen.findByRole('option', { name: /最近使用/ }, { timeout: 15000 }))

    expect(await screen.findByRole('button', { name: '清空最近使用' }, { timeout: 15000 })).toBeInTheDocument()
    expect(tauriMocks.recordCommandHistory).toHaveBeenCalledWith({
      kind: 'route',
      target: '/recent',
      title: '最近使用',
    })
  }, 30000)

  it('can open data tools from the command palette and record action history', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, '数据工具')
    await user.click(await screen.findByRole('option', { name: /打开数据工具/ }, { timeout: 15000 }))

    expect(await screen.findByRole('heading', { name: '数据工具' }, { timeout: 15000 })).toBeInTheDocument()
    expect(tauriMocks.recordCommandHistory).toHaveBeenCalledWith({
      kind: 'action',
      target: 'open_data_tools',
      title: '打开数据工具',
    })
  }, 30000)

  it('can open create item modal from the command palette', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, 'action: 新建应用')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: '新建应用' }, { timeout: 15000 })).toBeInTheDocument()
    expect(tauriMocks.recordCommandHistory).toHaveBeenCalledWith({
      kind: 'action',
      target: 'create_item:app',
      title: '新建应用',
    })
  }, 30000)

  it('can open a starter template from the command palette with prefilled values', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, 'action: 模板 web 项目')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: '新建项目' }, { timeout: 15000 })).toBeInTheDocument()
    expect(screen.getByLabelText('名称')).toHaveValue('Web 项目')
    expect(screen.getByLabelText('启动命令')).toHaveValue('npm run dev')
    expect(tauriMocks.recordCommandHistory).toHaveBeenCalledWith({
      kind: 'action',
      target: 'create_from_starter_template:project-web',
      title: '模板新建 · Web 项目',
    })
  }, 30000)

  it('can clear recent usage from the command palette and record the action', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, 'action: 清空最近')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(tauriMocks.clearRecentItems).toHaveBeenCalledTimes(1)
      expect(tauriMocks.recordCommandHistory).toHaveBeenCalledWith({
        kind: 'action',
        target: 'clear_recent_items',
        title: '清空最近使用',
      })
    })
  }, 30000)

  it('can clear command history from the command palette without recording itself again', async () => {
    const user = userEvent.setup()
    renderApp(['/overview'])

    await screen.findByRole('button', { name: '添加条目' }, { timeout: 15000 })

    const search = await openCommandPalette()
    await user.type(search, 'action: 清空命令')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(tauriMocks.clearCommandHistory).toHaveBeenCalledTimes(1)
    })

    expect(tauriMocks.recordCommandHistory).not.toHaveBeenCalled()
  }, 30000)

  it('sets a default workflow from the workflow page and updates the topbar state', async () => {
    const user = userEvent.setup()
    renderApp(['/workflows'])

    expect(
      await screen.findByRole('heading', { name: '工作流' }, { timeout: 15000 }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Morning Routine')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '设为默认' }))

    await waitFor(() => {
      expect(tauriMocks.setDefaultWorkflow).toHaveBeenCalledWith('workflow-1')
      expect(screen.getByRole('button', { name: /一键上班模式/ })).toHaveTextContent('Morning Routine')
    })
  }, 30000)

  it('restores persisted workflow controls and can duplicate a workflow', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'deskhub:list-controls:/workflows',
      JSON.stringify({
        sortOption: 'favorite',
        selectedTags: ['automation'],
        selectionMode: true,
      }),
    )

    renderApp(['/workflows'])

    expect(
      await screen.findByRole('heading', { name: '工作流' }, { timeout: 15000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('favorite')
    expect(screen.getByRole('button', { name: /标签/ })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: '退出选择' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '退出选择' }))
    await user.click(screen.getByRole('button', { name: '复制 Morning Routine' }))

    await waitFor(() => {
      expect(tauriMocks.createItem).toHaveBeenCalledTimes(1)
    })

    const duplicatedPayload = tauriMocks.createItem.mock.calls[0][0] as ItemPayload

    expect(duplicatedPayload.type).toBe('workflow')
    expect(duplicatedPayload.name).toBe('Morning Routine 副本')
    expect(duplicatedPayload.favorite).toBe(false)

    if (duplicatedPayload.type === 'workflow') {
      expect(duplicatedPayload.steps).toHaveLength(2)
      expect(duplicatedPayload.steps[0].id).not.toBe('step-1')
      expect(duplicatedPayload.steps[1].id).not.toBe('step-2')
    }
  }, 30000)

  it('supports selection shortcuts and batch actions on resource pages', async () => {
    const user = userEvent.setup()
    renderApp(['/projects'])

    expect(await screen.findByRole('heading', { name: '项目' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '选择模式' }))
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })

    expect(await screen.findByText('已选择 1 个条目')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '批量收藏' }))

    await waitFor(() => {
      expect(tauriMocks.setItemsFavorite).toHaveBeenCalledWith(['project-1'], true)
    })

    fireEvent.keyDown(window, { key: 'Delete' })

    const deleteDialog = await screen.findByRole('dialog', { name: '批量删除这些条目？' })
    await user.click(within(deleteDialog).getByRole('button', { name: '批量删除' }))

    await waitFor(() => {
      expect(tauriMocks.deleteItems).toHaveBeenCalledWith(['project-1'])
    })
  }, 30000)

  it('clears recent usage without deleting items', async () => {
    const user = userEvent.setup()
    renderApp(['/recent'])

    expect(await screen.findByText('VS Code', {}, { timeout: 15000 })).toBeInTheDocument()
    expect(await screen.findByText('GitHub', {}, { timeout: 15000 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空最近使用' }))

    const dialog = await screen.findByRole('dialog', { name: '清空最近使用记录？' })
    await user.click(within(dialog).getByRole('button', { name: '清空最近使用' }))

    await waitFor(() => {
      expect(tauriMocks.clearRecentItems).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('还没有最近记录', {}, { timeout: 15000 })).toBeInTheDocument()
  }, 30000)
})
