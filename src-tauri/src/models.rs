use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemCollection {
    pub items: Vec<DeskItem>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandHistoryCollection {
    pub entries: Vec<CommandHistoryEntry>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataToolHistoryCollection {
    pub records: Vec<DataToolHistoryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UiSettings {
    pub default_workflow_id: Option<String>,
    pub auto_backup_enabled: bool,
    pub auto_backup_interval_hours: u32,
    pub backup_retention_count: u32,
    pub diagnostic_mode: bool,
    pub last_auto_backup_at: Option<String>,
    #[serde(default = "default_overview_section_order")]
    pub overview_section_order: Vec<OverviewSectionId>,
    #[serde(default)]
    pub overview_hidden_sections: Vec<OverviewSectionId>,
    #[serde(default)]
    pub overview_layout_templates: Vec<OverviewLayoutTemplate>,
    #[serde(default)]
    pub overview_workflow_link_mode: OverviewWorkflowLinkMode,
}

impl Default for UiSettings {
    fn default() -> Self {
        Self {
            default_workflow_id: None,
            auto_backup_enabled: true,
            auto_backup_interval_hours: 24,
            backup_retention_count: 7,
            diagnostic_mode: false,
            last_auto_backup_at: None,
            overview_section_order: default_overview_section_order(),
            overview_hidden_sections: Vec::new(),
            overview_layout_templates: Vec::new(),
            overview_workflow_link_mode: OverviewWorkflowLinkMode::None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UiSettingsPayload {
    pub auto_backup_enabled: bool,
    pub auto_backup_interval_hours: u32,
    pub backup_retention_count: u32,
    pub diagnostic_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OverviewSectionId {
    Recent,
    Favorites,
    Workflows,
    Library,
}

impl OverviewSectionId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Recent => "recent",
            Self::Favorites => "favorites",
            Self::Workflows => "workflows",
            Self::Library => "library",
        }
    }
}

pub fn default_overview_section_order() -> Vec<OverviewSectionId> {
    vec![
        OverviewSectionId::Recent,
        OverviewSectionId::Favorites,
        OverviewSectionId::Workflows,
        OverviewSectionId::Library,
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OverviewLayoutPayload {
    pub section_order: Vec<OverviewSectionId>,
    #[serde(default)]
    pub hidden_sections: Vec<OverviewSectionId>,
    #[serde(default)]
    pub layout_templates: Option<Vec<OverviewLayoutTemplate>>,
    #[serde(default)]
    pub workflow_link_mode: Option<OverviewWorkflowLinkMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OverviewLayoutTemplate {
    pub id: String,
    pub name: String,
    pub section_order: Vec<OverviewSectionId>,
    #[serde(default)]
    pub hidden_sections: Vec<OverviewSectionId>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OverviewWorkflowLinkMode {
    #[default]
    None,
    PrioritizeWorkflows,
}

impl OverviewWorkflowLinkMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::None => "none",
            Self::PrioritizeWorkflows => "prioritize_workflows",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResponse {
    pub item: DeskItem,
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_step_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_step_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_step_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_step_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executed_step_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_step_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_workflow_variables: Option<Vec<WorkflowVariableInput>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_results: Option<Vec<WorkflowStepResult>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteItemsResponse {
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearRecentItemsResponse {
    pub cleared: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportItemsResponse {
    pub path: String,
    pub exported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearDataToolHistoryResponse {
    pub cleared: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearCommandHistoryResponse {
    pub cleared: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationResponse {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_version: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backups_directory: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restore_diff: Option<RestoreDiffSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreDiffSummary {
    pub before_item_count: usize,
    pub after_item_count: usize,
    pub added_count: usize,
    pub removed_count: usize,
    pub updated_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportItemsResponse {
    pub items: Vec<DeskItem>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewItem {
    pub index: usize,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportItemsPreviewResponse {
    pub path: String,
    pub version: u32,
    pub valid_count: usize,
    pub invalid_count: usize,
    pub items: Vec<ImportPreviewItem>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DataToolAction {
    Backup,
    Restore,
    Import,
    ImportBookmarks,
    ImportProjects,
    PreviewImport,
    ExportAll,
    ExportWorkflows,
    HealthCheck,
    ConsistencyCheck,
    OptimizeDatabase,
    ClearCommandHistory,
    ExportStructuredReport,
}

impl DataToolAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Backup => "backup",
            Self::Restore => "restore",
            Self::Import => "import",
            Self::ImportBookmarks => "import_bookmarks",
            Self::ImportProjects => "import_projects",
            Self::PreviewImport => "preview_import",
            Self::ExportAll => "export_all",
            Self::ExportWorkflows => "export_workflows",
            Self::HealthCheck => "health_check",
            Self::ConsistencyCheck => "consistency_check",
            Self::OptimizeDatabase => "optimize_database",
            Self::ClearCommandHistory => "clear_command_history",
            Self::ExportStructuredReport => "export_structured_report",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DataToolOperationStatus {
    Success,
    Warning,
    Error,
}

impl DataToolOperationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DataToolHistoryExtra {
    pub sha256: Option<String>,
    pub source_sha256: Option<String>,
    pub schema_version: Option<i64>,
    pub item_count: Option<usize>,
    pub workflow_count: Option<usize>,
    pub quick_check: Option<String>,
    pub foreign_keys_enabled: Option<bool>,
    pub backups_directory: Option<String>,
    pub issue_count: Option<usize>,
    pub warning_count: Option<usize>,
    pub error_count: Option<usize>,
    pub preview_valid_count: Option<usize>,
    pub preview_invalid_count: Option<usize>,
    pub cleared_count: Option<usize>,
    pub page_count_before: Option<i64>,
    pub page_count_after: Option<i64>,
    pub freelist_count_before: Option<i64>,
    pub freelist_count_after: Option<i64>,
    pub size_before_bytes: Option<u64>,
    pub size_after_bytes: Option<u64>,
    pub restore_before_item_count: Option<usize>,
    pub restore_after_item_count: Option<usize>,
    pub restore_added_count: Option<usize>,
    pub restore_removed_count: Option<usize>,
    pub restore_updated_count: Option<usize>,
    #[serde(default)]
    pub table_counts: BTreeMap<String, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DataToolHistoryEntry {
    pub id: String,
    pub action: DataToolAction,
    pub status: DataToolOperationStatus,
    pub title: String,
    pub summary: String,
    pub occurred_at: String,
    pub source_path: Option<String>,
    pub output_path: Option<String>,
    pub backup_path: Option<String>,
    pub item_names: Vec<String>,
    pub errors: Vec<String>,
    #[serde(default)]
    pub extra: DataToolHistoryExtra,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataToolHistoryPayload {
    pub action: DataToolAction,
    pub status: DataToolOperationStatus,
    pub title: String,
    pub summary: String,
    pub source_path: Option<String>,
    pub output_path: Option<String>,
    pub backup_path: Option<String>,
    #[serde(default)]
    pub item_names: Vec<String>,
    #[serde(default)]
    pub errors: Vec<String>,
    #[serde(default)]
    pub extra: DataToolHistoryExtra,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseHealthReport {
    pub checked_at: String,
    pub path: String,
    pub backups_directory: String,
    pub schema_version: i64,
    pub quick_check: String,
    pub foreign_keys_enabled: bool,
    pub table_counts: BTreeMap<String, i64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConsistencyIssueSeverity {
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConsistencyIssue {
    pub severity: ConsistencyIssueSeverity,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConsistencyReport {
    pub checked_at: String,
    pub path: String,
    pub ok: bool,
    pub issue_count: usize,
    pub warning_count: usize,
    pub error_count: usize,
    pub issues: Vec<DatabaseConsistencyIssue>,
    pub table_counts: BTreeMap<String, i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseMaintenanceResponse {
    pub path: String,
    pub quick_check: String,
    pub page_count_before: i64,
    pub page_count_after: i64,
    pub freelist_count_before: i64,
    pub freelist_count_after: i64,
    pub size_before_bytes: u64,
    pub size_after_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTextReportResponse {
    pub path: String,
    pub line_count: usize,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectImportConflictStrategy {
    #[default]
    SkipExisting,
    RefreshExisting,
}

fn default_project_import_scan_depth() -> usize {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDirectoryScanOptions {
    #[serde(default = "default_project_import_scan_depth")]
    pub scan_depth: usize,
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
}

impl Default for ProjectDirectoryScanOptions {
    fn default() -> Self {
        Self {
            scan_depth: default_project_import_scan_depth(),
            exclude_patterns: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDirectoryImportOptions {
    #[serde(default)]
    pub conflict_strategy: ProjectImportConflictStrategy,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInspectionResult {
    pub suggested_name: Option<String>,
    pub suggested_command: Option<String>,
    #[serde(default)]
    pub command_suggestions: Vec<String>,
    pub detected_files: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectImportCandidate {
    pub path: String,
    pub relative_path: String,
    pub depth: usize,
    pub suggested_name: String,
    pub suggested_command: Option<String>,
    #[serde(default)]
    pub detected_files: Vec<String>,
    pub existing_item_id: Option<String>,
    pub existing_item_name: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDirectoryScanResponse {
    pub root_path: String,
    pub scan_depth: usize,
    pub scanned_directory_count: usize,
    pub skipped_directory_count: usize,
    pub importable_count: usize,
    pub existing_count: usize,
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
    #[serde(default)]
    pub candidates: Vec<ProjectImportCandidate>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProjectDirectoriesResponse {
    #[serde(default)]
    pub items: Vec<DeskItem>,
    #[serde(default)]
    pub updated_paths: Vec<String>,
    #[serde(default)]
    pub skipped_paths: Vec<String>,
    #[serde(default)]
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmarkSource {
    pub id: String,
    pub browser: String,
    pub profile_name: String,
    pub bookmarks_path: String,
    pub bookmark_count: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmarkCandidate {
    pub id: String,
    pub browser: String,
    pub profile_name: String,
    pub source_path: String,
    pub name: String,
    pub url: String,
    pub folder_path: String,
    pub existing_item_id: Option<String>,
    pub existing_item_name: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmarkScanResponse {
    pub source_count: usize,
    pub candidate_count: usize,
    pub importable_count: usize,
    pub existing_count: usize,
    #[serde(default)]
    pub sources: Vec<BrowserBookmarkSource>,
    #[serde(default)]
    pub candidates: Vec<BrowserBookmarkCandidate>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmarkImportEntry {
    pub browser: String,
    pub profile_name: String,
    pub source_path: String,
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub folder_path: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBrowserBookmarksResponse {
    #[serde(default)]
    pub items: Vec<DeskItem>,
    #[serde(default)]
    pub skipped_urls: Vec<String>,
    #[serde(default)]
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowVariable {
    pub id: String,
    pub key: String,
    pub label: String,
    pub default_value: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowVariableInput {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowConditionOperator {
    Equals,
    NotEquals,
    Contains,
    NotContains,
    IsEmpty,
    NotEmpty,
}

impl Default for WorkflowConditionOperator {
    fn default() -> Self {
        Self::Equals
    }
}

impl WorkflowConditionOperator {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Equals => "equals",
            Self::NotEquals => "not_equals",
            Self::Contains => "contains",
            Self::NotContains => "not_contains",
            Self::IsEmpty => "is_empty",
            Self::NotEmpty => "not_empty",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowConditionFailAction {
    Skip,
    Jump,
}

impl Default for WorkflowConditionFailAction {
    fn default() -> Self {
        Self::Skip
    }
}

impl WorkflowConditionFailAction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Skip => "skip",
            Self::Jump => "jump",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStepCondition {
    pub variable_key: String,
    #[serde(default)]
    pub operator: WorkflowConditionOperator,
    #[serde(default)]
    pub value: String,
    #[serde(default)]
    pub on_false_action: WorkflowConditionFailAction,
    pub jump_to_step_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BatchTagMode {
    Replace,
    Append,
}

impl Default for BatchTagMode {
    fn default() -> Self {
        Self::Replace
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchEditItemsPayload {
    pub ids: Vec<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub tag_mode: BatchTagMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemsExportFile {
    pub version: u32,
    pub exported_at: String,
    pub items: Vec<DeskItem>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CommandExecutionMode {
    Blocking,
    NewTerminal,
    Background,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowFailureStrategy {
    Stop,
    Continue,
    Retry,
}

impl Default for WorkflowFailureStrategy {
    fn default() -> Self {
        Self::Stop
    }
}

impl WorkflowFailureStrategy {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stop => "stop",
            Self::Continue => "continue",
            Self::Retry => "retry",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStepStatus {
    Completed,
    Failed,
    Continued,
    Skipped,
    Jumped,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStepResult {
    pub step_id: String,
    pub step_index: usize,
    pub status: WorkflowStepStatus,
    pub attempts: usize,
    pub message: Option<String>,
    pub target_step_id: Option<String>,
    pub target_step_index: Option<usize>,
}

impl Default for CommandExecutionMode {
    fn default() -> Self {
        Self::Blocking
    }
}

impl CommandExecutionMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Blocking => "blocking",
            Self::NewTerminal => "new_terminal",
            Self::Background => "background",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CommandHistoryKind {
    Item,
    Route,
    Action,
}

impl CommandHistoryKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Item => "item",
            Self::Route => "route",
            Self::Action => "action",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandHistoryEntry {
    pub kind: CommandHistoryKind,
    pub target: String,
    pub title: String,
    pub last_used_at: String,
    pub use_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandHistoryPayload {
    pub kind: CommandHistoryKind,
    pub target: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemBase {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub icon: String,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_launched_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DeskItem {
    App {
        #[serde(flatten)]
        base: ItemBase,
        #[serde(rename = "launchTarget")]
        launch_target: String,
    },
    Project {
        #[serde(flatten)]
        base: ItemBase,
        #[serde(rename = "projectPath")]
        project_path: String,
        #[serde(rename = "devCommand")]
        dev_command: String,
    },
    Folder {
        #[serde(flatten)]
        base: ItemBase,
        path: String,
    },
    Url {
        #[serde(flatten)]
        base: ItemBase,
        url: String,
    },
    Script {
        #[serde(flatten)]
        base: ItemBase,
        command: String,
        #[serde(default, rename = "executionMode")]
        execution_mode: CommandExecutionMode,
    },
    Workflow {
        #[serde(flatten)]
        base: ItemBase,
        #[serde(default)]
        variables: Vec<WorkflowVariable>,
        steps: Vec<WorkflowStep>,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayloadBase {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub icon: String,
    pub favorite: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ItemPayload {
    App {
        #[serde(flatten)]
        base: PayloadBase,
        #[serde(rename = "launchTarget")]
        launch_target: String,
    },
    Project {
        #[serde(flatten)]
        base: PayloadBase,
        #[serde(rename = "projectPath")]
        project_path: String,
        #[serde(rename = "devCommand")]
        dev_command: String,
    },
    Folder {
        #[serde(flatten)]
        base: PayloadBase,
        path: String,
    },
    Url {
        #[serde(flatten)]
        base: PayloadBase,
        url: String,
    },
    Script {
        #[serde(flatten)]
        base: PayloadBase,
        command: String,
        #[serde(default, rename = "executionMode")]
        execution_mode: CommandExecutionMode,
    },
    Workflow {
        #[serde(flatten)]
        base: PayloadBase,
        #[serde(default)]
        variables: Vec<WorkflowVariable>,
        steps: Vec<WorkflowStep>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkflowStep {
    OpenPath {
        id: String,
        path: String,
        #[serde(default)]
        note: String,
        #[serde(default, rename = "delayMs")]
        delay_ms: u64,
        #[serde(default)]
        condition: Option<WorkflowStepCondition>,
    },
    OpenUrl {
        id: String,
        url: String,
        #[serde(default)]
        note: String,
        #[serde(default, rename = "delayMs")]
        delay_ms: u64,
        #[serde(default)]
        condition: Option<WorkflowStepCondition>,
    },
    RunCommand {
        id: String,
        command: String,
        #[serde(default, rename = "executionMode")]
        execution_mode: CommandExecutionMode,
        #[serde(default, rename = "failureStrategy")]
        failure_strategy: WorkflowFailureStrategy,
        #[serde(default, rename = "retryCount")]
        retry_count: u32,
        #[serde(default, rename = "retryDelayMs")]
        retry_delay_ms: u64,
        #[serde(default)]
        note: String,
        #[serde(default, rename = "delayMs")]
        delay_ms: u64,
        #[serde(default)]
        condition: Option<WorkflowStepCondition>,
    },
}

fn clean_text(value: &str) -> String {
    value.trim().to_string()
}

fn clean_tags(tags: &[String]) -> Vec<String> {
    tags.iter()
        .map(|tag| clean_text(tag))
        .filter(|tag| !tag.is_empty())
        .collect()
}

impl PayloadBase {
    fn validate(&self) -> Result<(), String> {
        if clean_text(&self.name).is_empty() {
            return Err("Name is required.".into());
        }

        Ok(())
    }

    fn into_item_base(
        &self,
        id: String,
        created_at: String,
        updated_at: String,
        last_launched_at: Option<String>,
    ) -> ItemBase {
        ItemBase {
            id,
            name: clean_text(&self.name),
            description: clean_text(&self.description),
            tags: clean_tags(&self.tags),
            icon: clean_text(&self.icon),
            favorite: self.favorite,
            created_at,
            updated_at,
            last_launched_at,
        }
    }
}

impl CommandHistoryPayload {
    pub fn validate(&self) -> Result<(), String> {
        if clean_text(&self.target).is_empty() {
            return Err("History target is required.".into());
        }

        if clean_text(&self.title).is_empty() {
            return Err("History title is required.".into());
        }

        Ok(())
    }

    pub fn normalized(&self) -> Self {
        Self {
            kind: self.kind,
            target: clean_text(&self.target),
            title: clean_text(&self.title),
        }
    }
}

impl DataToolHistoryPayload {
    pub fn validate(&self) -> Result<(), String> {
        if clean_text(&self.title).is_empty() {
            return Err("Data tool history title is required.".into());
        }

        if clean_text(&self.summary).is_empty() {
            return Err("Data tool history summary is required.".into());
        }

        Ok(())
    }

    pub fn normalized(&self) -> Self {
        Self {
            action: self.action.clone(),
            status: self.status.clone(),
            title: clean_text(&self.title),
            summary: clean_text(&self.summary),
            source_path: self
                .source_path
                .as_ref()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty()),
            output_path: self
                .output_path
                .as_ref()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty()),
            backup_path: self
                .backup_path
                .as_ref()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty()),
            item_names: self
                .item_names
                .iter()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty())
                .collect(),
            errors: self
                .errors
                .iter()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty())
                .collect(),
            extra: DataToolHistoryExtra {
                sha256: self
                    .extra
                    .sha256
                    .as_ref()
                    .map(|value| clean_text(value))
                    .filter(|value| !value.is_empty()),
                source_sha256: self
                    .extra
                    .source_sha256
                    .as_ref()
                    .map(|value| clean_text(value))
                    .filter(|value| !value.is_empty()),
                schema_version: self.extra.schema_version,
                item_count: self.extra.item_count,
                workflow_count: self.extra.workflow_count,
                quick_check: self
                    .extra
                    .quick_check
                    .as_ref()
                    .map(|value| clean_text(value))
                    .filter(|value| !value.is_empty()),
                foreign_keys_enabled: self.extra.foreign_keys_enabled,
                backups_directory: self
                    .extra
                    .backups_directory
                    .as_ref()
                    .map(|value| clean_text(value))
                    .filter(|value| !value.is_empty()),
                issue_count: self.extra.issue_count,
                warning_count: self.extra.warning_count,
                error_count: self.extra.error_count,
                preview_valid_count: self.extra.preview_valid_count,
                preview_invalid_count: self.extra.preview_invalid_count,
                cleared_count: self.extra.cleared_count,
                page_count_before: self.extra.page_count_before,
                page_count_after: self.extra.page_count_after,
                freelist_count_before: self.extra.freelist_count_before,
                freelist_count_after: self.extra.freelist_count_after,
                size_before_bytes: self.extra.size_before_bytes,
                size_after_bytes: self.extra.size_after_bytes,
                restore_before_item_count: self.extra.restore_before_item_count,
                restore_after_item_count: self.extra.restore_after_item_count,
                restore_added_count: self.extra.restore_added_count,
                restore_removed_count: self.extra.restore_removed_count,
                restore_updated_count: self.extra.restore_updated_count,
                table_counts: self.extra.table_counts.clone(),
            },
        }
    }
}

impl UiSettingsPayload {
    pub fn validate(&self) -> Result<(), String> {
        if self.auto_backup_interval_hours == 0 {
            return Err("Auto backup interval must be at least 1 hour.".into());
        }

        if self.backup_retention_count == 0 {
            return Err("Backup retention count must be at least 1.".into());
        }

        Ok(())
    }
}

impl OverviewLayoutPayload {
    pub fn validate(&self) -> Result<(), String> {
        if self.section_order.is_empty() {
            return Err("Overview section order cannot be empty.".into());
        }

        let mut seen_sections = std::collections::HashSet::new();
        for section in &self.section_order {
            if !seen_sections.insert(section.as_str()) {
                return Err("Overview section order cannot contain duplicates.".into());
            }
        }

        let allowed_sections = default_overview_section_order()
            .into_iter()
            .map(|section| section.as_str())
            .collect::<std::collections::HashSet<_>>();

        for section in &self.hidden_sections {
            if !allowed_sections.contains(section.as_str()) {
                return Err("Overview hidden sections contain an unknown section.".into());
            }
        }

        if let Some(layout_templates) = &self.layout_templates {
            if layout_templates.len() > 12 {
                return Err("Overview layout templates cannot exceed 12 entries.".into());
            }

            let mut template_ids = std::collections::HashSet::new();
            for layout_template in layout_templates {
                layout_template.validate()?;
                if !template_ids.insert(clean_text(&layout_template.id)) {
                    return Err("Overview layout template ids must be unique.".into());
                }
            }
        }

        Ok(())
    }

    pub fn normalized(&self) -> Self {
        let default_order = default_overview_section_order();
        let mut seen_sections = std::collections::HashSet::new();
        let mut section_order = self
            .section_order
            .iter()
            .filter(|section| seen_sections.insert(section.as_str()))
            .cloned()
            .collect::<Vec<_>>();

        for section in default_order {
            if !seen_sections.contains(section.as_str()) {
                section_order.push(section);
            }
        }

        let order_lookup = section_order
            .iter()
            .enumerate()
            .map(|(index, section)| (section.as_str(), index))
            .collect::<std::collections::HashMap<_, _>>();

        let mut hidden_seen = std::collections::HashSet::new();
        let mut hidden_sections = self
            .hidden_sections
            .iter()
            .filter(|section| hidden_seen.insert(section.as_str()))
            .cloned()
            .collect::<Vec<_>>();

        hidden_sections.sort_by_key(|section| {
            order_lookup
                .get(section.as_str())
                .copied()
                .unwrap_or(usize::MAX)
        });

        Self {
            section_order,
            hidden_sections,
            layout_templates: self
                .layout_templates
                .as_ref()
                .map(|layout_templates| {
                    layout_templates
                        .iter()
                        .map(OverviewLayoutTemplate::normalized)
                        .collect()
                }),
            workflow_link_mode: self.workflow_link_mode,
        }
    }
}

impl OverviewLayoutTemplate {
    pub fn validate(&self) -> Result<(), String> {
        if clean_text(&self.id).is_empty() {
            return Err("Overview layout templates need stable ids.".into());
        }

        if clean_text(&self.name).is_empty() {
            return Err("Overview layout templates need a name.".into());
        }

        let payload = OverviewLayoutPayload {
            section_order: self.section_order.clone(),
            hidden_sections: self.hidden_sections.clone(),
            layout_templates: None,
            workflow_link_mode: None,
        };
        payload.validate()?;
        Ok(())
    }

    pub fn normalized(&self) -> Self {
        let payload = OverviewLayoutPayload {
            section_order: self.section_order.clone(),
            hidden_sections: self.hidden_sections.clone(),
            layout_templates: None,
            workflow_link_mode: None,
        }
        .normalized();

        Self {
            id: clean_text(&self.id),
            name: clean_text(&self.name),
            section_order: payload.section_order,
            hidden_sections: payload.hidden_sections,
        }
    }
}

impl BatchEditItemsPayload {
    pub fn validate(&self) -> Result<(), String> {
        let has_ids = self.ids.iter().any(|id| !clean_text(id).is_empty());
        if !has_ids {
            return Err("Choose at least one item.".into());
        }

        let has_changes = self.description.is_some() || self.icon.is_some() || self.tags.is_some();
        if !has_changes {
            return Err("Choose at least one field to update.".into());
        }

        Ok(())
    }

    pub fn normalized(&self) -> Self {
        Self {
            ids: self.ids.iter().map(|id| clean_text(id)).collect(),
            description: self.description.as_ref().map(|value| clean_text(value)),
            icon: self.icon.as_ref().map(|value| clean_text(value)),
            tags: self.tags.as_ref().map(|tags| clean_tags(tags)),
            tag_mode: self.tag_mode,
        }
    }
}

impl WorkflowVariable {
    pub fn validate(&self) -> Result<(), String> {
        let key = clean_text(&self.key);
        if key.is_empty() {
            return Err("Workflow variable keys are required.".into());
        }

        let valid_key = key.chars().enumerate().all(|(index, character)| {
            if index == 0 {
                character.is_ascii_alphabetic()
            } else {
                character.is_ascii_alphanumeric() || character == '_'
            }
        });

        if !valid_key {
            return Err("Workflow variable keys must start with a letter and only use letters, numbers, or underscores.".into());
        }

        Ok(())
    }

    pub fn normalized(&self) -> Self {
        Self {
            id: clean_text(&self.id),
            key: clean_text(&self.key),
            label: clean_text(&self.label),
            default_value: clean_text(&self.default_value),
            required: self.required,
        }
    }
}

impl WorkflowVariableInput {
    pub fn normalized(&self) -> Self {
        Self {
            key: clean_text(&self.key),
            value: clean_text(&self.value),
        }
    }
}

impl WorkflowStepCondition {
    pub fn validate(&self) -> Result<(), String> {
        if clean_text(&self.variable_key).is_empty() {
            return Err("Workflow conditions must reference a variable key.".into());
        }

        if !matches!(
            self.operator,
            WorkflowConditionOperator::IsEmpty | WorkflowConditionOperator::NotEmpty
        ) && clean_text(&self.value).is_empty()
        {
            return Err("Workflow conditions need a comparison value.".into());
        }

        if matches!(self.on_false_action, WorkflowConditionFailAction::Jump)
            && self
                .jump_to_step_id
                .as_ref()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty())
                .is_none()
        {
            return Err("Workflow jump conditions need a target step.".into());
        }

        Ok(())
    }

    pub fn normalized(&self) -> Self {
        Self {
            variable_key: clean_text(&self.variable_key),
            operator: self.operator,
            value: clean_text(&self.value),
            on_false_action: self.on_false_action,
            jump_to_step_id: self
                .jump_to_step_id
                .as_ref()
                .map(|value| clean_text(value))
                .filter(|value| !value.is_empty()),
        }
    }
}

impl WorkflowStep {
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::OpenPath {
                path, condition, ..
            } => {
                if let Some(condition) = condition {
                    condition.validate()?;
                }

                if clean_text(path).is_empty() {
                    Err("Workflow path steps need a path.".into())
                } else {
                    Ok(())
                }
            }
            Self::OpenUrl { url, condition, .. } => {
                if let Some(condition) = condition {
                    condition.validate()?;
                }

                if clean_text(url).is_empty() {
                    return Err("Workflow URL steps need a URL.".into());
                }

                Url::parse(url).map_err(|_| "Workflow URL steps need a valid URL.".to_string())?;
                Ok(())
            }
            Self::RunCommand {
                command,
                failure_strategy,
                retry_count,
                condition,
                ..
            } => {
                if let Some(condition) = condition {
                    condition.validate()?;
                }

                if clean_text(command).is_empty() {
                    return Err("Workflow command steps need a command.".into());
                }

                if matches!(failure_strategy, WorkflowFailureStrategy::Retry) && *retry_count == 0 {
                    return Err("Workflow retry steps need retryCount to be at least 1.".into());
                }

                Ok(())
            }
        }
    }

    pub fn normalized(&self) -> Self {
        match self {
            Self::OpenPath {
                id,
                path,
                note,
                delay_ms,
                condition,
            } => Self::OpenPath {
                id: clean_text(id),
                path: clean_text(path),
                note: clean_text(note),
                delay_ms: *delay_ms,
                condition: condition.as_ref().map(WorkflowStepCondition::normalized),
            },
            Self::OpenUrl {
                id,
                url,
                note,
                delay_ms,
                condition,
            } => Self::OpenUrl {
                id: clean_text(id),
                url: clean_text(url),
                note: clean_text(note),
                delay_ms: *delay_ms,
                condition: condition.as_ref().map(WorkflowStepCondition::normalized),
            },
            Self::RunCommand {
                id,
                command,
                execution_mode,
                failure_strategy,
                retry_count,
                retry_delay_ms,
                note,
                delay_ms,
                condition,
            } => Self::RunCommand {
                id: clean_text(id),
                command: clean_text(command),
                execution_mode: *execution_mode,
                failure_strategy: *failure_strategy,
                retry_count: *retry_count,
                retry_delay_ms: *retry_delay_ms,
                note: clean_text(note),
                delay_ms: *delay_ms,
                condition: condition.as_ref().map(WorkflowStepCondition::normalized),
            },
        }
    }
}

impl ItemPayload {
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::App {
                base,
                launch_target,
            } => {
                base.validate()?;
                if clean_text(launch_target).is_empty() {
                    Err("Launch target is required.".into())
                } else {
                    Ok(())
                }
            }
            Self::Project {
                base, project_path, ..
            } => {
                base.validate()?;
                if clean_text(project_path).is_empty() {
                    Err("Project path is required.".into())
                } else {
                    Ok(())
                }
            }
            Self::Folder { base, path } => {
                base.validate()?;
                if clean_text(path).is_empty() {
                    Err("Folder path is required.".into())
                } else {
                    Ok(())
                }
            }
            Self::Url { base, url } => {
                base.validate()?;
                if clean_text(url).is_empty() {
                    return Err("URL is required.".into());
                }

                Url::parse(url).map_err(|_| "Enter a valid URL.".to_string())?;
                Ok(())
            }
            Self::Script { base, command, .. } => {
                base.validate()?;
                if clean_text(command).is_empty() {
                    Err("Command is required.".into())
                } else {
                    Ok(())
                }
            }
            Self::Workflow {
                base,
                variables,
                steps,
            } => {
                base.validate()?;
                if steps.is_empty() {
                    return Err("At least one workflow step is required.".into());
                }

                let mut variable_keys = std::collections::HashSet::new();
                for variable in variables {
                    variable.validate()?;
                    let normalized_key = clean_text(&variable.key);
                    if !variable_keys.insert(normalized_key) {
                        return Err("Workflow variable keys must be unique.".into());
                    }
                }

                let mut step_ids = std::collections::HashSet::new();
                for step in steps {
                    step.validate()?;

                    let step_id = match step {
                        WorkflowStep::OpenPath { id, .. }
                        | WorkflowStep::OpenUrl { id, .. }
                        | WorkflowStep::RunCommand { id, .. } => clean_text(id),
                    };

                    if step_id.is_empty() {
                        return Err("Workflow steps need stable ids.".into());
                    }

                    if !step_ids.insert(step_id) {
                        return Err("Workflow step ids must be unique.".into());
                    }
                }

                for step in steps {
                    let (step_id, condition) = match step {
                        WorkflowStep::OpenPath { id, condition, .. }
                        | WorkflowStep::OpenUrl { id, condition, .. }
                        | WorkflowStep::RunCommand { id, condition, .. } => {
                            (id, condition.as_ref())
                        }
                    };

                    let Some(condition) = condition else {
                        continue;
                    };

                    let normalized_variable_key = clean_text(&condition.variable_key);
                    if !variable_keys.contains(&normalized_variable_key) {
                        return Err(format!(
                            "Workflow condition references unknown variable key {}.",
                            normalized_variable_key
                        ));
                    }

                    if matches!(condition.on_false_action, WorkflowConditionFailAction::Jump) {
                        let target_step_id = condition
                            .jump_to_step_id
                            .as_ref()
                            .map(|value| clean_text(value))
                            .filter(|value| !value.is_empty())
                            .ok_or_else(|| {
                                "Workflow jump conditions need a target step.".to_string()
                            })?;

                        if target_step_id == clean_text(step_id) {
                            return Err("Workflow conditions cannot jump to the same step.".into());
                        }

                        if !step_ids.contains(&target_step_id) {
                            return Err(format!(
                                "Workflow jump conditions reference unknown step id {}.",
                                target_step_id
                            ));
                        }
                    }
                }

                Ok(())
            }
        }
    }

    pub fn into_item(
        &self,
        id: String,
        created_at: String,
        updated_at: String,
        last_launched_at: Option<String>,
    ) -> DeskItem {
        match self {
            Self::App {
                base,
                launch_target,
            } => DeskItem::App {
                base: base.into_item_base(id, created_at, updated_at, last_launched_at),
                launch_target: clean_text(launch_target),
            },
            Self::Project {
                base,
                project_path,
                dev_command,
            } => DeskItem::Project {
                base: base.into_item_base(id, created_at, updated_at, last_launched_at),
                project_path: clean_text(project_path),
                dev_command: clean_text(dev_command),
            },
            Self::Folder { base, path } => DeskItem::Folder {
                base: base.into_item_base(id, created_at, updated_at, last_launched_at),
                path: clean_text(path),
            },
            Self::Url { base, url } => DeskItem::Url {
                base: base.into_item_base(id, created_at, updated_at, last_launched_at),
                url: clean_text(url),
            },
            Self::Script {
                base,
                command,
                execution_mode,
            } => DeskItem::Script {
                base: base.into_item_base(id, created_at, updated_at, last_launched_at),
                command: clean_text(command),
                execution_mode: *execution_mode,
            },
            Self::Workflow {
                base,
                variables,
                steps,
            } => DeskItem::Workflow {
                base: base.into_item_base(id, created_at, updated_at, last_launched_at),
                variables: variables.iter().map(WorkflowVariable::normalized).collect(),
                steps: steps.iter().map(WorkflowStep::normalized).collect(),
            },
        }
    }
}

impl DeskItem {
    pub fn id(&self) -> &str {
        &self.base().id
    }

    pub fn name(&self) -> &str {
        &self.base().name
    }

    pub fn item_type(&self) -> &'static str {
        match self {
            Self::App { .. } => "app",
            Self::Project { .. } => "project",
            Self::Folder { .. } => "folder",
            Self::Url { .. } => "url",
            Self::Script { .. } => "script",
            Self::Workflow { .. } => "workflow",
        }
    }

    pub fn base(&self) -> &ItemBase {
        match self {
            Self::App { base, .. }
            | Self::Project { base, .. }
            | Self::Folder { base, .. }
            | Self::Url { base, .. }
            | Self::Script { base, .. }
            | Self::Workflow { base, .. } => base,
        }
    }
}
