import { invoke } from '@tauri-apps/api/core'
import type {
  BatchEditItemsPayload,
  BrowserBookmarkImportEntry,
  BrowserBookmarkScanResponse,
  ClearCommandHistoryResponse,
  ClearRecentItemsResponse,
  ClearDataToolHistoryResponse,
  CommandHistoryCollection,
  CommandHistoryEntry,
  CommandHistoryPayload,
  DataToolHistoryCollection,
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
  ItemCollection,
  ItemPayload,
  LaunchResponse,
  OverviewLayoutPayload,
  ProjectDirectoryImportOptions,
  ProjectDirectoryScanResponse,
  ProjectDirectoryScanOptions,
  ProjectInspectionResult,
  UiSettings,
  UiSettingsUpdatePayload,
  WorkflowVariableInput,
} from '../types/items'

export function getItems() {
  return invoke<ItemCollection>('get_items')
}

export function getCommandHistory() {
  return invoke<CommandHistoryCollection>('get_command_history')
}

export function getDataToolHistory() {
  return invoke<DataToolHistoryCollection>('get_data_tool_history')
}

export function recordCommandHistory(payload: CommandHistoryPayload) {
  return invoke<CommandHistoryEntry>('record_command_history', { payload })
}

export function recordDataToolHistory(payload: DataToolHistoryPayload) {
  return invoke<DataToolHistoryEntry>('record_data_tool_history', { payload })
}

export function clearDataToolHistory() {
  return invoke<ClearDataToolHistoryResponse>('clear_data_tool_history')
}

export function clearCommandHistory() {
  return invoke<ClearCommandHistoryResponse>('clear_command_history')
}

export function getUiSettings() {
  return invoke<UiSettings>('get_ui_settings')
}

export function updateUiSettings(payload: UiSettingsUpdatePayload) {
  return invoke<UiSettings>('update_ui_settings', { payload })
}

export function updateOverviewLayout(payload: OverviewLayoutPayload) {
  return invoke<UiSettings>('update_overview_layout', { payload })
}

export function inspectProjectDirectory(path: string) {
  return invoke<ProjectInspectionResult>('inspect_project_directory', { path })
}

export function scanBrowserBookmarks() {
  return invoke<BrowserBookmarkScanResponse>('scan_browser_bookmarks')
}

export function importBrowserBookmarks(entries: BrowserBookmarkImportEntry[]) {
  return invoke<ImportBrowserBookmarksResponse>('import_browser_bookmarks', { entries })
}

export function scanProjectDirectories(path: string, options?: ProjectDirectoryScanOptions) {
  return invoke<ProjectDirectoryScanResponse>('scan_project_directories', {
    path,
    options: options ?? null,
  })
}

export function importProjectDirectories(paths: string[], options?: ProjectDirectoryImportOptions) {
  return invoke<ImportProjectDirectoriesResponse>('import_project_directories', {
    paths,
    options: options ?? null,
  })
}

export function createItem(payload: ItemPayload) {
  return invoke<DeskItem>('create_item', { payload })
}

export function updateItem(id: string, payload: ItemPayload) {
  return invoke<DeskItem>('update_item', { id, payload })
}

export function deleteItem(id: string) {
  return invoke<{ id: string }>('delete_item', { id })
}

export function deleteItems(ids: string[]) {
  return invoke<DeleteItemsResponse>('delete_items', { ids })
}

export function toggleFavorite(id: string, favorite: boolean) {
  return invoke<DeskItem>('toggle_favorite', { id, favorite })
}

export function setItemsFavorite(ids: string[], favorite: boolean) {
  return invoke<ItemCollection>('set_items_favorite', { ids, favorite })
}

export function batchEditItems(payload: BatchEditItemsPayload) {
  return invoke<ItemCollection>('batch_edit_items', { payload })
}

export function launchItem(id: string) {
  return invoke<LaunchResponse>('launch_item', { id })
}

export function launchWorkflow(id: string, startStepIndex?: number, variableInputs?: WorkflowVariableInput[]) {
  return invoke<LaunchResponse>('launch_workflow', {
    id,
    start_step_index: startStepIndex ?? null,
    variable_inputs: variableInputs ?? null,
  })
}

export function clearRecentItems() {
  return invoke<ClearRecentItemsResponse>('clear_recent_items')
}

export function setDefaultWorkflow(id: string | null) {
  return invoke<UiSettings>('set_default_workflow', { id })
}

export function exportItems(path: string, ids: string[]) {
  return invoke<ExportItemsResponse>('export_items', { path, ids })
}

export function importItems(path: string) {
  return invoke<ImportItemsResponse>('import_items', { path })
}

export function previewImportItems(path: string) {
  return invoke<ImportItemsPreviewResponse>('preview_import_items', { path })
}

export function backupDatabase(path: string) {
  return invoke<FileOperationResponse>('backup_database', { path })
}

export function restoreDatabase(path: string) {
  return invoke<FileOperationResponse>('restore_database', { path })
}

export function runDatabaseHealthCheck() {
  return invoke<DatabaseHealthReport>('run_database_health_check')
}

export function runDataConsistencyCheck() {
  return invoke<DatabaseConsistencyReport>('run_data_consistency_check')
}

export function optimizeDatabase() {
  return invoke<DatabaseMaintenanceResponse>('optimize_database')
}

export function openBackupsDirectory() {
  return invoke<FileOperationResponse>('open_backups_directory')
}

export function exportTextReport(path: string, title: string, lines: string[]) {
  return invoke<ExportTextReportResponse>('export_text_report', { path, title, lines })
}

export function exportStructuredReport(path: string, title: string, payload: unknown) {
  return invoke<FileOperationResponse>('export_structured_report', { path, title, payload })
}
