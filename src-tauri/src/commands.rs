use std::path::PathBuf;

use tauri::State;

use crate::{
    launcher,
    models::{
        BatchEditItemsPayload, BrowserBookmarkImportEntry, BrowserBookmarkScanResponse,
        ClearCommandHistoryResponse, ClearDataToolHistoryResponse, ClearRecentItemsResponse,
        CommandHistoryCollection, CommandHistoryPayload, DataToolHistoryCollection,
        DataToolHistoryPayload, DatabaseConsistencyReport, DatabaseHealthReport,
        DatabaseMaintenanceResponse, DeleteItemsResponse, DeleteResponse, ExportItemsResponse,
        ExportTextReportResponse, FileOperationResponse, ImportBrowserBookmarksResponse,
        ImportItemsPreviewResponse, ImportItemsResponse, ImportProjectDirectoriesResponse,
        ItemCollection, ItemPayload, LaunchResponse, OverviewLayoutPayload,
        ProjectDirectoryImportOptions, ProjectDirectoryScanOptions, ProjectDirectoryScanResponse,
        ProjectInspectionResult, UiSettings, UiSettingsPayload, WorkflowVariableInput,
    },
    project_inspector,
    storage::StorageState,
};

fn to_error_message(error: anyhow::Error) -> String {
    error.to_string()
}

fn build_workflow_launch_message(
    item: &crate::models::DeskItem,
    started_step_index: Option<usize>,
    executed_step_count: Option<usize>,
    total_step_count: Option<usize>,
    warning_count: Option<usize>,
) -> String {
    if item.item_type() != "workflow" {
        return format!("已启动 {}。", item.name());
    }

    let started_step = started_step_index.unwrap_or(0) + 1;
    let executed = executed_step_count.unwrap_or(0);
    let total = total_step_count.unwrap_or(executed);
    let warning_suffix = warning_count
        .filter(|count| *count > 0)
        .map(|count| format!("（{count} 条 warning）"))
        .unwrap_or_default();

    if started_step <= 1 {
        format!(
            "已执行工作流 {}，共触发 {executed}/{total} 步。{}",
            item.name(),
            warning_suffix
        )
    } else {
        format!(
            "已从第 {started_step} 步开始执行工作流 {}，共触发 {executed}/{total} 步。{}",
            item.name(),
            warning_suffix
        )
    }
}

#[tauri::command]
pub fn get_items(state: State<'_, StorageState>) -> Result<ItemCollection, String> {
    state.get_items().map_err(to_error_message)
}

#[tauri::command]
pub fn get_command_history(
    state: State<'_, StorageState>,
) -> Result<CommandHistoryCollection, String> {
    state.get_command_history().map_err(to_error_message)
}

#[tauri::command]
pub fn get_data_tool_history(
    state: State<'_, StorageState>,
) -> Result<DataToolHistoryCollection, String> {
    state.get_data_tool_history().map_err(to_error_message)
}

#[tauri::command]
pub fn record_command_history(
    state: State<'_, StorageState>,
    payload: CommandHistoryPayload,
) -> Result<crate::models::CommandHistoryEntry, String> {
    state
        .record_command_history(&payload)
        .map_err(to_error_message)
}

#[tauri::command]
pub fn record_data_tool_history(
    state: State<'_, StorageState>,
    payload: DataToolHistoryPayload,
) -> Result<crate::models::DataToolHistoryEntry, String> {
    state
        .record_data_tool_history(&payload)
        .map_err(to_error_message)
}

#[tauri::command]
pub fn clear_data_tool_history(
    state: State<'_, StorageState>,
) -> Result<ClearDataToolHistoryResponse, String> {
    let cleared = state.clear_data_tool_history().map_err(to_error_message)?;
    Ok(ClearDataToolHistoryResponse { cleared })
}

#[tauri::command]
pub fn clear_command_history(
    state: State<'_, StorageState>,
) -> Result<ClearCommandHistoryResponse, String> {
    let cleared = state.clear_command_history().map_err(to_error_message)?;
    Ok(ClearCommandHistoryResponse { cleared })
}

#[tauri::command]
pub fn get_ui_settings(state: State<'_, StorageState>) -> Result<UiSettings, String> {
    state.get_ui_settings().map_err(to_error_message)
}

#[tauri::command]
pub fn update_ui_settings(
    state: State<'_, StorageState>,
    payload: UiSettingsPayload,
) -> Result<UiSettings, String> {
    state.update_ui_settings(&payload).map_err(to_error_message)
}

#[tauri::command]
pub fn update_overview_layout(
    state: State<'_, StorageState>,
    payload: OverviewLayoutPayload,
) -> Result<UiSettings, String> {
    state
        .update_overview_layout(&payload)
        .map_err(to_error_message)
}

