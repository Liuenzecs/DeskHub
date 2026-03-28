export type ItemType = 'app' | 'project' | 'folder' | 'url' | 'script' | 'workflow'

export type WorkflowStepType = 'open_path' | 'open_url' | 'run_command'

export type CommandExecutionMode = 'blocking' | 'new_terminal' | 'background'

export type OverviewSectionId = 'recent' | 'favorites' | 'workflows' | 'library'
export type OverviewWorkflowLinkMode = 'none' | 'prioritize_workflows'

export type WorkflowFailureStrategy = 'stop' | 'continue' | 'retry'

export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'not_empty'

export type WorkflowConditionFailAction = 'skip' | 'jump'

export type WorkflowStepStatus = 'completed' | 'failed' | 'continued' | 'skipped' | 'jumped'

export type CommandHistoryKind = 'item' | 'route' | 'action'

export type ListSortOption = 'recent' | 'name' | 'favorite'

export type ProjectImportConflictStrategy = 'skip_existing' | 'refresh_existing'

export type DataToolAction =
  | 'backup'
  | 'restore'
  | 'import'
  | 'import_bookmarks'
  | 'import_projects'
  | 'preview_import'
  | 'export_all'
  | 'export_workflows'
  | 'health_check'
  | 'consistency_check'
  | 'optimize_database'
  | 'clear_command_history'
  | 'export_structured_report'

export type DataToolOperationStatus = 'success' | 'warning' | 'error'

export type ConsistencyIssueSeverity = 'warning' | 'error'

export type CommandPaletteActionType =
  | 'set_default_workflow'
  | 'clear_default_workflow'
  | 'open_data_tools'
  | 'clear_recent_items'
  | 'clear_command_history'
  | 'create_item'
  | 'create_from_starter_template'
  | 'create_from_workflow_template'

export interface WorkflowStepCondition {
  variableKey: string
  operator: WorkflowConditionOperator
  value: string
  onFalseAction: WorkflowConditionFailAction
  jumpToStepId?: string | null
}

export interface OpenPathStep {
  id: string
  type: 'open_path'
  path: string
  note: string
  delayMs: number
  condition?: WorkflowStepCondition | null
}

export interface OpenUrlStep {
  id: string
  type: 'open_url'
  url: string
  note: string
  delayMs: number
  condition?: WorkflowStepCondition | null
}

export interface RunCommandStep {
  id: string
  type: 'run_command'
  command: string
  executionMode: CommandExecutionMode
  failureStrategy: WorkflowFailureStrategy
  retryCount: number
  retryDelayMs: number
  note: string
  delayMs: number
  condition?: WorkflowStepCondition | null
}

export type WorkflowStep = OpenPathStep | OpenUrlStep | RunCommandStep

export interface WorkflowStepResult {
  stepId: string
  stepIndex: number
  status: WorkflowStepStatus
  attempts: number
  message?: string | null
  targetStepId?: string | null
  targetStepIndex?: number | null
}

export interface WorkflowVariable {
  id: string
  key: string
  label: string
  defaultValue: string
  required: boolean
}

export interface WorkflowVariableInput {
  key: string
  value: string
}

export interface ItemBase {
  id: string
  name: string
  type: ItemType
  description: string
  tags: string[]
  icon: string
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastLaunchedAt: string | null
}

export interface AppItem extends ItemBase {
  type: 'app'
  launchTarget: string
}

export interface ProjectItem extends ItemBase {
  type: 'project'
  projectPath: string
  devCommand: string
}

export interface FolderItem extends ItemBase {
  type: 'folder'
  path: string
}

export interface UrlItem extends ItemBase {
  type: 'url'
  url: string
}

export interface ScriptItem extends ItemBase {
  type: 'script'
  command: string
  executionMode: CommandExecutionMode
}

export interface WorkflowItem extends ItemBase {
  type: 'workflow'
  variables: WorkflowVariable[]
  steps: WorkflowStep[]
}

export type DeskItem =
  | AppItem
  | ProjectItem
  | FolderItem
  | UrlItem
  | ScriptItem
  | WorkflowItem

interface ItemPayloadBase {
  name: string
  type: ItemType
  description: string
  tags: string[]
  icon: string
  favorite: boolean
}

export interface AppItemPayload extends ItemPayloadBase {
  type: 'app'
  launchTarget: string
}

export interface ProjectItemPayload extends ItemPayloadBase {
  type: 'project'
  projectPath: string
  devCommand: string
}

export interface FolderItemPayload extends ItemPayloadBase {
  type: 'folder'
  path: string
}

export interface UrlItemPayload extends ItemPayloadBase {
  type: 'url'
  url: string
}

export interface ScriptItemPayload extends ItemPayloadBase {
  type: 'script'
  command: string
  executionMode: CommandExecutionMode
}

export interface WorkflowItemPayload extends ItemPayloadBase {
  type: 'workflow'
  variables: WorkflowVariable[]
  steps: WorkflowStep[]
}

