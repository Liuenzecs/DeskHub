import { createContext } from 'react'
import type {
  BatchEditItemsPayload,
  BrowserBookmarkImportEntry,
  BrowserBookmarkScanResponse,
  ClearCommandHistoryResponse,
  ClearRecentItemsResponse,
  ClearDataToolHistoryResponse,
  CommandHistoryEntry,
  CommandHistoryPayload,
  DataToolHistoryEntry,
  DataToolHistoryPayload,
  DatabaseConsistencyReport,
  DatabaseHealthReport,
  DatabaseMaintenanceResponse,
  DeleteItemsResponse,
  DeskItem,
  ExportItemsResponse,
  ExportTextReportResponse,
  FileOperationResponse,
  ImportBrowserBookmarksResponse,
  ImportItemsPreviewResponse,
  ImportItemsResponse,
  ImportProjectDirectoriesResponse,
  ItemPayload,
  LaunchResponse,
  OverviewLayoutPayload,
  ProjectDirectoryScanResponse,
  ProjectDirectoryScanOptions,
  ProjectDirectoryImportOptions,
  UiSettings,
  UiSettingsUpdatePayload,
  WorkflowItem,
  WorkflowVariableInput,
} from '../types/items'

export interface RehydrateOptions {
  items?: boolean
  commandHistory?: boolean
  uiSettings?: boolean
  dataToolHistory?: boolean
}

export interface ItemsContextValue {
  items: DeskItem[]
  commandHistory: CommandHistoryEntry[]
  dataToolHistory: DataToolHistoryEntry[]
  uiSettings: UiSettings
  defaultWorkflow: WorkflowItem | null
  loading: boolean
  rehydrate: (options?: RehydrateOptions) => Promise<void>
  refreshItems: () => Promise<DeskItem[]>
  refreshCommandHistory: () => Promise<CommandHistoryEntry[]>
  refreshDataToolHistory: () => Promise<DataToolHistoryEntry[]>
  refreshUiSettings: () => Promise<UiSettings>
  createItem: (payload: ItemPayload) => Promise<DeskItem>
  updateItem: (id: string, payload: ItemPayload) => Promise<DeskItem>
  deleteItem: (id: string) => Promise<void>
  deleteItems: (ids: string[]) => Promise<DeleteItemsResponse>
  toggleFavorite: (id: string, favorite: boolean) => Promise<DeskItem>
  setItemsFavorite: (ids: string[], favorite: boolean) => Promise<DeskItem[]>
  batchEditItems: (payload: BatchEditItemsPayload) => Promise<DeskItem[]>
  launchItem: (id: string) => Promise<LaunchResponse>
  launchWorkflow: (id: string, startStepIndex?: number, variableInputs?: WorkflowVariableInput[]) => Promise<LaunchResponse>
  clearRecentItems: () => Promise<ClearRecentItemsResponse>
  setDefaultWorkflow: (id: string | null) => Promise<UiSettings>
  updateUiSettings: (payload: UiSettingsUpdatePayload) => Promise<UiSettings>
  updateOverviewLayout: (payload: OverviewLayoutPayload) => Promise<UiSettings>
  recordCommandHistory: (payload: CommandHistoryPayload) => Promise<CommandHistoryEntry>
  recordDataToolHistory: (payload: DataToolHistoryPayload) => Promise<DataToolHistoryEntry>
  clearDataToolHistory: () => Promise<ClearDataToolHistoryResponse>
  clearCommandHistory: () => Promise<ClearCommandHistoryResponse>
  exportItems: (path: string, ids: string[]) => Promise<ExportItemsResponse>
  previewImportItems: (path: string) => Promise<ImportItemsPreviewResponse>
  importItems: (path: string) => Promise<ImportItemsResponse>
  scanBrowserBookmarks: () => Promise<BrowserBookmarkScanResponse>
  importBrowserBookmarks: (entries: BrowserBookmarkImportEntry[]) => Promise<ImportBrowserBookmarksResponse>
  scanProjectDirectories: (
    path: string,
    options?: ProjectDirectoryScanOptions,
  ) => Promise<ProjectDirectoryScanResponse>
  importProjectDirectories: (
    paths: string[],
    options?: ProjectDirectoryImportOptions,
  ) => Promise<ImportProjectDirectoriesResponse>
  backupDatabase: (path: string) => Promise<FileOperationResponse>
  restoreDatabase: (path: string) => Promise<FileOperationResponse>
  runDatabaseHealthCheck: () => Promise<DatabaseHealthReport>
  runDataConsistencyCheck: () => Promise<DatabaseConsistencyReport>
  optimizeDatabase: () => Promise<DatabaseMaintenanceResponse>
  openBackupsDirectory: () => Promise<FileOperationResponse>
  exportTextReport: (path: string, title: string, lines: string[]) => Promise<ExportTextReportResponse>
  exportStructuredReport: (path: string, title: string, payload: unknown) => Promise<FileOperationResponse>
}

export const ItemsContext = createContext<ItemsContextValue | null>(null)
