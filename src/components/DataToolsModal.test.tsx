import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataToolsModal } from './DataToolsModal'
import type { DataToolHistoryEntry, DeskItem } from '../types/items'

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}))

const itemsMocks = vi.hoisted(() => ({
  items: [] as DeskItem[],
  dataToolHistory: [] as DataToolHistoryEntry[],
  uiSettings: {
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
  },
  refreshDataToolHistory: vi.fn(),
  recordDataToolHistory: vi.fn(),
  clearDataToolHistory: vi.fn(),
  clearCommandHistory: vi.fn(),
  exportItems: vi.fn(),
  previewImportItems: vi.fn(),
  importItems: vi.fn(),
  scanBrowserBookmarks: vi.fn(),
  importBrowserBookmarks: vi.fn(),
  scanProjectDirectories: vi.fn(),
  importProjectDirectories: vi.fn(),
  backupDatabase: vi.fn(),
  restoreDatabase: vi.fn(),
  runDatabaseHealthCheck: vi.fn(),
  runDataConsistencyCheck: vi.fn(),
  optimizeDatabase: vi.fn(),
  openBackupsDirectory: vi.fn(),
  exportTextReport: vi.fn(),
  updateUiSettings: vi.fn(),
  exportStructuredReport: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => dialogMocks)
vi.mock('../hooks/useItems', () => ({
  useItems: () => itemsMocks,
}))

const workflowItem: DeskItem = {
  id: 'workflow-1',
  name: 'Morning Routine',
  type: 'workflow',
  description: '启动工作环境',
  tags: ['daily'],
  icon: '',
  favorite: true,
  createdAt: '2026-03-25T00:00:00Z',
  updatedAt: '2026-03-25T00:00:00Z',
  lastLaunchedAt: null,
  variables: [],
  steps: [{ id: 'step-1', type: 'open_url', url: 'https://example.com', note: '', delayMs: 0 }],
}

describe('DataToolsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    itemsMocks.items = [workflowItem]
    itemsMocks.dataToolHistory = []
    itemsMocks.uiSettings = {
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
    }
    itemsMocks.refreshDataToolHistory.mockResolvedValue([])
    itemsMocks.recordDataToolHistory.mockImplementation(async (payload) => ({
      id: 'history-1',
      occurredAt: '2026-03-25T10:00:00Z',
      itemNames: [],
      errors: [],
      extra: { tableCounts: {}, ...(payload.extra ?? {}) },
      ...payload,
    }))
    itemsMocks.clearDataToolHistory.mockResolvedValue({ cleared: 1 })
    itemsMocks.clearCommandHistory.mockResolvedValue({ cleared: 3 })
    itemsMocks.exportItems.mockResolvedValue({ path: 'C:\\exports\\workflows.json', exportedCount: 1 })
    itemsMocks.previewImportItems.mockResolvedValue({
      path: 'C:\\imports\\items.json',
      version: 1,
      validCount: 1,
      invalidCount: 1,
      items: [
        {
          index: 1,
          name: '导入工作流',
          type: 'workflow',
          tags: ['daily'],
          stepCount: 2,
          target: 'open_url -> run_command',
        },
      ],
      errors: ['第 2 项导入失败：URL 非法'],
    })
    itemsMocks.importItems.mockResolvedValue({ items: [workflowItem], errors: ['第 2 项导入失败：URL 非法'] })
    itemsMocks.scanBrowserBookmarks.mockResolvedValue({
      sourceCount: 2,
      candidateCount: 3,
      importableCount: 2,
      existingCount: 1,
      sources: [
        {
          id: 'chrome-default',
          browser: 'Chrome',
          profileName: 'Default',
          bookmarksPath: 'C:\\Users\\demo\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks',
          bookmarkCount: 2,
        },
        {
          id: 'edge-default',
          browser: 'Edge',
          profileName: 'Default',
          bookmarksPath: 'C:\\Users\\demo\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Bookmarks',
          bookmarkCount: 1,
        },
      ],
      candidates: [
        {
          id: 'bookmark-1',
          browser: 'Chrome',
          profileName: 'Default',
          sourcePath: 'C:\\Users\\demo\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks',
          name: 'DeskHub Docs',
          url: 'https://docs.example.com',
          folderPath: '书签栏 / DeskHub',
        },
        {
          id: 'bookmark-2',
          browser: 'Chrome',
          profileName: 'Default',
          sourcePath: 'C:\\Users\\demo\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks',
          name: 'DeskHub Roadmap',
          url: 'https://roadmap.example.com',
          folderPath: '其他收藏夹 / Team',
        },
        {
          id: 'bookmark-3',
          browser: 'Edge',
          profileName: 'Default',
          sourcePath: 'C:\\Users\\demo\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Bookmarks',
          name: 'Existing URL',
          url: 'https://github.com',
          folderPath: '书签栏',
          existingItemId: 'url-existing',
          existingItemName: 'GitHub',
        },
      ],
    })
    itemsMocks.importBrowserBookmarks.mockResolvedValue({
      items: [
        {
          id: 'url-import-1',
          name: 'DeskHub Docs',
          type: 'url',
          description: 'Imported bookmark',
          tags: ['bookmark', 'chrome'],
          icon: '',
          favorite: false,
          createdAt: '2026-03-26T00:00:00Z',
          updatedAt: '2026-03-26T00:00:00Z',
          lastLaunchedAt: null,
          url: 'https://docs.example.com',
        },
      ],
      skippedUrls: ['https://github.com'],
      errors: [],
    })
    itemsMocks.scanProjectDirectories.mockResolvedValue({
      rootPath: 'C:\\workspace',
      scanDepth: 1,
      scannedDirectoryCount: 3,
      skippedDirectoryCount: 1,
      importableCount: 2,
      existingCount: 1,
      excludePatterns: ['.git', 'node_modules'],
      candidates: [
        {
          path: 'C:\\workspace\\api',
          relativePath: 'api',
          depth: 1,
          suggestedName: 'DeskHub API',
          suggestedCommand: 'cargo run',
          detectedFiles: ['Cargo.toml', '.git'],
        },
        {
          path: 'C:\\workspace\\web',
          relativePath: 'web',
          depth: 1,
          suggestedName: 'DeskHub Web',
          suggestedCommand: 'pnpm dev',
          detectedFiles: ['package.json', 'pnpm-lock.yaml'],
        },
        {
          path: 'C:\\workspace\\docs',
          relativePath: 'docs',
          depth: 1,
          suggestedName: 'DeskHub Docs',
          detectedFiles: ['.git'],
          existingItemId: 'project-existing',
          existingItemName: 'Existing Docs',
        },
      ],
    })
    itemsMocks.importProjectDirectories.mockResolvedValue({
      items: [
        {
          id: 'project-import-1',
          name: 'DeskHub API',
          type: 'project',
          description: 'Imported project',
          tags: ['rust'],
          icon: '',
          favorite: false,
          createdAt: '2026-03-26T00:00:00Z',
          updatedAt: '2026-03-26T00:00:00Z',
          lastLaunchedAt: null,
          projectPath: 'C:\\workspace\\api',
          devCommand: 'cargo run',
        },
      ],
      updatedPaths: [],
      skippedPaths: ['C:\\workspace\\docs'],
      errors: [],
    })
    itemsMocks.backupDatabase.mockResolvedValue({ path: 'C:\\backups\\deskhub.db' })
    itemsMocks.restoreDatabase.mockResolvedValue({
      path: 'C:\\backups\\deskhub.db',
      backupPath: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\backups\\deskhub-pre-restore.db',
      sha256: 'restored-hash',
      sourceSha256: 'source-hash',
      schemaVersion: 5,
      itemCount: 12,
      workflowCount: 3,
      backupsDirectory: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\backups',
    })
    itemsMocks.runDatabaseHealthCheck.mockResolvedValue({
      checkedAt: '2026-03-25T10:00:00Z',
      path: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\deskhub.db',
      backupsDirectory: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\backups',
      schemaVersion: 5,
      quickCheck: 'ok',
      foreignKeysEnabled: true,
      tableCounts: {
        items: 12,
        item_tags: 8,
        workflow_steps: 5,
        workflow_variables: 0,
        app_settings: 1,
        command_history: 4,
        data_tool_history: 2,
      },
    })
    itemsMocks.runDataConsistencyCheck.mockResolvedValue({
      checkedAt: '2026-03-25T10:00:00Z',
      path: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\deskhub.db',
      ok: false,
      issueCount: 2,
      warningCount: 1,
      errorCount: 1,
      issues: [
        {
          severity: 'error',
          code: 'workflow_without_steps',
          message: '工作流 Empty Flow 没有任何步骤。',
          itemId: 'workflow-2',
        },
        {
          severity: 'warning',
          code: 'stale_command_history_item',
          message: '命令历史仍引用已删除条目：Old Item。',
          itemId: 'old-item',
        },
      ],
      tableCounts: {
        items: 12,
        item_tags: 8,
        workflow_steps: 5,
        workflow_variables: 0,
        app_settings: 1,
        command_history: 4,
        data_tool_history: 2,
      },
    })
    itemsMocks.optimizeDatabase.mockResolvedValue({
      path: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\deskhub.db',
      quickCheck: 'ok',
      pageCountBefore: 24,
      pageCountAfter: 18,
      freelistCountBefore: 6,
      freelistCountAfter: 0,
      sizeBeforeBytes: 98304,
      sizeAfterBytes: 73728,
    })
    itemsMocks.openBackupsDirectory.mockResolvedValue({
      path: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\backups',
    })
    itemsMocks.exportTextReport.mockResolvedValue({
      path: 'C:\\exports\\preview-errors.txt',
      lineCount: 1,
    })
    itemsMocks.updateUiSettings.mockResolvedValue(itemsMocks.uiSettings)
    itemsMocks.exportStructuredReport.mockResolvedValue({
      path: 'C:\\exports\\structured-report.json',
      sha256: 'report-hash',
    })
  })

  it('refreshes persisted history when opened and can clear history', async () => {
    itemsMocks.dataToolHistory = [
      {
        id: 'history-1',
        action: 'backup',
        status: 'success',
        title: '数据库备份',
        summary: '已导出当前 deskhub.db 的完整副本。',
        occurredAt: '2026-03-25T10:00:00Z',
        outputPath: 'C:\\backups\\deskhub.db',
        itemNames: [],
        errors: [],
        extra: { tableCounts: {} },
      },
    ]

    const user = userEvent.setup()
    render(<DataToolsModal open onClose={vi.fn()} />)

    await waitFor(() => {
      expect(itemsMocks.refreshDataToolHistory).toHaveBeenCalledTimes(1)
    })

    expect(screen.getAllByText('数据库备份').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '清空历史' }))

    expect(itemsMocks.clearDataToolHistory).toHaveBeenCalledTimes(1)
  }, 15000)

  it('asks for confirmation before restoring and persists the restore summary', async () => {
    const user = userEvent.setup()
    dialogMocks.open.mockResolvedValue('C:\\backups\\deskhub.db')

    render(<DataToolsModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /恢复数据库/ }))

    expect(await screen.findByText('确认恢复数据库？')).toBeInTheDocument()
    expect(itemsMocks.restoreDatabase).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确认恢复' }))

    await waitFor(() => {
      expect(itemsMocks.restoreDatabase).toHaveBeenCalledWith('C:\\backups\\deskhub.db')
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'restore',
          backupPath: 'C:\\Users\\demo\\AppData\\Roaming\\DeskHub\\data\\backups\\deskhub-pre-restore.db',
        }),
      )
    })
  }, 15000)

  it('runs import preview before import and can export preview errors', async () => {
    const user = userEvent.setup()
    dialogMocks.open.mockResolvedValue('C:\\imports\\items.json')
    dialogMocks.save.mockResolvedValue('C:\\exports\\preview-errors.txt')

    render(<DataToolsModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /导入条目 JSON/ }))

    expect(await screen.findByText('导入前预检')).toBeInTheDocument()
    expect(itemsMocks.previewImportItems).toHaveBeenCalledWith('C:\\imports\\items.json')
    expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'preview_import',
        extra: expect.objectContaining({
          previewValidCount: 1,
          previewInvalidCount: 1,
        }),
      }),
    )

    await user.click(screen.getByRole('button', { name: '导出错误列表' }))

    await waitFor(() => {
      expect(itemsMocks.exportTextReport).toHaveBeenCalledWith(
        'C:\\exports\\preview-errors.txt',
        'DeskHub 导入预检错误列表',
        ['第 2 项导入失败：URL 非法'],
      )
    })

    await user.click(screen.getByRole('button', { name: '导入 1 个条目' }))

    await waitFor(() => {
      expect(itemsMocks.importItems).toHaveBeenCalledWith('C:\\imports\\items.json')
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'import',
          itemNames: ['Morning Routine'],
        }),
      )
    })
  }, 15000)

  it('can scan a workspace and import selected project directories', async () => {
    const user = userEvent.setup()
    dialogMocks.open.mockResolvedValue('C:\\workspace')

    render(<DataToolsModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /扫描项目目录/ }))

    expect(await screen.findByText('导入项目目录')).toBeInTheDocument()
    expect(itemsMocks.scanProjectDirectories).toHaveBeenCalledWith(
      'C:\\workspace',
      expect.objectContaining({
        scanDepth: 1,
        excludePatterns: expect.arrayContaining(['node_modules', 'target']),
      }),
    )
    expect(screen.getByText('已选择 2 / 2 个可处理项目')).toBeInTheDocument()
    expect(screen.getByText('已存在：Existing Docs')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /DeskHub Web/ }))
    expect(screen.getByText('已选择 1 / 2 个可处理项目')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '导入 1 个项目' }))

    await waitFor(() => {
      expect(itemsMocks.importProjectDirectories).toHaveBeenCalledWith(
        ['C:\\workspace\\api'],
        { conflictStrategy: 'skip_existing' },
      )
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'import_projects',
          itemNames: ['DeskHub API'],
        }),
      )
    })
  }, 15000)

  it('remembers project import preferences and can refresh existing projects', async () => {
    const user = userEvent.setup()
    dialogMocks.open.mockResolvedValue('C:\\workspace')
    window.localStorage.setItem(
      'deskhub:data-tools-project-import',
      JSON.stringify({
        recentRootPath: 'C:\\workspace',
        scanDepth: 2,
        excludePatterns: ['node_modules', 'coverage'],
        conflictStrategy: 'refresh_existing',
      }),
    )
    itemsMocks.scanProjectDirectories.mockResolvedValueOnce({
      rootPath: 'C:\\workspace',
      scanDepth: 2,
      scannedDirectoryCount: 8,
      skippedDirectoryCount: 3,
      importableCount: 2,
      existingCount: 1,
      excludePatterns: ['.git', 'node_modules', 'coverage'],
      candidates: [
        {
          path: 'C:\\workspace\\services\\api',
          relativePath: 'services/api',
          depth: 2,
          suggestedName: 'DeskHub API',
          suggestedCommand: 'cargo run',
          detectedFiles: ['Cargo.toml', '.git'],
        },
        {
          path: 'C:\\workspace\\apps\\web',
          relativePath: 'apps/web',
          depth: 2,
          suggestedName: 'DeskHub Web',
          suggestedCommand: 'pnpm dev',
          detectedFiles: ['package.json', 'pnpm-lock.yaml'],
        },
        {
          path: 'C:\\workspace\\docs',
          relativePath: 'docs',
          depth: 1,
          suggestedName: 'DeskHub Docs',
          detectedFiles: ['.git'],
          existingItemId: 'project-existing',
          existingItemName: 'Existing Docs',
        },
      ],
    })
    itemsMocks.importProjectDirectories.mockResolvedValueOnce({
      items: [
        {
          id: 'project-import-1',
          name: 'DeskHub API',
          type: 'project',
          description: 'Imported project',
          tags: ['rust'],
          icon: '',
          favorite: false,
          createdAt: '2026-03-26T00:00:00Z',
          updatedAt: '2026-03-26T00:00:00Z',
          lastLaunchedAt: null,
          projectPath: 'C:\\workspace\\services\\api',
          devCommand: 'cargo run',
        },
        {
          id: 'project-import-2',
          name: 'DeskHub Web',
          type: 'project',
          description: 'Imported project',
          tags: ['node'],
          icon: '',
          favorite: false,
          createdAt: '2026-03-26T00:00:00Z',
          updatedAt: '2026-03-26T00:00:00Z',
          lastLaunchedAt: null,
          projectPath: 'C:\\workspace\\apps\\web',
          devCommand: 'pnpm dev',
        },
        {
          id: 'project-existing',
          name: 'DeskHub Docs',
          type: 'project',
          description: 'Refreshed project',
          tags: ['workspace'],
          icon: '',
          favorite: true,
          createdAt: '2026-03-25T00:00:00Z',
          updatedAt: '2026-03-26T00:00:00Z',
          lastLaunchedAt: null,
          projectPath: 'C:\\workspace\\docs',
          devCommand: '',
        },
      ],
      updatedPaths: ['C:\\workspace\\docs'],
      skippedPaths: [],
      errors: [],
    })

    render(<DataToolsModal open onClose={vi.fn()} />)

    expect(screen.getByText('C:\\workspace')).toBeInTheDocument()
    expect(screen.getByLabelText('扫描深度')).toHaveValue('2')
    expect(screen.getByLabelText('冲突策略')).toHaveValue('refresh_existing')

    await user.click(screen.getByRole('button', { name: /扫描项目目录/ }))

    await waitFor(() => {
      expect(itemsMocks.scanProjectDirectories).toHaveBeenCalledWith('C:\\workspace', {
        scanDepth: 2,
        excludePatterns: ['node_modules', 'coverage'],
      })
    })

    expect((await screen.findAllByText('刷新已有项目')).length).toBeGreaterThan(0)
    expect(screen.getByText('已选择 3 / 3 个可处理项目')).toBeInTheDocument()
    expect(screen.getByText('将刷新：Existing Docs')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '导入 / 刷新 3 个项目' }))

    await waitFor(() => {
      expect(itemsMocks.importProjectDirectories).toHaveBeenCalledWith(
        ['C:\\workspace\\services\\api', 'C:\\workspace\\apps\\web', 'C:\\workspace\\docs'],
        { conflictStrategy: 'refresh_existing' },
      )
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'import_projects',
          itemNames: ['DeskHub API', 'DeskHub Web', 'DeskHub Docs'],
        }),
      )
    })
  }, 15000)

  it('can scan browser bookmarks and import selected websites', async () => {
    const user = userEvent.setup()

    render(<DataToolsModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /导入浏览器收藏夹/ }))

    expect(await screen.findByRole('heading', { name: '导入浏览器收藏夹' })).toBeInTheDocument()
    expect(itemsMocks.scanBrowserBookmarks).toHaveBeenCalledTimes(1)
    expect(screen.getByText('已选择 2 / 2 个可导入网址')).toBeInTheDocument()
    expect(screen.getByText('已存在：GitHub')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /DeskHub Roadmap/ }))
    expect(screen.getByText('已选择 1 / 2 个可导入网址')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '导入 1 个网站' }))

    await waitFor(() => {
      expect(itemsMocks.importBrowserBookmarks).toHaveBeenCalledWith([
        {
          browser: 'Chrome',
          profileName: 'Default',
          sourcePath: 'C:\\Users\\demo\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks',
          name: 'DeskHub Docs',
          url: 'https://docs.example.com',
          folderPath: '书签栏 / DeskHub',
        },
      ])
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'import_bookmarks',
          itemNames: ['DeskHub Docs'],
        }),
      )
    })
  }, 15000)

  it('can run consistency check, optimize database and clear command history', async () => {
    const user = userEvent.setup()
    render(<DataToolsModal open onClose={vi.fn()} />)

    await user.click(
      screen.getByRole('button', {
        name: /数据一致性检查 检查默认工作流、孤儿记录、无步骤 workflow、无效 URL 与失效命令历史。/,
      }),
    )

    await waitFor(() => {
      expect(itemsMocks.runDataConsistencyCheck).toHaveBeenCalledTimes(1)
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consistency_check',
          extra: expect.objectContaining({
            issueCount: 2,
            warningCount: 1,
            errorCount: 1,
          }),
        }),
      )
    })

    await user.click(
      screen.getByRole('button', {
        name: /数据库优化 执行 PRAGMA optimize 与 VACUUM，回收空闲页并刷新数据库统计信息。/,
      }),
    )

    await waitFor(() => {
      expect(itemsMocks.optimizeDatabase).toHaveBeenCalledTimes(1)
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'optimize_database',
          extra: expect.objectContaining({
            pageCountBefore: 24,
            pageCountAfter: 18,
          }),
        }),
      )
    })

    await user.click(
      screen.getByRole('button', {
        name: /清空命令历史 清空命令面板的 route \/ action \/ item 历史，不影响条目本身与最近使用。/,
      }),
    )
    expect(await screen.findByText('确认清空命令历史？')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认清空' }))

    await waitFor(() => {
      expect(itemsMocks.clearCommandHistory).toHaveBeenCalledTimes(1)
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'clear_command_history',
          extra: expect.objectContaining({
            clearedCount: 3,
          }),
        }),
      )
    })
  }, 15000)

  it('can save settings, export a structured report, and lock destructive actions in diagnostic mode', async () => {
    const user = userEvent.setup()
    dialogMocks.save.mockResolvedValue('C:\\exports\\structured-report.json')
    itemsMocks.dataToolHistory = [
      {
        id: 'history-latest',
        action: 'health_check',
        status: 'success',
        title: '数据库健康检查',
        summary: '健康检查完成。',
        occurredAt: '2026-03-25T11:00:00Z',
        itemNames: [],
        errors: [],
        extra: { tableCounts: {} },
      },
    ]

    const { rerender } = render(<DataToolsModal open onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('自动备份间隔（小时）'), {
      target: { value: '12' },
    })
    await user.click(screen.getByRole('button', { name: /保存设置/ }))

    await waitFor(() => {
      expect(itemsMocks.updateUiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          autoBackupIntervalHours: 12,
          diagnosticMode: false,
        }),
      )
    })

    await user.click(screen.getByRole('button', { name: /导出结构化报告/ }))

    await waitFor(() => {
      expect(itemsMocks.exportStructuredReport).toHaveBeenCalledWith(
        'C:\\exports\\structured-report.json',
        'DeskHub Structured Report',
        expect.objectContaining({
          uiSettings: expect.objectContaining({
            autoBackupEnabled: true,
          }),
        }),
      )
      expect(itemsMocks.recordDataToolHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'export_structured_report',
        }),
      )
    })

    itemsMocks.uiSettings = {
      ...itemsMocks.uiSettings,
      diagnosticMode: true,
    }

    rerender(<DataToolsModal open onClose={vi.fn()} />)

    expect(screen.getByText('诊断模式已开启，危险写操作已被锁定。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /恢复数据库/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /导入条目 JSON/ })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /数据库优化/ }).some((button) => button.hasAttribute('disabled'))).toBe(true)
  }, 15000)
})
