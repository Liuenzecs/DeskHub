import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemsProvider } from './ItemsContext'
import { useItems } from '../hooks/useItems'
import type {
  CommandHistoryCollection,
  DataToolHistoryCollection,
  DeskItem,
  FileOperationResponse,
  ItemCollection,
  UiSettings,
} from '../types/items'

const tauriMocks = vi.hoisted(() => ({
  getItems: vi.fn<() => Promise<ItemCollection>>(),
  getCommandHistory: vi.fn<() => Promise<CommandHistoryCollection>>(),
  getDataToolHistory: vi.fn<() => Promise<DataToolHistoryCollection>>(),
  getUiSettings: vi.fn<() => Promise<UiSettings>>(),
  updateOverviewLayout: vi.fn(),
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
  recordCommandHistory: vi.fn(),
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
  restoreDatabase: vi.fn<() => Promise<FileOperationResponse>>(),
  runDatabaseHealthCheck: vi.fn(),
  runDataConsistencyCheck: vi.fn(),
  optimizeDatabase: vi.fn(),
  openBackupsDirectory: vi.fn(),
  exportTextReport: vi.fn(),
  updateUiSettings: vi.fn(),
  exportStructuredReport: vi.fn(),
}))

vi.mock('../lib/tauri', () => tauriMocks)

const initialItems: DeskItem[] = [
  {
    id: 'workflow-1',
    name: 'Original Workflow',
    type: 'workflow',
    description: 'Initial workflow',
    tags: ['daily'],
    icon: '',
    favorite: false,
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-25T00:00:00Z',
    lastLaunchedAt: null,
    variables: [],
    steps: [{ id: 'step-1', type: 'open_url', url: 'https://example.com', note: '', delayMs: 0 }],
  },
]

const restoredItems: DeskItem[] = [
  {
    id: 'workflow-2',
    name: 'Restored Workflow',
    type: 'workflow',
    description: 'Restored from backup',
    tags: ['restore'],
    icon: '',
    favorite: true,
    createdAt: '2026-03-26T00:00:00Z',
    updatedAt: '2026-03-26T00:00:00Z',
    lastLaunchedAt: '2026-03-26T08:00:00Z',
    variables: [],
    steps: [{ id: 'step-2', type: 'open_url', url: 'https://restore.example.com', note: '', delayMs: 0 }],
  },
]

function Probe() {
  const { items, uiSettings, commandHistory, dataToolHistory, restoreDatabase } = useItems()

  return (
    <div>
      <div data-testid="item-name">{items[0]?.name ?? 'empty'}</div>
      <div data-testid="default-workflow">{uiSettings.defaultWorkflowId ?? 'none'}</div>
      <div data-testid="command-history-count">{commandHistory.length}</div>
      <div data-testid="data-tool-history-count">{dataToolHistory.length}</div>
      <button type="button" onClick={() => void restoreDatabase('C:\\backup\\deskhub.db')}>
        restore
      </button>
    </div>
  )
}

describe('ItemsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tauriMocks.getItems
      .mockResolvedValueOnce({ items: initialItems })
      .mockResolvedValueOnce({ items: restoredItems })
    tauriMocks.getUiSettings
      .mockResolvedValueOnce({
        defaultWorkflowId: 'workflow-1',
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
      .mockResolvedValueOnce({
        defaultWorkflowId: 'workflow-2',
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
    tauriMocks.getCommandHistory
      .mockResolvedValueOnce({
        entries: [{ kind: 'item', target: 'workflow-1', title: 'Original Workflow', lastUsedAt: '2026-03-25T09:00:00Z', useCount: 1 }],
      })
      .mockResolvedValueOnce({
        entries: [{ kind: 'route', target: '/workflows', title: '工作流', lastUsedAt: '2026-03-26T09:00:00Z', useCount: 2 }],
      })
    tauriMocks.getDataToolHistory.mockResolvedValue({
      records: [
        {
          id: 'data-tool-1',
          action: 'restore',
          status: 'success',
          title: '数据库恢复',
          summary: '已从备份恢复。',
          occurredAt: '2026-03-26T09:01:00Z',
          itemNames: [],
          errors: [],
          extra: { tableCounts: {} },
        },
      ],
    })
    tauriMocks.restoreDatabase.mockResolvedValue({ path: 'C:\\backup\\deskhub.db' })
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
    tauriMocks.recordCommandHistory.mockResolvedValue({
      kind: 'item',
      target: 'workflow-1',
      title: 'Original Workflow',
      lastUsedAt: '2026-03-25T09:00:00Z',
      useCount: 1,
    })
    tauriMocks.recordDataToolHistory.mockResolvedValue({
      id: 'data-tool-1',
      action: 'restore',
      status: 'success',
      title: '数据库恢复',
      summary: '已从备份恢复。',
      occurredAt: '2026-03-26T09:01:00Z',
      itemNames: [],
      errors: [],
      extra: { tableCounts: {} },
    })
  })

  it('rehydrates items, settings and histories after restoring the database', async () => {
    const user = userEvent.setup()

    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('item-name')).toHaveTextContent('Original Workflow')
      expect(screen.getByTestId('default-workflow')).toHaveTextContent('workflow-1')
      expect(screen.getByTestId('command-history-count')).toHaveTextContent('1')
      expect(screen.getByTestId('data-tool-history-count')).toHaveTextContent('0')
    })

    await user.click(screen.getByRole('button', { name: 'restore' }))

    await waitFor(() => {
      expect(tauriMocks.restoreDatabase).toHaveBeenCalledWith('C:\\backup\\deskhub.db')
      expect(screen.getByTestId('item-name')).toHaveTextContent('Restored Workflow')
      expect(screen.getByTestId('default-workflow')).toHaveTextContent('workflow-2')
      expect(screen.getByTestId('command-history-count')).toHaveTextContent('1')
      expect(screen.getByTestId('data-tool-history-count')).toHaveTextContent('1')
    })

    expect(tauriMocks.getItems).toHaveBeenCalledTimes(2)
    expect(tauriMocks.getUiSettings).toHaveBeenCalledTimes(2)
    expect(tauriMocks.getCommandHistory).toHaveBeenCalledTimes(2)
    expect(tauriMocks.getDataToolHistory).toHaveBeenCalledTimes(1)
  })
})