#[tauri::command]
pub fn inspect_project_directory(path: String) -> Result<ProjectInspectionResult, String> {
    project_inspector::inspect_project_directory(PathBuf::from(path).as_path())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn scan_browser_bookmarks(
    state: State<'_, StorageState>,
) -> Result<BrowserBookmarkScanResponse, String> {
    state.scan_browser_bookmarks().map_err(to_error_message)
}

#[tauri::command]
pub fn import_browser_bookmarks(
    state: State<'_, StorageState>,
    entries: Vec<BrowserBookmarkImportEntry>,
) -> Result<ImportBrowserBookmarksResponse, String> {
    state
        .import_browser_bookmarks(&entries)
        .map_err(to_error_message)
}

#[tauri::command]
pub fn scan_project_directories(
    state: State<'_, StorageState>,
    path: String,
    options: Option<ProjectDirectoryScanOptions>,
) -> Result<ProjectDirectoryScanResponse, String> {
    state
        .scan_project_directories(PathBuf::from(path).as_path(), options.as_ref())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn import_project_directories(
    state: State<'_, StorageState>,
    paths: Vec<String>,
    options: Option<ProjectDirectoryImportOptions>,
) -> Result<ImportProjectDirectoriesResponse, String> {
    state
        .import_project_directories(&paths, options.as_ref())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn create_item(
    state: State<'_, StorageState>,
    payload: ItemPayload,
) -> Result<crate::models::DeskItem, String> {
    state.create_item(&payload).map_err(to_error_message)
}

#[tauri::command]
pub fn update_item(
    state: State<'_, StorageState>,
    id: String,
    payload: ItemPayload,
) -> Result<crate::models::DeskItem, String> {
    state.update_item(&id, &payload).map_err(to_error_message)
}

#[tauri::command]
pub fn delete_item(state: State<'_, StorageState>, id: String) -> Result<DeleteResponse, String> {
    state.delete_item(&id).map_err(to_error_message)?;
    Ok(DeleteResponse { id })
}

#[tauri::command]
pub fn delete_items(
    state: State<'_, StorageState>,
    ids: Vec<String>,
) -> Result<DeleteItemsResponse, String> {
    let ids = state.delete_items(&ids).map_err(to_error_message)?;
    Ok(DeleteItemsResponse { ids })
}

#[tauri::command]
pub fn toggle_favorite(
    state: State<'_, StorageState>,
    id: String,
    favorite: bool,
) -> Result<crate::models::DeskItem, String> {
    state
        .toggle_favorite(&id, favorite)
        .map_err(to_error_message)
}

#[tauri::command]
pub fn set_items_favorite(
    state: State<'_, StorageState>,
    ids: Vec<String>,
    favorite: bool,
) -> Result<ItemCollection, String> {
    let items = state
        .set_items_favorite(&ids, favorite)
        .map_err(to_error_message)?;
    Ok(ItemCollection { items })
}

#[tauri::command]
pub fn launch_item(state: State<'_, StorageState>, id: String) -> Result<LaunchResponse, String> {
    let item = state.find_item(&id).map_err(to_error_message)?;

    match launcher::launch(&item) {
        Ok(summary) => {
            let updated_item = state.mark_item_launched(&id).map_err(to_error_message)?;
            Ok(LaunchResponse {
                item: updated_item,
                success: true,
                message: build_workflow_launch_message(
                    &item,
                    summary.started_step_index,
                    summary.executed_step_count,
                    summary.total_step_count,
                    summary.warning_count,
                ),
                failed_step_index: None,
                failed_step_type: None,
                failed_step_value: None,
                started_step_index: summary.started_step_index,
                executed_step_count: summary.executed_step_count,
                total_step_count: summary.total_step_count,
                used_workflow_variables: summary.used_workflow_variables,
                warning_count: summary.warning_count,
                step_results: summary.step_results,
            })
        }
        Err(issue) => Ok(LaunchResponse {
            item,
            success: false,
            message: issue.message,
            failed_step_index: issue.failed_step_index,
            failed_step_type: issue.failed_step_type,
            failed_step_value: issue.failed_step_value,
            started_step_index: issue.started_step_index,
            executed_step_count: issue.executed_step_count,
            total_step_count: issue.total_step_count,
            used_workflow_variables: issue.used_workflow_variables,
            warning_count: issue.warning_count,
            step_results: issue.step_results,
        }),
    }
}

#[tauri::command]
pub fn launch_workflow(
    state: State<'_, StorageState>,
    id: String,
    start_step_index: Option<usize>,
    variable_inputs: Option<Vec<WorkflowVariableInput>>,
) -> Result<LaunchResponse, String> {
    let item = state.find_item(&id).map_err(to_error_message)?;

    match launcher::launch_workflow(
        &item,
        start_step_index.unwrap_or(0),
        variable_inputs.as_deref().unwrap_or(&[]),
    ) {
        Ok(summary) => {
            let updated_item = state.mark_item_launched(&id).map_err(to_error_message)?;
            Ok(LaunchResponse {
                item: updated_item,
                success: true,
                message: build_workflow_launch_message(
                    &item,
                    summary.started_step_index,
                    summary.executed_step_count,
                    summary.total_step_count,
                    summary.warning_count,
                ),
                failed_step_index: None,
                failed_step_type: None,
                failed_step_value: None,
                started_step_index: summary.started_step_index,
                executed_step_count: summary.executed_step_count,
                total_step_count: summary.total_step_count,
                used_workflow_variables: summary.used_workflow_variables,
                warning_count: summary.warning_count,
                step_results: summary.step_results,
            })
        }
        Err(issue) => Ok(LaunchResponse {
            item,
            success: false,
            message: issue.message,
            failed_step_index: issue.failed_step_index,
            failed_step_type: issue.failed_step_type,
            failed_step_value: issue.failed_step_value,
            started_step_index: issue.started_step_index.or(start_step_index),
            executed_step_count: issue.executed_step_count,
            total_step_count: issue.total_step_count,
            used_workflow_variables: issue.used_workflow_variables,
            warning_count: issue.warning_count,
            step_results: issue.step_results,
        }),
    }
}

#[tauri::command]
pub fn clear_recent_items(
    state: State<'_, StorageState>,
) -> Result<ClearRecentItemsResponse, String> {
    let cleared = state.clear_recent_items().map_err(to_error_message)?;
    Ok(ClearRecentItemsResponse { cleared })
}

#[tauri::command]
pub fn batch_edit_items(
    state: State<'_, StorageState>,
    payload: BatchEditItemsPayload,
) -> Result<ItemCollection, String> {
    let items = state.batch_edit_items(&payload).map_err(to_error_message)?;
    Ok(ItemCollection { items })
}

#[tauri::command]
pub fn set_default_workflow(
    state: State<'_, StorageState>,
    id: Option<String>,
) -> Result<UiSettings, String> {
    state
        .set_default_workflow(id.as_deref())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn export_items(
    state: State<'_, StorageState>,
    path: String,
    ids: Vec<String>,
) -> Result<ExportItemsResponse, String> {
    let exported_count = state
        .export_items(PathBuf::from(&path).as_path(), &ids)
        .map_err(to_error_message)?;
    Ok(ExportItemsResponse {
        path,
        exported_count,
    })
}

#[tauri::command]
pub fn import_items(
    state: State<'_, StorageState>,
    path: String,
) -> Result<ImportItemsResponse, String> {
    state
        .import_items(PathBuf::from(path).as_path())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn preview_import_items(
    state: State<'_, StorageState>,
    path: String,
) -> Result<ImportItemsPreviewResponse, String> {
    state
        .preview_import_items(PathBuf::from(path).as_path())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn backup_database(
    state: State<'_, StorageState>,
    path: String,
) -> Result<FileOperationResponse, String> {
    state
        .backup_database(PathBuf::from(path).as_path())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn restore_database(
    state: State<'_, StorageState>,
    path: String,
) -> Result<FileOperationResponse, String> {
    state
        .restore_database(PathBuf::from(path).as_path())
        .map_err(to_error_message)
}

#[tauri::command]
pub fn run_database_health_check(
    state: State<'_, StorageState>,
) -> Result<DatabaseHealthReport, String> {
    state.get_database_health_report().map_err(to_error_message)
}

#[tauri::command]
pub fn run_data_consistency_check(
    state: State<'_, StorageState>,
) -> Result<DatabaseConsistencyReport, String> {
    state.run_data_consistency_check().map_err(to_error_message)
}

#[tauri::command]
pub fn optimize_database(
    state: State<'_, StorageState>,
) -> Result<DatabaseMaintenanceResponse, String> {
    state.optimize_database().map_err(to_error_message)
}

#[tauri::command]
pub fn open_backups_directory(
    state: State<'_, StorageState>,
) -> Result<FileOperationResponse, String> {
    state.open_backups_directory().map_err(to_error_message)
}

#[tauri::command]
pub fn export_text_report(
    state: State<'_, StorageState>,
    path: String,
    title: String,
    lines: Vec<String>,
) -> Result<ExportTextReportResponse, String> {
    state
        .export_text_report(PathBuf::from(path).as_path(), &title, &lines)
        .map_err(to_error_message)
}

#[tauri::command]
pub fn export_structured_report(
    state: State<'_, StorageState>,
    path: String,
    title: String,
    payload: serde_json::Value,
) -> Result<FileOperationResponse, String> {
    state
        .export_structured_report(PathBuf::from(path).as_path(), &title, &payload)
        .map_err(to_error_message)
}