export type ItemPayload =
  | AppItemPayload
  | ProjectItemPayload
  | FolderItemPayload
  | UrlItemPayload
  | ScriptItemPayload
  | WorkflowItemPayload

export interface ItemCollection {
  items: DeskItem[]
}

export interface UiSettings {
  defaultWorkflowId: string | null
  autoBackupEnabled: boolean
  autoBackupIntervalHours: number
  backupRetentionCount: number
  diagnosticMode: boolean
  lastAutoBackupAt: string | null
  overviewSectionOrder: OverviewSectionId[]
  overviewHiddenSections: OverviewSectionId[]
  overviewLayoutTemplates: OverviewLayoutTemplate[]
  overviewWorkflowLinkMode: OverviewWorkflowLinkMode
}

export interface UiSettingsUpdatePayload {
  autoBackupEnabled: boolean
  autoBackupIntervalHours: number
  backupRetentionCount: number
  diagnosticMode: boolean
}

export interface OverviewLayoutPayload {
  sectionOrder: OverviewSectionId[]
  hiddenSections: OverviewSectionId[]
  layoutTemplates?: OverviewLayoutTemplate[]
  workflowLinkMode?: OverviewWorkflowLinkMode
}

export interface OverviewLayoutTemplate {
  id: string
  name: string
  sectionOrder: OverviewSectionId[]
  hiddenSections: OverviewSectionId[]
}

export interface LaunchResponse {
  item: DeskItem
  success: boolean
  message: string
  failedStepIndex?: number | null
  failedStepType?: WorkflowStepType | null
  failedStepValue?: string | null
  startedStepIndex?: number | null
  executedStepCount?: number | null
  totalStepCount?: number | null
  usedWorkflowVariables?: WorkflowVariableInput[] | null
  warningCount?: number | null
  stepResults?: WorkflowStepResult[] | null
}

export interface CommandHistoryEntry {
  kind: CommandHistoryKind
  target: string
  title: string
  lastUsedAt: string
  useCount: number
}

export interface CommandHistoryCollection {
  entries: CommandHistoryEntry[]
}

export interface CommandHistoryPayload {
  kind: CommandHistoryKind
  target: string
  title: string
}

export interface DataToolHistoryExtra {
  sha256?: string
  sourceSha256?: string
  schemaVersion?: number
  itemCount?: number
  workflowCount?: number
  quickCheck?: string
  foreignKeysEnabled?: boolean
  backupsDirectory?: string
  issueCount?: number
  warningCount?: number
  errorCount?: number
  previewValidCount?: number
  previewInvalidCount?: number
  clearedCount?: number
  pageCountBefore?: number
  pageCountAfter?: number
  freelistCountBefore?: number
  freelistCountAfter?: number
  sizeBeforeBytes?: number
  sizeAfterBytes?: number
  restoreBeforeItemCount?: number
  restoreAfterItemCount?: number
  restoreAddedCount?: number
  restoreRemovedCount?: number
  restoreUpdatedCount?: number
  tableCounts: Record<string, number>
}

export interface DataToolHistoryEntry {
  id: string
  action: DataToolAction
  status: DataToolOperationStatus
  title: string
  summary: string
  occurredAt: string
  sourcePath?: string
  outputPath?: string
  backupPath?: string
  itemNames: string[]
  errors: string[]
  extra: DataToolHistoryExtra
}

export interface DataToolHistoryPayload {
  action: DataToolAction
  status: DataToolOperationStatus
  title: string
  summary: string
  sourcePath?: string
  outputPath?: string
  backupPath?: string
  itemNames?: string[]
  errors?: string[]
  extra?: Partial<DataToolHistoryExtra>
}

export interface DataToolHistoryCollection {
  records: DataToolHistoryEntry[]
}

export interface DeleteItemsResponse {
  ids: string[]
}

export interface ClearRecentItemsResponse {
  cleared: number
}

export interface ExportItemsResponse {
  path: string
  exportedCount: number
}

export interface FileOperationResponse {
  path: string
  backupPath?: string
  sha256?: string
  sourceSha256?: string
  schemaVersion?: number
  itemCount?: number
  workflowCount?: number
  backupsDirectory?: string
  restoreDiff?: RestoreDiffSummary
}

export interface RestoreDiffSummary {
  beforeItemCount: number
  afterItemCount: number
  addedCount: number
  removedCount: number
  updatedCount: number
}

export interface ImportItemsResponse {
  items: DeskItem[]
  errors: string[]
}

export interface ImportPreviewItem {
  index: number
  name: string
  type: ItemType
  tags: string[]
  stepCount?: number
  target?: string
}

export interface ImportItemsPreviewResponse {
  path: string
  version: number
  validCount: number
  invalidCount: number
  items: ImportPreviewItem[]
  errors: string[]
}

export interface ClearDataToolHistoryResponse {
  cleared: number
}

export interface ClearCommandHistoryResponse {
  cleared: number
}

export interface DatabaseHealthReport {
  checkedAt: string
  path: string
  backupsDirectory: string
  schemaVersion: number
  quickCheck: string
  foreignKeysEnabled: boolean
  tableCounts: Record<string, number>
}

export interface DatabaseConsistencyIssue {
  severity: ConsistencyIssueSeverity
  code: string
  message: string
  itemId?: string
  stepId?: string
}

export interface DatabaseConsistencyReport {
  checkedAt: string
  path: string
  ok: boolean
  issueCount: number
  warningCount: number
  errorCount: number
  issues: DatabaseConsistencyIssue[]
  tableCounts: Record<string, number>
}

export interface DatabaseMaintenanceResponse {
  path: string
  quickCheck: string
  pageCountBefore: number
  pageCountAfter: number
  freelistCountBefore: number
  freelistCountAfter: number
  sizeBeforeBytes: number
  sizeAfterBytes: number
}

export interface ExportTextReportResponse {
  path: string
  lineCount: number
}

export interface ProjectInspectionResult {
  suggestedName?: string
  suggestedCommand?: string
  commandSuggestions: string[]
  detectedFiles: string[]
}

export interface ProjectImportCandidate {
  path: string
  relativePath: string
  depth: number
  suggestedName: string
  suggestedCommand?: string | null
  detectedFiles: string[]
  existingItemId?: string | null
  existingItemName?: string | null
}

export interface ProjectDirectoryScanOptions {
  scanDepth: number
  excludePatterns: string[]
}

export interface ProjectDirectoryImportOptions {
  conflictStrategy: ProjectImportConflictStrategy
}

export interface ProjectImportPreferences {
  recentRootPath: string | null
  scanDepth: number
  excludePatterns: string[]
  conflictStrategy: ProjectImportConflictStrategy
}

export interface ProjectDirectoryScanResponse {
  rootPath: string
  scanDepth: number
  scannedDirectoryCount: number
  skippedDirectoryCount: number
  importableCount: number
  existingCount: number
  excludePatterns: string[]
  candidates: ProjectImportCandidate[]
}

export interface ImportProjectDirectoriesResponse {
  items: DeskItem[]
  updatedPaths: string[]
  skippedPaths: string[]
  errors: string[]
}

export interface BrowserBookmarkSource {
  id: string
  browser: string
  profileName: string
  bookmarksPath: string
  bookmarkCount: number
}

export interface BrowserBookmarkCandidate {
  id: string
  browser: string
  profileName: string
  sourcePath: string
  name: string
  url: string
  folderPath: string
  existingItemId?: string | null
  existingItemName?: string | null
}

export interface BrowserBookmarkScanResponse {
  sourceCount: number
  candidateCount: number
  importableCount: number
  existingCount: number
  sources: BrowserBookmarkSource[]
  candidates: BrowserBookmarkCandidate[]
}

export interface BrowserBookmarkImportEntry {
  browser: string
  profileName: string
  sourcePath: string
  name: string
  url: string
  folderPath: string
}

export interface ImportBrowserBookmarksResponse {
  items: DeskItem[]
  skippedUrls: string[]
  errors: string[]
}

export type BatchTagMode = 'replace' | 'append'

export interface BatchEditItemsPayload {
  ids: string[]
  description?: string
  icon?: string
  tags?: string[]
  tagMode?: BatchTagMode
}

export interface SelectionInteraction {
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export interface ItemsExportFile {
  version: number
  exportedAt: string
  items: DeskItem[]
}

export interface CommandPaletteBaseEntry {
  id: string
  kind: 'item' | 'route' | 'action'
  title: string
  subtitle: string
  keywords: string[]
  searchText: string
}

export interface CommandPaletteItemEntry extends CommandPaletteBaseEntry {
  kind: 'item'
  item: DeskItem
}

export interface CommandPaletteRouteEntry extends CommandPaletteBaseEntry {
  kind: 'route'
  route: string
}

export interface CommandPaletteActionEntry extends CommandPaletteBaseEntry {
  kind: 'action'
  action: CommandPaletteActionType
  workflowId?: string
  itemType?: ItemType
  templateId?: string
  initialValues?: Partial<ItemFormValues>
}

export type CommandPaletteEntry =
  | CommandPaletteItemEntry
  | CommandPaletteRouteEntry
  | CommandPaletteActionEntry

export interface ItemFormValues {
  name: string
  type: ItemType
  description: string
  tags: string
  icon: string
  favorite: boolean
  launchTarget: string
  projectPath: string
  devCommand: string
  path: string
  url: string
  command: string
  executionMode: CommandExecutionMode
  variables: WorkflowVariable[]
  steps: WorkflowStep[]
}

export type ItemFormErrors = Partial<
  Record<'name' | 'launchTarget' | 'projectPath' | 'path' | 'url' | 'command' | 'steps', string>
>
