use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};

use anyhow::{Context, Result, anyhow};
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension, Transaction, params};
use sha2::{Digest, Sha256};
use url::Url;
use uuid::Uuid;

use crate::bookmark_importer;
use crate::migrations::run_migrations;
use crate::models::{
    BatchEditItemsPayload, BatchTagMode, BrowserBookmarkImportEntry, BrowserBookmarkScanResponse,
    CommandExecutionMode, CommandHistoryCollection, CommandHistoryEntry, CommandHistoryKind,
    CommandHistoryPayload, ConsistencyIssueSeverity, DataToolAction, DataToolHistoryCollection,
    DataToolHistoryEntry, DataToolHistoryPayload, DataToolOperationStatus,
    DatabaseConsistencyIssue, DatabaseConsistencyReport, DatabaseHealthReport,
    DatabaseMaintenanceResponse, DeskItem, ExportTextReportResponse, FileOperationResponse,
    ImportBrowserBookmarksResponse, ImportItemsPreviewResponse, ImportItemsResponse,
    ImportPreviewItem, ImportProjectDirectoriesResponse, ItemBase, ItemCollection, ItemPayload,
    ItemsExportFile, OverviewLayoutPayload, OverviewLayoutTemplate, OverviewSectionId,
    OverviewWorkflowLinkMode, PayloadBase,
    ProjectDirectoryImportOptions, ProjectDirectoryScanOptions, ProjectDirectoryScanResponse,
    ProjectImportConflictStrategy, RestoreDiffSummary, UiSettings, UiSettingsPayload,
    WorkflowConditionFailAction, WorkflowConditionOperator, WorkflowFailureStrategy, WorkflowStep,
    WorkflowStepCondition, WorkflowVariable, default_overview_section_order,
};
use crate::project_inspector;

const DEFAULT_WORKFLOW_KEY: &str = "defaultWorkflowId";
const AUTO_BACKUP_ENABLED_KEY: &str = "autoBackupEnabled";
const AUTO_BACKUP_INTERVAL_HOURS_KEY: &str = "autoBackupIntervalHours";
const BACKUP_RETENTION_COUNT_KEY: &str = "backupRetentionCount";
const DIAGNOSTIC_MODE_KEY: &str = "diagnosticMode";
const LAST_AUTO_BACKUP_AT_KEY: &str = "lastAutoBackupAt";
const OVERVIEW_SECTION_ORDER_KEY: &str = "overviewSectionOrder";
const OVERVIEW_HIDDEN_SECTIONS_KEY: &str = "overviewHiddenSections";
const OVERVIEW_LAYOUT_TEMPLATES_KEY: &str = "overviewLayoutTemplates";
const OVERVIEW_WORKFLOW_LINK_MODE_KEY: &str = "overviewWorkflowLinkMode";
const DEFAULT_AUTO_BACKUP_ENABLED: bool = true;
const DEFAULT_AUTO_BACKUP_INTERVAL_HOURS: u32 = 24;
const DEFAULT_BACKUP_RETENTION_COUNT: u32 = 7;
const DEFAULT_DIAGNOSTIC_MODE: bool = false;
const COMMAND_HISTORY_LIMIT: i64 = 150;
const DATA_TOOL_HISTORY_LIMIT: i64 = 80;

pub struct StorageState {
    db_path: PathBuf,
    connection_lock: Mutex<()>,
}

#[derive(Debug)]
struct DbItemRecord {
    id: String,
    item_type: String,
    name: String,
    description: String,
    icon: String,
    favorite: bool,
    created_at: String,
    updated_at: String,
    last_launched_at: Option<String>,
    launch_target: Option<String>,
    project_path: Option<String>,
    dev_command: Option<String>,
    path: Option<String>,
    url: Option<String>,
    command: Option<String>,
    execution_mode: Option<String>,
}

struct OptionalColumns<'a> {
    launch_target: Option<&'a str>,
    project_path: Option<&'a str>,
    dev_command: Option<&'a str>,
    path: Option<&'a str>,
    url: Option<&'a str>,
    command: Option<&'a str>,
    execution_mode: Option<&'a str>,
}

struct ImportPreparation {
    version: u32,
    preview_items: Vec<ImportPreviewItem>,
    valid_payloads: Vec<ItemPayload>,
    errors: Vec<String>,
}

impl StorageState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        let db_path = app_data_dir.join("data").join("deskhub.db");
        ensure_parent_dir(&db_path)?;

        if let Err(error) = initialize_database(&db_path) {
            let recovery_path = create_recovery_copy(&db_path).ok();
            let recovery_note = recovery_path
                .as_ref()
                .map(|path| format!(" A recovery copy was saved to {}.", path.display()))
                .unwrap_or_default();
            return Err(anyhow!(
                "DeskHub could not start because the local database failed its health check.{} {}",
                recovery_note,
                error
            ));
        }

        if let Err(error) = maybe_run_automatic_backup(&db_path) {
            eprintln!("DeskHub automatic backup skipped: {error}");
        }

        Ok(Self {
            db_path,
            connection_lock: Mutex::new(()),
        })
    }

    pub fn get_items(&self) -> Result<ItemCollection> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        load_collection(&connection)
    }

    pub fn get_command_history(&self) -> Result<CommandHistoryCollection> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        load_command_history(&connection)
    }

    pub fn get_data_tool_history(&self) -> Result<DataToolHistoryCollection> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        load_data_tool_history(&connection)
    }

    pub fn record_command_history(
        &self,
        payload: &CommandHistoryPayload,
    ) -> Result<CommandHistoryEntry> {
        payload.validate().map_err(|message| anyhow!(message))?;
        let payload = payload.normalized();

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;
        upsert_command_history(&transaction, &payload)?;
        transaction.commit()?;
        load_command_history_entry(&connection, payload.kind, &payload.target)
    }

    pub fn record_data_tool_history(
        &self,
        payload: &DataToolHistoryPayload,
    ) -> Result<DataToolHistoryEntry> {
        payload.validate().map_err(|message| anyhow!(message))?;
        let payload = payload.normalized();

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;
        let entry = insert_data_tool_history_entry(&transaction, &payload)?;
        transaction.commit()?;
        Ok(entry)
    }

    pub fn clear_data_tool_history(&self) -> Result<usize> {
        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        ensure_data_tool_write_allowed(&connection)?;
        let transaction = connection.transaction()?;
        let cleared = transaction.execute("DELETE FROM data_tool_history", [])?;
        transaction.commit()?;
        Ok(cleared)
    }

    pub fn clear_command_history(&self) -> Result<usize> {
        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        ensure_data_tool_write_allowed(&connection)?;
        let transaction = connection.transaction()?;
        let cleared = transaction.execute("DELETE FROM command_history", [])?;
        transaction.commit()?;
        Ok(cleared)
    }

    pub fn get_ui_settings(&self) -> Result<UiSettings> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        load_ui_settings(&connection)
    }

    pub fn update_ui_settings(&self, payload: &UiSettingsPayload) -> Result<UiSettings> {
        payload.validate().map_err(|message| anyhow!(message))?;

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;

        upsert_setting(
            &transaction,
            AUTO_BACKUP_ENABLED_KEY,
            if payload.auto_backup_enabled {
                "true"
            } else {
                "false"
            },
        )?;
        upsert_setting(
            &transaction,
            AUTO_BACKUP_INTERVAL_HOURS_KEY,
            &payload.auto_backup_interval_hours.to_string(),
        )?;
        upsert_setting(
            &transaction,
            BACKUP_RETENTION_COUNT_KEY,
            &payload.backup_retention_count.to_string(),
        )?;
        upsert_setting(
            &transaction,
            DIAGNOSTIC_MODE_KEY,
            if payload.diagnostic_mode {
                "true"
            } else {
                "false"
            },
        )?;

        transaction.commit()?;
        load_ui_settings(&connection)
    }

    pub fn update_overview_layout(&self, payload: &OverviewLayoutPayload) -> Result<UiSettings> {
        payload.validate().map_err(|message| anyhow!(message))?;
        let payload = payload.normalized();

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;

        upsert_setting(
            &transaction,
            OVERVIEW_SECTION_ORDER_KEY,
            &serde_json::to_string(&payload.section_order)?,
        )?;
        upsert_setting(
            &transaction,
            OVERVIEW_HIDDEN_SECTIONS_KEY,
            &serde_json::to_string(&payload.hidden_sections)?,
        )?;
        if let Some(layout_templates) = &payload.layout_templates {
            upsert_setting(
                &transaction,
                OVERVIEW_LAYOUT_TEMPLATES_KEY,
                &serde_json::to_string(layout_templates)?,
            )?;
        }
        if let Some(workflow_link_mode) = payload.workflow_link_mode {
            upsert_setting(
                &transaction,
                OVERVIEW_WORKFLOW_LINK_MODE_KEY,
                workflow_link_mode.as_str(),
            )?;
        }

        transaction.commit()?;
        load_ui_settings(&connection)
    }

    pub fn scan_browser_bookmarks(&self) -> Result<BrowserBookmarkScanResponse> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        let scan = bookmark_importer::scan_browser_bookmarks()?;
        annotate_browser_bookmark_scan(&connection, scan)
    }

    pub fn import_browser_bookmarks(
        &self,
        entries: &[BrowserBookmarkImportEntry],
    ) -> Result<ImportBrowserBookmarksResponse> {
        let entries = sanitize_browser_bookmark_entries(entries);
        if entries.is_empty() {
            return Err(anyhow!("Choose at least one bookmark to import."));
        }

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let existing_urls = load_existing_url_map(&connection)?;
        let transaction = connection.transaction()?;
        let now = current_timestamp();
        let mut known_urls = existing_urls.keys().cloned().collect::<HashSet<_>>();
        let mut items = Vec::new();
        let mut skipped_urls = Vec::new();
        let mut errors = Vec::new();

        for entry in &entries {
            let normalized_url = normalize_url_for_matching(entry.url.as_str());
            if known_urls.contains(&normalized_url) {
                skipped_urls.push(entry.url.clone());
                continue;
            }

            match build_browser_bookmark_item(entry, &now) {
                Ok(item) => {
                    insert_item(&transaction, &item)?;
                    known_urls.insert(normalized_url);
                    items.push(item);
                }
                Err(error) => errors.push(error.to_string()),
            }
        }

        transaction.commit()?;
        Ok(ImportBrowserBookmarksResponse {
            items,
            skipped_urls,
            errors,
        })
    }

    pub fn scan_project_directories(
        &self,
        path: &Path,
        options: Option<&ProjectDirectoryScanOptions>,
    ) -> Result<ProjectDirectoryScanResponse> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        let mut scan = project_inspector::scan_project_directories(path, options)?;
        let existing_projects = load_existing_project_path_map(&connection)?;

        let mut importable_count = 0usize;
        let mut existing_count = 0usize;

        for candidate in &mut scan.candidates {
            let normalized_path = normalize_project_path_for_matching(candidate.path.as_str());
            if let Some((existing_item_id, existing_item_name)) =
                existing_projects.get(&normalized_path)
            {
                candidate.existing_item_id = Some(existing_item_id.clone());
                candidate.existing_item_name = Some(existing_item_name.clone());
                existing_count += 1;
            } else {
                importable_count += 1;
            }
        }

        scan.importable_count = importable_count;
        scan.existing_count = existing_count;
        Ok(scan)
    }

    pub fn import_project_directories(
        &self,
        paths: &[String],
        options: Option<&ProjectDirectoryImportOptions>,
    ) -> Result<ImportProjectDirectoriesResponse> {
        let paths = sanitize_paths(paths);
        if paths.is_empty() {
            return Err(anyhow!("Choose at least one project directory."));
        }
        let options = normalize_project_directory_import_options(options);

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let existing_projects = load_existing_project_path_map(&connection)?;
        let existing_items_by_id = if matches!(
            options.conflict_strategy,
            ProjectImportConflictStrategy::RefreshExisting
        ) {
            let ids = existing_projects
                .values()
                .map(|(item_id, _)| item_id.clone())
                .collect::<Vec<_>>();
            load_items_by_ids(&connection, &ids)?
                .into_iter()
                .map(|item| (item.id().to_string(), item))
                .collect::<HashMap<_, _>>()
        } else {
            HashMap::new()
        };
        let transaction = connection.transaction()?;
        let mut known_paths = existing_projects.keys().cloned().collect::<HashSet<_>>();
        let now = current_timestamp();
        let mut items = Vec::new();
        let mut updated_paths = Vec::new();
        let mut skipped_paths = Vec::new();
        let mut errors = Vec::new();

        for path in &paths {
            let normalized_path = normalize_project_path_for_matching(path);
            if let Some((existing_item_id, _)) = existing_projects.get(&normalized_path) {
                match options.conflict_strategy {
                    ProjectImportConflictStrategy::SkipExisting => {
                        skipped_paths.push(path.clone());
                        continue;
                    }
                    ProjectImportConflictStrategy::RefreshExisting => {
                        let Some(existing_item) = existing_items_by_id.get(existing_item_id) else {
                            errors.push(format!(
                                "Failed to refresh existing project at {} because the current DeskHub item could not be loaded.",
                                path
                            ));
                            continue;
                        };

                        match build_refreshed_project_import_item(existing_item, path, &now) {
                            Ok(item) => {
                                update_item_row(&transaction, &item)?;
                                replace_item_tags(&transaction, item.id(), &item.base().tags)?;
                                updated_paths.push(path.clone());
                                items.push(item);
                            }
                            Err(error) => errors.push(error.to_string()),
                        }
                        continue;
                    }
                }
            }

            match build_project_import_item(path, &now) {
                Ok(item) => {
                    insert_item(&transaction, &item)?;
                    known_paths.insert(normalized_path);
                    items.push(item);
                }
                Err(error) => errors.push(error.to_string()),
            }
        }

        transaction.commit()?;
        Ok(ImportProjectDirectoriesResponse {
            items,
            updated_paths,
            skipped_paths,
            errors,
        })
    }

    pub fn create_item(&self, payload: &ItemPayload) -> Result<DeskItem> {
        payload.validate().map_err(|message| anyhow!(message))?;

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let created_at = current_timestamp();
        let item = payload.into_item(
            Uuid::new_v4().to_string(),
            created_at.clone(),
            created_at,
            None,
        );

        let transaction = connection.transaction()?;
        insert_item(&transaction, &item)?;
        transaction.commit()?;
        Ok(item)
    }

    pub fn update_item(&self, id: &str, payload: &ItemPayload) -> Result<DeskItem> {
        payload.validate().map_err(|message| anyhow!(message))?;

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let existing = load_item_by_id(&connection, id)?;
        let item = payload.into_item(
            existing.base().id.clone(),
            existing.base().created_at.clone(),
            current_timestamp(),
            existing.base().last_launched_at.clone(),
        );

        let transaction = connection.transaction()?;
        update_item_row(&transaction, &item)?;
        replace_item_tags(&transaction, item.id(), &item.base().tags)?;
        replace_workflow_variables(&transaction, &item)?;
        replace_workflow_steps(&transaction, &item)?;
        if item.item_type() != "workflow" {
            clear_default_workflow_if_matches(&transaction, item.id())?;
        }
        transaction.commit()?;
        Ok(item)
    }

    pub fn delete_item(&self, id: &str) -> Result<()> {
        self.delete_items(&[id.to_string()]).map(|_| ())
    }

    pub fn delete_items(&self, ids: &[String]) -> Result<Vec<String>> {
        let ids = sanitize_ids(ids);
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;
        let mut deleted_ids = Vec::new();

        for id in &ids {
            let item_type = transaction
                .query_row("SELECT type FROM items WHERE id = ?1", [id], |row| {
                    row.get::<_, String>(0)
                })
                .optional()?
                .with_context(|| format!("Item {id} was not found."))?;

            transaction.execute("DELETE FROM items WHERE id = ?1", [id])?;
            if item_type == "workflow" {
                clear_default_workflow_if_matches(&transaction, id)?;
            }
            deleted_ids.push(id.clone());
        }

        transaction.commit()?;
        Ok(deleted_ids)
    }

    pub fn toggle_favorite(&self, id: &str, favorite: bool) -> Result<DeskItem> {
        let updated = self.set_items_favorite(&[id.to_string()], favorite)?;
        updated
            .into_iter()
            .next()
            .with_context(|| format!("Item {id} was not found."))
    }

    pub fn set_items_favorite(&self, ids: &[String], favorite: bool) -> Result<Vec<DeskItem>> {
        let ids = sanitize_ids(ids);
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;
        let updated_at = current_timestamp();

        for id in &ids {
            let affected = transaction.execute(
                "UPDATE items SET favorite = ?2, updated_at = ?3 WHERE id = ?1",
                params![id, favorite, updated_at],
            )?;

            if affected == 0 {
                return Err(anyhow!("Item {id} was not found."));
            }
        }

        transaction.commit()?;
        load_items_by_ids(&connection, &ids)
    }

    pub fn batch_edit_items(&self, payload: &BatchEditItemsPayload) -> Result<Vec<DeskItem>> {
        payload.validate().map_err(|message| anyhow!(message))?;
        let payload = payload.normalized();
        let ids = sanitize_ids(&payload.ids);
        if ids.is_empty() {
            return Err(anyhow!("Choose at least one item."));
        }

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let current_items = load_items_by_ids(&connection, &ids)?;
        let transaction = connection.transaction()?;

        for item in &current_items {
            let updated_item = apply_batch_edit_to_item(item, &payload);
            update_item_row(&transaction, &updated_item)?;
            replace_item_tags(&transaction, updated_item.id(), &updated_item.base().tags)?;
        }

        transaction.commit()?;
        load_items_by_ids(&connection, &ids)
    }

    pub fn find_item(&self, id: &str) -> Result<DeskItem> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        load_item_by_id(&connection, id)
    }

    pub fn mark_item_launched(&self, id: &str) -> Result<DeskItem> {
        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;
        let affected = transaction.execute(
            "UPDATE items SET last_launched_at = ?2 WHERE id = ?1",
            params![id, current_timestamp()],
        )?;

        if affected == 0 {
            return Err(anyhow!("Item {id} was not found."));
        }

        transaction.commit()?;
        load_item_by_id(&connection, id)
    }

    pub fn clear_recent_items(&self) -> Result<usize> {
        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;
        let cleared = transaction.execute(
            "UPDATE items SET last_launched_at = NULL WHERE last_launched_at IS NOT NULL",
            [],
        )?;
        transaction.commit()?;
        Ok(cleared)
    }

    pub fn set_default_workflow(&self, id: Option<&str>) -> Result<UiSettings> {
        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        let transaction = connection.transaction()?;

        match id {
            Some(workflow_id) => {
                ensure_workflow_exists(&transaction, workflow_id)?;
                upsert_setting(&transaction, DEFAULT_WORKFLOW_KEY, workflow_id)?;
            }
            None => delete_setting(&transaction, DEFAULT_WORKFLOW_KEY)?,
        }

        transaction.commit()?;
        load_ui_settings(&connection)
    }

    pub fn export_items(&self, path: &Path, ids: &[String]) -> Result<usize> {
        let ids = sanitize_ids(ids);
        if ids.is_empty() {
            return Err(anyhow!("Choose at least one item to export."));
        }

        ensure_parent_dir(path)?;
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        let items = load_items_by_ids(&connection, &ids)?;
        let export_file = ItemsExportFile {
            version: 1,
            exported_at: current_timestamp(),
            items: items.clone(),
        };
        let json = serde_json::to_string_pretty(&export_file)?;
        fs::write(path, json).with_context(|| format!("Failed to write {}.", path.display()))?;
        Ok(items.len())
    }

    pub fn import_items(&self, path: &Path) -> Result<ImportItemsResponse> {
        let preparation = prepare_import_items(path)?;

        if preparation.valid_payloads.is_empty() {
            return Ok(ImportItemsResponse {
                items: Vec::new(),
                errors: preparation.errors,
            });
        }

        let _guard = self.lock()?;
        let mut connection = self.open_connection()?;
        ensure_data_tool_write_allowed(&connection)?;
        let transaction = connection.transaction()?;
        let mut imported_items = Vec::new();
        let imported_at = current_timestamp();

        for payload in preparation.valid_payloads {
            let item = payload.into_item(
                Uuid::new_v4().to_string(),
                imported_at.clone(),
                imported_at.clone(),
                None,
            );
            insert_item(&transaction, &item)?;
            imported_items.push(item);
        }

        transaction.commit()?;

        Ok(ImportItemsResponse {
            items: imported_items,
            errors: preparation.errors,
        })
    }

    pub fn preview_import_items(&self, path: &Path) -> Result<ImportItemsPreviewResponse> {
        let preparation = prepare_import_items(path)?;
        Ok(ImportItemsPreviewResponse {
            path: path.display().to_string(),
            version: preparation.version,
            valid_count: preparation.valid_payloads.len(),
            invalid_count: preparation.errors.len(),
            items: preparation.preview_items,
            errors: preparation.errors,
        })
    }

    pub fn backup_database(&self, path: &Path) -> Result<FileOperationResponse> {
        ensure_parent_dir(path)?;
        if path == self.db_path {
            return Err(anyhow!(
                "The backup path must be different from the active database path."
            ));
        }

        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        let health_report = build_database_health_report(&connection, &self.db_path)?;
        let workflow_count = count_workflow_items(&connection)?;
        fs::copy(&self.db_path, path).with_context(|| {
            format!(
                "Failed to back up {} to {}.",
                self.db_path.display(),
                path.display()
            )
        })?;
        let sha256 = compute_file_sha256(path)?;

        Ok(FileOperationResponse {
            path: path.display().to_string(),
            backup_path: None,
            sha256: Some(sha256),
            source_sha256: None,
            schema_version: Some(health_report.schema_version),
            item_count: health_report
                .table_counts
                .get("items")
                .copied()
                .map(|count| count as usize),
            workflow_count: Some(workflow_count),
            backups_directory: Some(health_report.backups_directory),
            restore_diff: None,
        })
    }

    pub fn restore_database(&self, path: &Path) -> Result<FileOperationResponse> {
        if path == self.db_path {
            return Err(anyhow!(
                "Choose a backup file outside the active DeskHub database path."
            ));
        }

        if !path.exists() {
            return Err(anyhow!("Restore source does not exist: {}", path.display()));
        }

        let _guard = self.lock()?;
        {
            let diagnostic_connection = self.open_connection()?;
            ensure_data_tool_write_allowed(&diagnostic_connection)?;
        }
        let before_collection = {
            let current_connection = self.open_connection()?;
            load_collection(&current_connection)?
        };
        validate_restore_source(path, &self.db_path)?;
        let source_sha256 = compute_file_sha256(path)?;

        let backups_dir = database_support_dir(&self.db_path).join("backups");
        fs::create_dir_all(&backups_dir)
            .with_context(|| format!("Failed to create {}.", backups_dir.display()))?;

        let backup_path = backups_dir.join(format!(
            "deskhub-pre-restore-{}.db",
            timestamp_for_filename()
        ));
        fs::copy(&self.db_path, &backup_path).with_context(|| {
            format!(
                "Failed to create a safety backup at {} before restore.",
                backup_path.display()
            )
        })?;

        let replacement_path = temporary_database_copy_path(&self.db_path, "restore")?;
        fs::copy(path, &replacement_path).with_context(|| {
            format!(
                "Failed to copy {} into DeskHub's restore workspace.",
                path.display()
            )
        })?;

        if self.db_path.exists() {
            fs::remove_file(&self.db_path).with_context(|| {
                format!(
                    "Failed to remove {} before restore.",
                    self.db_path.display()
                )
            })?;
        }

        fs::rename(&replacement_path, &self.db_path).with_context(|| {
            format!(
                "Failed to replace the active database with {}.",
                path.display()
            )
        })?;

        initialize_database(&self.db_path)?;
        let connection = self.open_connection()?;
        let health_report = build_database_health_report(&connection, &self.db_path)?;
        let workflow_count = count_workflow_items(&connection)?;
        let restored_sha256 = compute_file_sha256(&self.db_path)?;
        let after_collection = load_collection(&connection)?;
        let restore_diff = compute_restore_diff(&before_collection.items, &after_collection.items)?;

        Ok(FileOperationResponse {
            path: path.display().to_string(),
            backup_path: Some(backup_path.display().to_string()),
            sha256: Some(restored_sha256),
            source_sha256: Some(source_sha256),
            schema_version: Some(health_report.schema_version),
            item_count: health_report
                .table_counts
                .get("items")
                .copied()
                .map(|count| count as usize),
            workflow_count: Some(workflow_count),
            backups_directory: Some(health_report.backups_directory),
            restore_diff: Some(restore_diff),
        })
    }

    pub fn get_database_health_report(&self) -> Result<DatabaseHealthReport> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        build_database_health_report(&connection, &self.db_path)
    }

    pub fn run_data_consistency_check(&self) -> Result<DatabaseConsistencyReport> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        build_database_consistency_report(&connection, &self.db_path)
    }

    pub fn optimize_database(&self) -> Result<DatabaseMaintenanceResponse> {
        let _guard = self.lock()?;
        let connection = self.open_connection()?;
        ensure_data_tool_write_allowed(&connection)?;
        let size_before_bytes = fs::metadata(&self.db_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        let page_count_before: i64 =
            connection.query_row("PRAGMA page_count", [], |row| row.get(0))?;
        let freelist_count_before: i64 =
            connection.query_row("PRAGMA freelist_count", [], |row| row.get(0))?;

        connection.execute_batch("PRAGMA optimize; VACUUM;")?;

        let quick_check: String =
            connection.query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;
        let page_count_after: i64 =
            connection.query_row("PRAGMA page_count", [], |row| row.get(0))?;
        let freelist_count_after: i64 =
            connection.query_row("PRAGMA freelist_count", [], |row| row.get(0))?;
        let size_after_bytes = fs::metadata(&self.db_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);

        Ok(DatabaseMaintenanceResponse {
            path: self.db_path.display().to_string(),
            quick_check,
            page_count_before,
            page_count_after,
            freelist_count_before,
            freelist_count_after,
            size_before_bytes,
            size_after_bytes,
        })
    }

    pub fn export_text_report(
        &self,
        path: &Path,
        title: &str,
        lines: &[String],
    ) -> Result<ExportTextReportResponse> {
        ensure_parent_dir(path)?;
        let normalized_title = title.trim();
        if normalized_title.is_empty() {
            return Err(anyhow!("Report title is required."));
        }

        let normalized_lines: Vec<String> = lines
            .iter()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect();

        if normalized_lines.is_empty() {
            return Err(anyhow!("There are no lines to export."));
        }

        let report = std::iter::once(normalized_title.to_string())
            .chain(std::iter::once(format!(
                "导出时间：{}",
                current_timestamp()
            )))
            .chain(std::iter::once(String::new()))
            .chain(
                normalized_lines
                    .iter()
                    .enumerate()
                    .map(|(index, line)| format!("{}. {}", index + 1, line)),
            )
            .collect::<Vec<_>>()
            .join("\r\n");

        fs::write(path, report).with_context(|| format!("Failed to write {}.", path.display()))?;

        Ok(ExportTextReportResponse {
            path: path.display().to_string(),
            line_count: normalized_lines.len(),
        })
    }

    pub fn export_structured_report(
        &self,
        path: &Path,
        title: &str,
        payload: &serde_json::Value,
    ) -> Result<FileOperationResponse> {
        ensure_parent_dir(path)?;
        let normalized_title = title.trim();
        if normalized_title.is_empty() {
            return Err(anyhow!("Report title is required."));
        }

        let report = serde_json::json!({
            "version": 1,
            "title": normalized_title,
            "exportedAt": current_timestamp(),
            "payload": payload,
        });

        fs::write(path, serde_json::to_string_pretty(&report)?)
            .with_context(|| format!("Failed to write {}.", path.display()))?;

        Ok(FileOperationResponse {
            path: path.display().to_string(),
            backup_path: None,
            sha256: None,
            source_sha256: None,
            schema_version: None,
            item_count: None,
            workflow_count: None,
            backups_directory: None,
            restore_diff: None,
        })
    }

    pub fn open_backups_directory(&self) -> Result<FileOperationResponse> {
        let backups_dir = database_support_dir(&self.db_path).join("backups");
        fs::create_dir_all(&backups_dir)
            .with_context(|| format!("Failed to create {}.", backups_dir.display()))?;
        crate::launcher::open_existing_path(backups_dir.to_string_lossy().as_ref())?;

        Ok(FileOperationResponse {
            path: backups_dir.display().to_string(),
            backup_path: None,
            sha256: None,
            source_sha256: None,
            schema_version: None,
            item_count: None,
            workflow_count: None,
            backups_directory: Some(backups_dir.display().to_string()),
            restore_diff: None,
        })
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, ()>> {
        self.connection_lock
            .lock()
            .map_err(|_| anyhow!("The local database is temporarily unavailable."))
    }

    fn open_connection(&self) -> Result<Connection> {
        let mut connection = Connection::open(&self.db_path)
            .with_context(|| format!("Failed to open {}.", self.db_path.display()))?;
        configure_connection(&connection)?;
        run_migrations(&mut connection)?;
        Ok(connection)
    }
}

fn current_timestamp() -> String {
    Utc::now().to_rfc3339()
}

fn timestamp_for_filename() -> String {
    Utc::now().format("%Y%m%d-%H%M%S").to_string()
}

fn ensure_parent_dir(path: &Path) -> Result<()> {
    let parent = path.parent().with_context(|| {
        format!(
            "Could not resolve the parent directory for {}.",
            path.display()
        )
    })?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Failed to create {}.", parent.display()))?;
    Ok(())
}

fn database_support_dir(db_path: &Path) -> PathBuf {
    db_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

fn temporary_database_copy_path(db_path: &Path, prefix: &str) -> Result<PathBuf> {
    let parent = db_path.parent().with_context(|| {
        format!(
            "Could not resolve the parent directory for {}.",
            db_path.display()
        )
    })?;
    Ok(parent.join(format!(
        "{}-{}-{}.db",
        db_path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("deskhub"),
        prefix,
        timestamp_for_filename()
    )))
}

fn create_recovery_copy(db_path: &Path) -> Result<PathBuf> {
    if !db_path.exists() {
        return Err(anyhow!("The database file does not exist."));
    }

    let recovery_dir = database_support_dir(db_path).join("recovery");
    fs::create_dir_all(&recovery_dir)
        .with_context(|| format!("Failed to create {}.", recovery_dir.display()))?;

    let recovery_path =
        recovery_dir.join(format!("deskhub-corrupt-{}.db", timestamp_for_filename()));
    fs::copy(db_path, &recovery_path).with_context(|| {
        format!(
            "Failed to copy the current database into {}.",
            recovery_path.display()
        )
    })?;

    Ok(recovery_path)
}

fn maybe_run_automatic_backup(db_path: &Path) -> Result<()> {
    if !db_path.exists() {
        return Ok(());
    }

    let mut connection = Connection::open(db_path)
        .with_context(|| format!("Failed to open {}.", db_path.display()))?;
    configure_connection(&connection)?;
    run_migrations(&mut connection)?;

    let settings = load_ui_settings(&connection)?;
    if !settings.auto_backup_enabled {
        return Ok(());
    }

    let now = Utc::now();
    let should_backup = settings
        .last_auto_backup_at
        .as_deref()
        .and_then(parse_rfc3339_utc)
        .map(|last_backup_at| {
            now.signed_duration_since(last_backup_at).num_hours()
                >= i64::from(settings.auto_backup_interval_hours)
        })
        .unwrap_or(true);

    if !should_backup {
        return Ok(());
    }

    let backups_dir = database_support_dir(db_path).join("backups");
    fs::create_dir_all(&backups_dir)
        .with_context(|| format!("Failed to create {}.", backups_dir.display()))?;

    let backup_path = backups_dir.join(format!("deskhub-auto-{}.db", timestamp_for_filename()));
    fs::copy(db_path, &backup_path).with_context(|| {
        format!(
            "Failed to create an automatic backup at {}.",
            backup_path.display()
        )
    })?;

    let transaction = connection.transaction()?;
    upsert_setting(&transaction, LAST_AUTO_BACKUP_AT_KEY, &current_timestamp())?;
    transaction.commit()?;

    prune_automatic_backups(&backups_dir, settings.backup_retention_count)?;
    Ok(())
}

fn prune_automatic_backups(backups_dir: &Path, retention_count: u32) -> Result<()> {
    let mut backups = fs::read_dir(backups_dir)
        .with_context(|| format!("Failed to read {}.", backups_dir.display()))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|name| name.starts_with("deskhub-auto-") && name.ends_with(".db"))
        })
        .collect::<Vec<_>>();

    backups.sort_by(|left, right| right.file_name().cmp(&left.file_name()));

    for stale_backup in backups.into_iter().skip(retention_count as usize) {
        let _ = fs::remove_file(stale_backup);
    }

    Ok(())
}

fn parse_rfc3339_utc(value: &str) -> Option<chrono::DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|value| value.with_timezone(&Utc))
}

fn initialize_database(path: &Path) -> Result<()> {
    let mut connection =
        Connection::open(path).with_context(|| format!("Failed to create {}.", path.display()))?;
    configure_connection(&connection)?;
    run_migrations(&mut connection)?;
    health_check_database(&connection, path)
}

fn configure_connection(connection: &Connection) -> Result<()> {
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

fn health_check_database(connection: &Connection, db_path: &Path) -> Result<()> {
    let _ = build_database_health_report(connection, db_path)?;
    Ok(())
}

fn build_database_health_report(
    connection: &Connection,
    db_path: &Path,
) -> Result<DatabaseHealthReport> {
    let foreign_keys: i64 =
        connection.pragma_query_value(None, "foreign_keys", |row| row.get(0))?;
    if foreign_keys != 1 {
        return Err(anyhow!("SQLite foreign keys are not enabled."));
    }

    let quick_check: String =
        connection.query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;
    if quick_check.trim().to_lowercase() != "ok" {
        return Err(anyhow!("SQLite quick_check failed: {quick_check}"));
    }

    for table in [
        "items",
        "item_tags",
        "workflow_steps",
        "workflow_variables",
        "app_settings",
        "command_history",
        "data_tool_history",
    ] {
        if !table_exists(connection, table)? {
            return Err(anyhow!("The required table {table} is missing."));
        }
    }

    for (table, columns) in [
        (
            "items",
            &[
                "id",
                "name",
                "type",
                "description",
                "icon",
                "favorite",
                "created_at",
                "updated_at",
                "last_launched_at",
                "launch_target",
                "project_path",
                "dev_command",
                "path",
                "url",
                "command",
                "execution_mode",
            ][..],
        ),
        ("item_tags", &["item_id", "tag"][..]),
        (
            "workflow_steps",
            &[
                "id",
                "workflow_id",
                "position",
                "type",
                "path",
                "url",
                "command",
                "execution_mode",
                "failure_strategy",
                "retry_count",
                "retry_delay_ms",
                "condition_variable_key",
                "condition_operator",
                "condition_value",
                "condition_on_false",
                "condition_jump_to_step_id",
                "note",
                "delay_ms",
            ][..],
        ),
        (
            "workflow_variables",
            &[
                "id",
                "workflow_id",
                "position",
                "key",
                "label",
                "default_value",
                "required",
            ][..],
        ),
        ("app_settings", &["key", "value"][..]),
        (
            "command_history",
            &["kind", "target", "title", "last_used_at", "use_count"][..],
        ),
        (
            "data_tool_history",
            &[
                "id",
                "action",
                "status",
                "title",
                "summary",
                "occurred_at",
                "source_path",
                "output_path",
                "backup_path",
                "item_names_json",
                "errors_json",
                "extra_json",
            ][..],
        ),
    ] {
        for column in columns {
            if !column_exists(connection, table, column)? {
                return Err(anyhow!("The column {table}.{column} is missing."));
            }
        }
    }

    let schema_version: i64 =
        connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let table_counts = collect_table_counts(connection)?;

    Ok(DatabaseHealthReport {
        checked_at: current_timestamp(),
        path: db_path.display().to_string(),
        backups_directory: database_support_dir(db_path)
            .join("backups")
            .display()
            .to_string(),
        schema_version,
        quick_check,
        foreign_keys_enabled: foreign_keys == 1,
        table_counts,
    })
}

fn build_database_consistency_report(
    connection: &Connection,
    db_path: &Path,
) -> Result<DatabaseConsistencyReport> {
    let _ = build_database_health_report(connection, db_path)?;
    let mut issues = Vec::new();

    let mut orphan_tag_rows = connection.prepare(
        "
        SELECT item_id
        FROM item_tags
        WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = item_tags.item_id)
        ORDER BY item_id ASC
        ",
    )?;
    let orphan_tag_ids = orphan_tag_rows.query_map([], |row| row.get::<_, String>(0))?;
    for item_id in orphan_tag_ids {
        let item_id = item_id?;
        issues.push(DatabaseConsistencyIssue {
            severity: ConsistencyIssueSeverity::Error,
            code: "orphan_item_tag".into(),
            message: format!("item_tags 中存在无主标签，item_id = {}。", item_id),
            item_id: Some(item_id),
            step_id: None,
        });
    }

    let mut orphan_step_statement = connection.prepare(
        "
        SELECT id, workflow_id
        FROM workflow_steps
        WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = workflow_steps.workflow_id)
        ORDER BY workflow_id ASC, position ASC
        ",
    )?;
    let orphan_steps = orphan_step_statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in orphan_steps {
        let (step_id, workflow_id) = row?;
        issues.push(DatabaseConsistencyIssue {
            severity: ConsistencyIssueSeverity::Error,
            code: "orphan_workflow_step".into(),
            message: format!(
                "workflow_steps 中存在无主步骤，workflow_id = {}，step_id = {}。",
                workflow_id, step_id
            ),
            item_id: Some(workflow_id),
            step_id: Some(step_id),
        });
    }

    let mut empty_workflow_statement = connection.prepare(
        "
        SELECT items.id, items.name
        FROM items
        LEFT JOIN workflow_steps ON workflow_steps.workflow_id = items.id
        WHERE items.type = 'workflow'
        GROUP BY items.id, items.name
        HAVING COUNT(workflow_steps.id) = 0
        ORDER BY items.name COLLATE NOCASE ASC
        ",
    )?;
    let empty_workflows = empty_workflow_statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in empty_workflows {
        let (item_id, name) = row?;
        issues.push(DatabaseConsistencyIssue {
            severity: ConsistencyIssueSeverity::Error,
            code: "workflow_without_steps".into(),
            message: format!("工作流 {name} 没有任何步骤。"),
            item_id: Some(item_id),
            step_id: None,
        });
    }

    let mut invalid_items_statement = connection.prepare(
        "
        SELECT id, type, name, launch_target, project_path, path, url, command
        FROM items
        ORDER BY name COLLATE NOCASE ASC
        ",
    )?;
    let invalid_items = invalid_items_statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
        ))
    })?;

    for row in invalid_items {
        let (item_id, item_type, name, launch_target, project_path, path, url, command) = row?;
        match item_type.as_str() {
            "app" if launch_target.unwrap_or_default().trim().is_empty() => {
                issues.push(DatabaseConsistencyIssue {
                    severity: ConsistencyIssueSeverity::Error,
                    code: "app_missing_launch_target".into(),
                    message: format!("应用 {name} 缺少 launchTarget。"),
                    item_id: Some(item_id),
                    step_id: None,
                });
            }
            "project" if project_path.unwrap_or_default().trim().is_empty() => {
                issues.push(DatabaseConsistencyIssue {
                    severity: ConsistencyIssueSeverity::Error,
                    code: "project_missing_path".into(),
                    message: format!("项目 {name} 缺少 projectPath。"),
                    item_id: Some(item_id),
                    step_id: None,
                });
            }
            "folder" if path.unwrap_or_default().trim().is_empty() => {
                issues.push(DatabaseConsistencyIssue {
                    severity: ConsistencyIssueSeverity::Error,
                    code: "folder_missing_path".into(),
                    message: format!("文件夹 {name} 缺少 path。"),
                    item_id: Some(item_id),
                    step_id: None,
                });
            }
            "url" => {
                let url_value = url.unwrap_or_default();
                if url_value.trim().is_empty() {
                    issues.push(DatabaseConsistencyIssue {
                        severity: ConsistencyIssueSeverity::Error,
                        code: "url_missing_value".into(),
                        message: format!("网站 {name} 缺少 url。"),
                        item_id: Some(item_id),
                        step_id: None,
                    });
                } else if Url::parse(url_value.trim()).is_err() {
                    issues.push(DatabaseConsistencyIssue {
                        severity: ConsistencyIssueSeverity::Warning,
                        code: "url_invalid_value".into(),
                        message: format!(
                            "网站 {name} 的 url 看起来不是合法地址：{}。",
                            url_value.trim()
                        ),
                        item_id: Some(item_id),
                        step_id: None,
                    });
                }
            }
            "script" if command.unwrap_or_default().trim().is_empty() => {
                issues.push(DatabaseConsistencyIssue {
                    severity: ConsistencyIssueSeverity::Error,
                    code: "script_missing_command".into(),
                    message: format!("脚本 {name} 缺少 command。"),
                    item_id: Some(item_id),
                    step_id: None,
                });
            }
            _ => {}
        }
    }

    let default_workflow_row = connection
        .query_row(
            "
            SELECT app_settings.value, items.type
            FROM app_settings
            LEFT JOIN items ON items.id = app_settings.value
            WHERE app_settings.key = ?1
            ",
            [DEFAULT_WORKFLOW_KEY],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()?;

    if let Some((workflow_id, workflow_type)) = default_workflow_row {
        match workflow_type.as_deref() {
            Some("workflow") => {}
            Some(_) => issues.push(DatabaseConsistencyIssue {
                severity: ConsistencyIssueSeverity::Error,
                code: "default_workflow_wrong_type".into(),
                message: format!("默认工作流设置指向了非 workflow 条目：{}。", workflow_id),
                item_id: Some(workflow_id),
                step_id: None,
            }),
            None => issues.push(DatabaseConsistencyIssue {
                severity: ConsistencyIssueSeverity::Error,
                code: "default_workflow_missing".into(),
                message: format!("默认工作流设置指向了不存在的条目：{}。", workflow_id),
                item_id: Some(workflow_id),
                step_id: None,
            }),
        }
    }

    let mut stale_history_statement = connection.prepare(
        "
        SELECT target, title
        FROM command_history
        WHERE kind = 'item'
          AND NOT EXISTS (SELECT 1 FROM items WHERE items.id = command_history.target)
        ORDER BY last_used_at DESC
        ",
    )?;
    let stale_history_rows = stale_history_statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in stale_history_rows {
        let (target, title) = row?;
        issues.push(DatabaseConsistencyIssue {
            severity: ConsistencyIssueSeverity::Warning,
            code: "stale_command_history_item".into(),
            message: format!("命令历史仍引用已删除条目：{}（{}）。", title, target),
            item_id: Some(target),
            step_id: None,
        });
    }

    let warning_count = issues
        .iter()
        .filter(|issue| issue.severity == ConsistencyIssueSeverity::Warning)
        .count();
    let error_count = issues
        .iter()
        .filter(|issue| issue.severity == ConsistencyIssueSeverity::Error)
        .count();

    Ok(DatabaseConsistencyReport {
        checked_at: current_timestamp(),
        path: db_path.display().to_string(),
        ok: error_count == 0,
        issue_count: issues.len(),
        warning_count,
        error_count,
        issues,
        table_counts: collect_table_counts(connection)?,
    })
}

fn prepare_import_items(path: &Path) -> Result<ImportPreparation> {
    let contents =
        fs::read_to_string(path).with_context(|| format!("Failed to read {}.", path.display()))?;
    let import_file: ItemsExportFile = serde_json::from_str(&contents)
        .with_context(|| format!("{} is not a valid DeskHub export.", path.display()))?;

    if import_file.version != 1 {
        return Err(anyhow!(
            "Unsupported import version {}. DeskHub currently only supports version 1 exports.",
            import_file.version
        ));
    }

    let mut preview_items = Vec::new();
    let mut valid_payloads = Vec::new();
    let mut errors = Vec::new();

    for (index, item) in import_file.items.iter().enumerate() {
        preview_items.push(build_import_preview_item(index + 1, item));

        match build_import_payload(item) {
            Ok(payload) => {
                if let Err(message) = payload.validate() {
                    errors.push(format!("第 {} 项导入失败：{}", index + 1, message));
                } else {
                    valid_payloads.push(payload);
                }
            }
            Err(error) => errors.push(format!("第 {} 项导入失败：{}", index + 1, error)),
        }
    }

    Ok(ImportPreparation {
        version: import_file.version,
        preview_items,
        valid_payloads,
        errors,
    })
}

fn build_import_preview_item(index: usize, item: &DeskItem) -> ImportPreviewItem {
    let (step_count, target) = match item {
        DeskItem::App { launch_target, .. } => (None, Some(launch_target.clone())),
        DeskItem::Project {
            project_path,
            dev_command,
            ..
        } => (
            None,
            Some(if dev_command.trim().is_empty() {
                project_path.clone()
            } else {
                format!("{project_path} · {dev_command}")
            }),
        ),
        DeskItem::Folder { path, .. } => (None, Some(path.clone())),
        DeskItem::Url { url, .. } => (None, Some(url.clone())),
        DeskItem::Script { command, .. } => (None, Some(command.clone())),
        DeskItem::Workflow { steps, .. } => (
            Some(steps.len()),
            Some(
                steps
                    .iter()
                    .take(3)
                    .map(workflow_step_preview_value)
                    .collect::<Vec<_>>()
                    .join(" -> "),
            ),
        ),
    };

    ImportPreviewItem {
        index,
        name: item.name().to_string(),
        item_type: item.item_type().to_string(),
        tags: item.base().tags.clone(),
        step_count,
        target,
    }
}

fn workflow_step_preview_value(step: &WorkflowStep) -> String {
    match step {
        WorkflowStep::OpenPath { path, .. } => path.clone(),
        WorkflowStep::OpenUrl { url, .. } => url.clone(),
        WorkflowStep::RunCommand { command, .. } => command.clone(),
    }
}

fn table_exists(connection: &Connection, table: &str) -> Result<bool> {
    let exists = connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [table],
            |_| Ok(()),
        )
        .optional()?
        .is_some();

    Ok(exists)
}

fn column_exists(connection: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = statement.query_map([], |row| row.get::<_, String>(1))?;

    for row in rows {
        if row? == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn collect_table_counts(
    connection: &Connection,
) -> Result<std::collections::BTreeMap<String, i64>> {
    let mut counts = std::collections::BTreeMap::new();

    for table in [
        "items",
        "item_tags",
        "workflow_steps",
        "workflow_variables",
        "app_settings",
        "command_history",
        "data_tool_history",
    ] {
        let count: i64 =
            connection.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })?;
        counts.insert(table.to_string(), count);
    }

    Ok(counts)
}

fn count_workflow_items(connection: &Connection) -> Result<usize> {
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM items WHERE type = 'workflow'",
        [],
        |row| row.get(0),
    )?;
    Ok(count.max(0) as usize)
}

fn compute_file_sha256(path: &Path) -> Result<String> {
    let mut file =
        fs::File::open(path).with_context(|| format!("Failed to open {}.", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn load_collection(connection: &Connection) -> Result<ItemCollection> {
    let mut statement = connection.prepare(
        "
        SELECT
            id,
            type,
            name,
            description,
            icon,
            favorite,
            created_at,
            updated_at,
            last_launched_at,
            launch_target,
            project_path,
            dev_command,
            path,
            url,
            command,
            execution_mode
        FROM items
        ORDER BY updated_at DESC, name COLLATE NOCASE ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(DbItemRecord {
            id: row.get(0)?,
            item_type: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            icon: row.get(4)?,
            favorite: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            last_launched_at: row.get(8)?,
            launch_target: row.get(9)?,
            project_path: row.get(10)?,
            dev_command: row.get(11)?,
            path: row.get(12)?,
            url: row.get(13)?,
            command: row.get(14)?,
            execution_mode: row.get(15)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(map_record_to_item(connection, row?)?);
    }

    Ok(ItemCollection { items })
}

fn load_command_history(connection: &Connection) -> Result<CommandHistoryCollection> {
    let mut statement = connection.prepare(
        "
        SELECT kind, target, title, last_used_at, use_count
        FROM command_history
        ORDER BY last_used_at DESC, use_count DESC, title COLLATE NOCASE ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i64>(4)?,
        ))
    })?;

    let mut entries = Vec::new();
    for row in rows {
        let (kind, target, title, last_used_at, use_count) = row?;
        entries.push(CommandHistoryEntry {
            kind: history_kind_from_str(&kind)?,
            target,
            title,
            last_used_at,
            use_count,
        });
    }

    Ok(CommandHistoryCollection { entries })
}

fn load_command_history_entry(
    connection: &Connection,
    kind: CommandHistoryKind,
    target: &str,
) -> Result<CommandHistoryEntry> {
    let entry = connection
        .query_row(
            "
            SELECT kind, target, title, last_used_at, use_count
            FROM command_history
            WHERE kind = ?1 AND target = ?2
            ",
            params![kind.as_str(), target],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            },
        )
        .optional()?
        .with_context(|| format!("History entry {}:{} was not found.", kind.as_str(), target))?;

    Ok(CommandHistoryEntry {
        kind: history_kind_from_str(&entry.0)?,
        target: entry.1,
        title: entry.2,
        last_used_at: entry.3,
        use_count: entry.4,
    })
}

fn load_data_tool_history(connection: &Connection) -> Result<DataToolHistoryCollection> {
    let mut statement = connection.prepare(
        "
        SELECT
            id,
            action,
            status,
            title,
            summary,
            occurred_at,
            source_path,
            output_path,
            backup_path,
            item_names_json,
            errors_json,
            extra_json
        FROM data_tool_history
        ORDER BY occurred_at DESC, title COLLATE NOCASE ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, String>(9)?,
            row.get::<_, String>(10)?,
            row.get::<_, String>(11)?,
        ))
    })?;

    let mut records = Vec::new();
    for row in rows {
        let (
            id,
            action,
            status,
            title,
            summary,
            occurred_at,
            source_path,
            output_path,
            backup_path,
            item_names_json,
            errors_json,
            extra_json,
        ) = row?;

        records.push(DataToolHistoryEntry {
            id,
            action: data_tool_action_from_str(&action)?,
            status: data_tool_status_from_str(&status)?,
            title,
            summary,
            occurred_at,
            source_path,
            output_path,
            backup_path,
            item_names: serde_json::from_str(&item_names_json)
                .with_context(|| "Failed to decode data tool history item names.".to_string())?,
            errors: serde_json::from_str(&errors_json)
                .with_context(|| "Failed to decode data tool history errors.".to_string())?,
            extra: serde_json::from_str(&extra_json)
                .with_context(|| "Failed to decode data tool history metadata.".to_string())?,
        });
    }

    Ok(DataToolHistoryCollection { records })
}

fn load_ui_settings(connection: &Connection) -> Result<UiSettings> {
    let default_workflow_id = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            [DEFAULT_WORKFLOW_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    let auto_backup_enabled = load_bool_setting(
        connection,
        AUTO_BACKUP_ENABLED_KEY,
        DEFAULT_AUTO_BACKUP_ENABLED,
    )?;
    let auto_backup_interval_hours = load_u32_setting(
        connection,
        AUTO_BACKUP_INTERVAL_HOURS_KEY,
        DEFAULT_AUTO_BACKUP_INTERVAL_HOURS,
    )?;
    let backup_retention_count = load_u32_setting(
        connection,
        BACKUP_RETENTION_COUNT_KEY,
        DEFAULT_BACKUP_RETENTION_COUNT,
    )?;
    let diagnostic_mode =
        load_bool_setting(connection, DIAGNOSTIC_MODE_KEY, DEFAULT_DIAGNOSTIC_MODE)?;
    let last_auto_backup_at = load_setting_value(connection, LAST_AUTO_BACKUP_AT_KEY)?;
    let overview_section_order = load_overview_sections_setting(
        connection,
        OVERVIEW_SECTION_ORDER_KEY,
        default_overview_section_order(),
    )?;
    let overview_hidden_sections =
        load_overview_sections_setting(connection, OVERVIEW_HIDDEN_SECTIONS_KEY, Vec::new())?;
    let overview_layout_templates = load_overview_layout_templates_setting(
        connection,
        OVERVIEW_LAYOUT_TEMPLATES_KEY,
    )?;
    let overview_workflow_link_mode = load_overview_workflow_link_mode_setting(
        connection,
        OVERVIEW_WORKFLOW_LINK_MODE_KEY,
        OverviewWorkflowLinkMode::None,
    )?;

    Ok(UiSettings {
        default_workflow_id,
        auto_backup_enabled,
        auto_backup_interval_hours,
        backup_retention_count,
        diagnostic_mode,
        last_auto_backup_at,
        overview_section_order,
        overview_hidden_sections,
        overview_layout_templates,
        overview_workflow_link_mode,
    })
}

fn load_setting_value(connection: &Connection, key: &str) -> Result<Option<String>> {
    connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            [key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(Into::into)
}

fn load_bool_setting(connection: &Connection, key: &str, default: bool) -> Result<bool> {
    Ok(load_setting_value(connection, key)?
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or(default))
}

fn load_u32_setting(connection: &Connection, key: &str, default: u32) -> Result<u32> {
    Ok(load_setting_value(connection, key)?
        .and_then(|value| value.trim().parse::<u32>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default))
}

fn load_overview_sections_setting(
    connection: &Connection,
    key: &str,
    default: Vec<OverviewSectionId>,
) -> Result<Vec<OverviewSectionId>> {
    let Some(value) = load_setting_value(connection, key)? else {
        return Ok(default);
    };

    let parsed = serde_json::from_str::<Vec<OverviewSectionId>>(&value)
        .with_context(|| format!("Failed to decode overview setting {key}."))?;

    if parsed.is_empty() {
        return Ok(default);
    }

    let payload = OverviewLayoutPayload {
        section_order: if key == OVERVIEW_SECTION_ORDER_KEY {
            parsed.clone()
        } else {
            default_overview_section_order()
        },
        hidden_sections: if key == OVERVIEW_HIDDEN_SECTIONS_KEY {
            parsed
        } else {
            Vec::new()
        },
        layout_templates: None,
        workflow_link_mode: None,
    }
    .normalized();

    if key == OVERVIEW_SECTION_ORDER_KEY {
        Ok(payload.section_order)
    } else {
        Ok(payload.hidden_sections)
    }
}

fn load_overview_layout_templates_setting(
    connection: &Connection,
    key: &str,
) -> Result<Vec<OverviewLayoutTemplate>> {
    let Some(value) = load_setting_value(connection, key)? else {
        return Ok(Vec::new());
    };

    let parsed = serde_json::from_str::<Vec<OverviewLayoutTemplate>>(&value)
        .with_context(|| format!("Failed to decode overview setting {key}."))?;

    let mut seen_ids = HashSet::new();
    let mut normalized = Vec::new();
    for layout_template in parsed.into_iter().map(|layout_template| layout_template.normalized()) {
        if layout_template.id.is_empty()
            || layout_template.name.is_empty()
            || !seen_ids.insert(layout_template.id.clone())
        {
            continue;
        }
        normalized.push(layout_template);
    }

    Ok(normalized)
}

fn load_overview_workflow_link_mode_setting(
    connection: &Connection,
    key: &str,
    default: OverviewWorkflowLinkMode,
) -> Result<OverviewWorkflowLinkMode> {
    Ok(match load_setting_value(connection, key)?
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("prioritize_workflows") => OverviewWorkflowLinkMode::PrioritizeWorkflows,
        Some("none") => OverviewWorkflowLinkMode::None,
        _ => default,
    })
}

fn ensure_data_tool_write_allowed(connection: &Connection) -> Result<()> {
    if load_bool_setting(connection, DIAGNOSTIC_MODE_KEY, DEFAULT_DIAGNOSTIC_MODE)? {
        return Err(anyhow!(
            "Diagnostic mode is enabled. Turn it off in Data Tools settings before running write operations."
        ));
    }

    Ok(())
}

fn load_items_by_ids(connection: &Connection, ids: &[String]) -> Result<Vec<DeskItem>> {
    let mut items = Vec::new();

    for id in ids {
        items.push(load_item_by_id(connection, id)?);
    }

    Ok(items)
}

fn load_item_by_id(connection: &Connection, id: &str) -> Result<DeskItem> {
    let record = connection
        .query_row(
            "
            SELECT
                id,
                type,
                name,
                description,
                icon,
                favorite,
                created_at,
                updated_at,
                last_launched_at,
                launch_target,
                project_path,
                dev_command,
                path,
                url,
                command,
                execution_mode
            FROM items
            WHERE id = ?1
            ",
            [id],
            |row| {
                Ok(DbItemRecord {
                    id: row.get(0)?,
                    item_type: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    icon: row.get(4)?,
                    favorite: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                    last_launched_at: row.get(8)?,
                    launch_target: row.get(9)?,
                    project_path: row.get(10)?,
                    dev_command: row.get(11)?,
                    path: row.get(12)?,
                    url: row.get(13)?,
                    command: row.get(14)?,
                    execution_mode: row.get(15)?,
                })
            },
        )
        .optional()?
        .with_context(|| format!("Item {id} was not found."))?;

    map_record_to_item(connection, record)
}

fn load_existing_project_path_map(
    connection: &Connection,
) -> Result<HashMap<String, (String, String)>> {
    let mut statement = connection.prepare(
        "
        SELECT id, name, project_path
        FROM items
        WHERE type = 'project'
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut projects = HashMap::new();
    for row in rows {
        let (id, name, project_path) = row?;
        projects.insert(
            normalize_project_path_for_matching(&project_path),
            (id, name),
        );
    }

    Ok(projects)
}

fn load_existing_url_map(connection: &Connection) -> Result<HashMap<String, (String, String)>> {
    let mut statement = connection.prepare(
        "
        SELECT id, name, url
        FROM items
        WHERE type = 'url'
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut urls = HashMap::new();
    for row in rows {
        let (id, name, url) = row?;
        urls.insert(normalize_url_for_matching(&url), (id, name));
    }

    Ok(urls)
}

fn annotate_browser_bookmark_scan(
    connection: &Connection,
    mut scan: BrowserBookmarkScanResponse,
) -> Result<BrowserBookmarkScanResponse> {
    let existing_urls = load_existing_url_map(connection)?;
    let mut importable_count = 0usize;
    let mut existing_count = 0usize;

    for candidate in &mut scan.candidates {
        let normalized_url = normalize_url_for_matching(candidate.url.as_str());
        if let Some((existing_item_id, existing_item_name)) = existing_urls.get(&normalized_url) {
            candidate.existing_item_id = Some(existing_item_id.clone());
            candidate.existing_item_name = Some(existing_item_name.clone());
            existing_count += 1;
        } else {
            importable_count += 1;
        }
    }

    scan.importable_count = importable_count;
    scan.existing_count = existing_count;
    scan.candidate_count = scan.candidates.len();
    scan.source_count = scan.sources.len();

    Ok(scan)
}

fn normalize_project_path_for_matching(path: &str) -> String {
    let normalized = Path::new(path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(path))
        .to_string_lossy()
        .trim()
        .to_string();

    if cfg!(target_os = "windows") {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}

fn normalize_url_for_matching(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let Ok(mut parsed) = Url::parse(trimmed) else {
        return trimmed.to_ascii_lowercase();
    };

    if parsed.path() == "/" {
        parsed.set_path("");
    }

    parsed.set_fragment(None);
    parsed.to_string().to_ascii_lowercase()
}

fn normalize_project_directory_import_options(
    options: Option<&ProjectDirectoryImportOptions>,
) -> ProjectDirectoryImportOptions {
    options.cloned().unwrap_or_default()
}

fn build_project_import_item(path: &str, timestamp: &str) -> Result<DeskItem> {
    let inspection = project_inspector::inspect_project_directory(Path::new(path))?;
    let suggested_name = inspection
        .suggested_name
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Untitled project")
                .trim()
                .to_string()
        });

    let payload = ItemPayload::Project {
        base: PayloadBase {
            name: suggested_name,
            description: build_project_import_description(&inspection.detected_files),
            tags: build_project_import_tags(&inspection.detected_files),
            icon: String::new(),
            favorite: false,
        },
        project_path: path.trim().to_string(),
        dev_command: inspection.suggested_command.unwrap_or_default(),
    };

    payload.validate().map_err(|message| anyhow!(message))?;

    Ok(payload.into_item(
        Uuid::new_v4().to_string(),
        timestamp.to_string(),
        timestamp.to_string(),
        None,
    ))
}

fn build_refreshed_project_import_item(
    existing_item: &DeskItem,
    path: &str,
    timestamp: &str,
) -> Result<DeskItem> {
    let inspection = project_inspector::inspect_project_directory(Path::new(path))?;
    let suggested_name = inspection
        .suggested_name
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| existing_item.name().to_string());
    let suggested_command = inspection
        .suggested_command
        .clone()
        .unwrap_or_else(|| match existing_item {
            DeskItem::Project { dev_command, .. } => dev_command.clone(),
            _ => String::new(),
        });
    let mut tags = existing_item.base().tags.clone();
    for tag in build_project_import_tags(&inspection.detected_files) {
        push_unique_tag(&mut tags, &tag);
    }

    let refreshed_item = match existing_item {
        DeskItem::Project { base, dev_command, .. } => ItemPayload::Project {
            base: PayloadBase {
                name: suggested_name,
                description: build_project_import_description(&inspection.detected_files),
                tags,
                icon: base.icon.clone(),
                favorite: base.favorite,
            },
            project_path: path.trim().to_string(),
            dev_command: if suggested_command.trim().is_empty() {
                dev_command.clone()
            } else {
                suggested_command
            },
        }
        .into_item(
            base.id.clone(),
            base.created_at.clone(),
            timestamp.to_string(),
            base.last_launched_at.clone(),
        ),
        _ => {
            return Err(anyhow!(
                "Only existing project items can be refreshed by project import."
            ));
        }
    };

    Ok(refreshed_item)
}

fn build_browser_bookmark_item(entry: &BrowserBookmarkImportEntry, timestamp: &str) -> Result<DeskItem> {
    let name = if entry.name.trim().is_empty() {
        Url::parse(entry.url.as_str())
            .ok()
            .and_then(|value| value.host_str().map(|host| host.to_string()))
            .unwrap_or_else(|| entry.url.trim().to_string())
    } else {
        entry.name.trim().to_string()
    };

    let payload = ItemPayload::Url {
        base: PayloadBase {
            name,
            description: build_browser_bookmark_description(entry),
            tags: build_browser_bookmark_tags(entry),
            icon: String::new(),
            favorite: false,
        },
        url: entry.url.trim().to_string(),
    };

    payload.validate().map_err(|message| anyhow!(message))?;

    Ok(payload.into_item(
        Uuid::new_v4().to_string(),
        timestamp.to_string(),
        timestamp.to_string(),
        None,
    ))
}

fn build_project_import_description(detected_files: &[String]) -> String {
    if detected_files.is_empty() {
        "自动导入的项目目录".to_string()
    } else {
        format!("自动导入项目目录，识别到 {}", detected_files.join(", "))
    }
}

fn build_project_import_tags(detected_files: &[String]) -> Vec<String> {
    let mut tags = Vec::new();

    for file_name in detected_files {
        match file_name.as_str() {
            "package.json" => push_unique_tag(&mut tags, "node"),
            "Cargo.toml" => push_unique_tag(&mut tags, "rust"),
            "pyproject.toml" => push_unique_tag(&mut tags, "python"),
            "go.mod" => push_unique_tag(&mut tags, "go"),
            ".git" => push_unique_tag(&mut tags, "git"),
            _ => {}
        }
    }

    if !detected_files.is_empty() {
        push_unique_tag(&mut tags, "workspace");
    }

    tags
}

fn build_browser_bookmark_description(entry: &BrowserBookmarkImportEntry) -> String {
    let browser = entry.browser.trim();
    let profile_name = entry.profile_name.trim();
    let folder_path = entry.folder_path.trim();

    if folder_path.is_empty() {
        format!("从 {browser} · {profile_name} 收藏夹导入")
    } else {
        format!("从 {browser} · {profile_name} 的 {folder_path} 导入")
    }
}

fn build_browser_bookmark_tags(entry: &BrowserBookmarkImportEntry) -> Vec<String> {
    let mut tags = Vec::new();
    push_unique_tag(&mut tags, "bookmark");

    let browser_tag = entry.browser.trim().to_ascii_lowercase();
    if !browser_tag.is_empty() {
        push_unique_tag(&mut tags, browser_tag.as_str());
    }

    for segment in entry
        .folder_path
        .split('/')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .take(3)
    {
        push_unique_tag(&mut tags, segment);
    }

    tags
}

fn push_unique_tag(tags: &mut Vec<String>, tag: &str) {
    if !tags.iter().any(|existing| existing == tag) {
        tags.push(tag.to_string());
    }
}

fn map_record_to_item(connection: &Connection, record: DbItemRecord) -> Result<DeskItem> {
    let base = ItemBase {
        id: record.id.clone(),
        name: record.name,
        description: record.description,
        tags: load_item_tags(connection, &record.id)?,
        icon: record.icon,
        favorite: record.favorite,
        created_at: record.created_at,
        updated_at: record.updated_at,
        last_launched_at: record.last_launched_at,
    };

    match record.item_type.as_str() {
        "app" => Ok(DeskItem::App {
            base,
            launch_target: required_field("launch_target", &record.id, record.launch_target)?,
        }),
        "project" => Ok(DeskItem::Project {
            base,
            project_path: required_field("project_path", &record.id, record.project_path)?,
            dev_command: record.dev_command.unwrap_or_default(),
        }),
        "folder" => Ok(DeskItem::Folder {
            base,
            path: required_field("path", &record.id, record.path)?,
        }),
        "url" => Ok(DeskItem::Url {
            base,
            url: required_field("url", &record.id, record.url)?,
        }),
        "script" => Ok(DeskItem::Script {
            base,
            command: required_field("command", &record.id, record.command)?,
            execution_mode: execution_mode_from_value(record.execution_mode.as_deref(), "item")?,
        }),
        "workflow" => Ok(DeskItem::Workflow {
            base,
            variables: load_workflow_variables(connection, &record.id)?,
            steps: load_workflow_steps(connection, &record.id)?,
        }),
        other => Err(anyhow!("Item {} has unsupported type {other}.", record.id)),
    }
}

fn load_item_tags(connection: &Connection, item_id: &str) -> Result<Vec<String>> {
    let mut statement = connection
        .prepare("SELECT tag FROM item_tags WHERE item_id = ?1 ORDER BY tag COLLATE NOCASE ASC")?;
    let rows = statement.query_map([item_id], |row| row.get::<_, String>(0))?;

    let mut tags = Vec::new();
    for row in rows {
        tags.push(row?);
    }

    Ok(tags)
}

fn load_workflow_variables(
    connection: &Connection,
    workflow_id: &str,
) -> Result<Vec<WorkflowVariable>> {
    let mut statement = connection.prepare(
        "
        SELECT id, key, label, default_value, required
        FROM workflow_variables
        WHERE workflow_id = ?1
        ORDER BY position ASC
        ",
    )?;
    let mut rows = statement.query([workflow_id])?;
    let mut variables = Vec::new();

    while let Some(row) = rows.next()? {
        let required: i64 = row.get(4)?;
        variables.push(WorkflowVariable {
            id: row.get(0)?,
            key: row.get(1)?,
            label: row.get(2)?,
            default_value: row.get(3)?,
            required: required != 0,
        });
    }

    Ok(variables)
}

fn load_workflow_steps(connection: &Connection, workflow_id: &str) -> Result<Vec<WorkflowStep>> {
    let mut statement = connection.prepare(
        "
        SELECT
            id,
            type,
            path,
            url,
            command,
            execution_mode,
            failure_strategy,
            retry_count,
            retry_delay_ms,
            condition_variable_key,
            condition_operator,
            condition_value,
            condition_on_false,
            condition_jump_to_step_id,
            note,
            delay_ms
        FROM workflow_steps
        WHERE workflow_id = ?1
        ORDER BY position ASC
        ",
    )?;
    let mut rows = statement.query([workflow_id])?;
    let mut steps = Vec::new();

    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let step_type: String = row.get(1)?;
        let path: Option<String> = row.get(2)?;
        let url: Option<String> = row.get(3)?;
        let command: Option<String> = row.get(4)?;
        let execution_mode: Option<String> = row.get(5)?;
        let failure_strategy: Option<String> = row.get(6)?;
        let retry_count: i64 = row.get(7)?;
        let retry_delay_ms: i64 = row.get(8)?;
        let condition_variable_key: Option<String> = row.get(9)?;
        let condition_operator: Option<String> = row.get(10)?;
        let condition_value: Option<String> = row.get(11)?;
        let condition_on_false: Option<String> = row.get(12)?;
        let condition_jump_to_step_id: Option<String> = row.get(13)?;
        let note: String = row.get(14)?;
        let delay_ms: i64 = row.get(15)?;
        let normalized_delay_ms = u64::try_from(delay_ms)
            .with_context(|| format!("Workflow {workflow_id} has a negative delay."))?;
        let normalized_retry_count = u32::try_from(retry_count)
            .with_context(|| format!("Workflow {workflow_id} has a negative retry count."))?;
        let normalized_retry_delay_ms = u64::try_from(retry_delay_ms)
            .with_context(|| format!("Workflow {workflow_id} has a negative retry delay."))?;
        let condition = build_workflow_step_condition(
            condition_variable_key,
            condition_operator.as_deref(),
            condition_value,
            condition_on_false.as_deref(),
            condition_jump_to_step_id,
            workflow_id,
        )?;

        steps.push(match step_type.as_str() {
            "open_path" => WorkflowStep::OpenPath {
                id,
                path: required_field("path", workflow_id, path)?,
                note,
                delay_ms: normalized_delay_ms,
                condition,
            },
            "open_url" => WorkflowStep::OpenUrl {
                id,
                url: required_field("url", workflow_id, url)?,
                note,
                delay_ms: normalized_delay_ms,
                condition,
            },
            "run_command" => WorkflowStep::RunCommand {
                id,
                command: required_field("command", workflow_id, command)?,
                execution_mode: execution_mode_from_value(
                    execution_mode.as_deref(),
                    "workflow step",
                )?,
                failure_strategy: failure_strategy_from_value(
                    failure_strategy.as_deref(),
                    "workflow step",
                )?,
                retry_count: normalized_retry_count,
                retry_delay_ms: normalized_retry_delay_ms,
                note,
                delay_ms: normalized_delay_ms,
                condition,
            },
            other => {
                return Err(anyhow!(
                    "Workflow {} contains an unsupported step type {other}.",
                    workflow_id
                ));
            }
        });
    }

    Ok(steps)
}

fn history_kind_from_str(value: &str) -> Result<CommandHistoryKind> {
    match value {
        "item" => Ok(CommandHistoryKind::Item),
        "route" => Ok(CommandHistoryKind::Route),
        "action" => Ok(CommandHistoryKind::Action),
        other => Err(anyhow!("Unsupported command history kind: {other}")),
    }
}

fn data_tool_action_from_str(value: &str) -> Result<DataToolAction> {
    match value {
        "backup" => Ok(DataToolAction::Backup),
        "restore" => Ok(DataToolAction::Restore),
        "import" => Ok(DataToolAction::Import),
        "import_bookmarks" => Ok(DataToolAction::ImportBookmarks),
        "import_projects" => Ok(DataToolAction::ImportProjects),
        "preview_import" => Ok(DataToolAction::PreviewImport),
        "export_all" => Ok(DataToolAction::ExportAll),
        "export_workflows" => Ok(DataToolAction::ExportWorkflows),
        "health_check" => Ok(DataToolAction::HealthCheck),
        "consistency_check" => Ok(DataToolAction::ConsistencyCheck),
        "optimize_database" => Ok(DataToolAction::OptimizeDatabase),
        "clear_command_history" => Ok(DataToolAction::ClearCommandHistory),
        "export_structured_report" => Ok(DataToolAction::ExportStructuredReport),
        other => Err(anyhow!("Unsupported data tool action: {other}")),
    }
}

fn data_tool_status_from_str(value: &str) -> Result<DataToolOperationStatus> {
    match value {
        "success" => Ok(DataToolOperationStatus::Success),
        "warning" => Ok(DataToolOperationStatus::Warning),
        "error" => Ok(DataToolOperationStatus::Error),
        other => Err(anyhow!("Unsupported data tool status: {other}")),
    }
}

fn execution_mode_from_value(value: Option<&str>, context: &str) -> Result<CommandExecutionMode> {
    match value.unwrap_or("blocking") {
        "blocking" => Ok(CommandExecutionMode::Blocking),
        "new_terminal" => Ok(CommandExecutionMode::NewTerminal),
        "background" => Ok(CommandExecutionMode::Background),
        other => Err(anyhow!("Unsupported execution mode for {context}: {other}")),
    }
}

fn failure_strategy_from_value(
    value: Option<&str>,
    context: &str,
) -> Result<WorkflowFailureStrategy> {
    match value.unwrap_or("stop") {
        "stop" => Ok(WorkflowFailureStrategy::Stop),
        "continue" => Ok(WorkflowFailureStrategy::Continue),
        "retry" => Ok(WorkflowFailureStrategy::Retry),
        other => Err(anyhow!(
            "Unsupported workflow failure strategy for {context}: {other}"
        )),
    }
}

fn condition_operator_from_value(
    value: Option<&str>,
    context: &str,
) -> Result<WorkflowConditionOperator> {
    match value.unwrap_or("equals") {
        "equals" => Ok(WorkflowConditionOperator::Equals),
        "not_equals" => Ok(WorkflowConditionOperator::NotEquals),
        "contains" => Ok(WorkflowConditionOperator::Contains),
        "not_contains" => Ok(WorkflowConditionOperator::NotContains),
        "is_empty" => Ok(WorkflowConditionOperator::IsEmpty),
        "not_empty" => Ok(WorkflowConditionOperator::NotEmpty),
        other => Err(anyhow!(
            "Unsupported workflow condition operator for {context}: {other}"
        )),
    }
}

fn condition_fail_action_from_value(
    value: Option<&str>,
    context: &str,
) -> Result<WorkflowConditionFailAction> {
    match value.unwrap_or("skip") {
        "skip" => Ok(WorkflowConditionFailAction::Skip),
        "jump" => Ok(WorkflowConditionFailAction::Jump),
        other => Err(anyhow!(
            "Unsupported workflow condition fail action for {context}: {other}"
        )),
    }
}

fn build_workflow_step_condition(
    variable_key: Option<String>,
    operator: Option<&str>,
    value: Option<String>,
    on_false_action: Option<&str>,
    jump_to_step_id: Option<String>,
    workflow_id: &str,
) -> Result<Option<WorkflowStepCondition>> {
    let Some(variable_key) = variable_key.map(|value| value.trim().to_string()) else {
        return Ok(None);
    };

    if variable_key.is_empty() {
        return Ok(None);
    }

    Ok(Some(WorkflowStepCondition {
        variable_key,
        operator: condition_operator_from_value(operator, workflow_id)?,
        value: value.unwrap_or_default(),
        on_false_action: condition_fail_action_from_value(on_false_action, workflow_id)?,
        jump_to_step_id: jump_to_step_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    }))
}

fn required_field(field: &str, item_id: &str, value: Option<String>) -> Result<String> {
    value.with_context(|| format!("Item {item_id} is missing {field}."))
}

fn optional_columns(item: &DeskItem) -> OptionalColumns<'_> {
    match item {
        DeskItem::App { launch_target, .. } => OptionalColumns {
            launch_target: Some(launch_target.as_str()),
            project_path: None,
            dev_command: None,
            path: None,
            url: None,
            command: None,
            execution_mode: None,
        },
        DeskItem::Project {
            project_path,
            dev_command,
            ..
        } => OptionalColumns {
            launch_target: None,
            project_path: Some(project_path.as_str()),
            dev_command: Some(dev_command.as_str()),
            path: None,
            url: None,
            command: None,
            execution_mode: None,
        },
        DeskItem::Folder { path, .. } => OptionalColumns {
            launch_target: None,
            project_path: None,
            dev_command: None,
            path: Some(path.as_str()),
            url: None,
            command: None,
            execution_mode: None,
        },
        DeskItem::Url { url, .. } => OptionalColumns {
            launch_target: None,
            project_path: None,
            dev_command: None,
            path: None,
            url: Some(url.as_str()),
            command: None,
            execution_mode: None,
        },
        DeskItem::Script {
            command,
            execution_mode,
            ..
        } => OptionalColumns {
            launch_target: None,
            project_path: None,
            dev_command: None,
            path: None,
            url: None,
            command: Some(command.as_str()),
            execution_mode: Some(execution_mode.as_str()),
        },
        DeskItem::Workflow { .. } => OptionalColumns {
            launch_target: None,
            project_path: None,
            dev_command: None,
            path: None,
            url: None,
            command: None,
            execution_mode: None,
        },
    }
}

fn insert_item(transaction: &Transaction<'_>, item: &DeskItem) -> Result<()> {
    let base = item.base();
    let columns = optional_columns(item);

    transaction.execute(
        "
        INSERT INTO items (
            id, name, type, description, icon, favorite, created_at, updated_at, last_launched_at,
            launch_target, project_path, dev_command, path, url, command, execution_mode
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ",
        params![
            base.id.as_str(),
            base.name.as_str(),
            item.item_type(),
            base.description.as_str(),
            base.icon.as_str(),
            base.favorite,
            base.created_at.as_str(),
            base.updated_at.as_str(),
            base.last_launched_at.as_deref(),
            columns.launch_target,
            columns.project_path,
            columns.dev_command,
            columns.path,
            columns.url,
            columns.command,
            columns.execution_mode,
        ],
    )?;

    replace_item_tags(transaction, item.id(), &base.tags)?;
    replace_workflow_variables(transaction, item)?;
    replace_workflow_steps(transaction, item)?;
    Ok(())
}

fn update_item_row(transaction: &Transaction<'_>, item: &DeskItem) -> Result<()> {
    let base = item.base();
    let columns = optional_columns(item);
    let affected = transaction.execute(
        "
        UPDATE items
        SET
            name = ?2,
            type = ?3,
            description = ?4,
            icon = ?5,
            favorite = ?6,
            created_at = ?7,
            updated_at = ?8,
            last_launched_at = ?9,
            launch_target = ?10,
            project_path = ?11,
            dev_command = ?12,
            path = ?13,
            url = ?14,
            command = ?15,
            execution_mode = ?16
        WHERE id = ?1
        ",
        params![
            base.id.as_str(),
            base.name.as_str(),
            item.item_type(),
            base.description.as_str(),
            base.icon.as_str(),
            base.favorite,
            base.created_at.as_str(),
            base.updated_at.as_str(),
            base.last_launched_at.as_deref(),
            columns.launch_target,
            columns.project_path,
            columns.dev_command,
            columns.path,
            columns.url,
            columns.command,
            columns.execution_mode,
        ],
    )?;

    if affected == 0 {
        return Err(anyhow!("Item {} was not found.", base.id));
    }

    Ok(())
}

fn replace_item_tags(transaction: &Transaction<'_>, item_id: &str, tags: &[String]) -> Result<()> {
    transaction.execute("DELETE FROM item_tags WHERE item_id = ?1", [item_id])?;
    for tag in tags {
        transaction.execute(
            "INSERT INTO item_tags (item_id, tag) VALUES (?1, ?2)",
            params![item_id, tag],
        )?;
    }
    Ok(())
}

fn replace_workflow_variables(transaction: &Transaction<'_>, item: &DeskItem) -> Result<()> {
    transaction.execute(
        "DELETE FROM workflow_variables WHERE workflow_id = ?1",
        [item.id()],
    )?;

    if let DeskItem::Workflow { variables, .. } = item {
        for (position, variable) in variables.iter().enumerate() {
            transaction.execute(
                "
                INSERT INTO workflow_variables (
                    id, workflow_id, position, key, label, default_value, required
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ",
                params![
                    variable.id,
                    item.id(),
                    position as i64,
                    variable.key,
                    variable.label,
                    variable.default_value,
                    variable.required,
                ],
            )?;
        }
    }

    Ok(())
}

fn replace_workflow_steps(transaction: &Transaction<'_>, item: &DeskItem) -> Result<()> {
    transaction.execute(
        "DELETE FROM workflow_steps WHERE workflow_id = ?1",
        [item.id()],
    )?;

    if let DeskItem::Workflow { steps, .. } = item {
        for (position, step) in steps.iter().enumerate() {
            match step {
                WorkflowStep::OpenPath {
                    id,
                    path,
                    note,
                    delay_ms,
                    condition,
                } => {
                    let condition = condition.as_ref();
                    transaction.execute(
                        "
                        INSERT INTO workflow_steps (
                            id,
                            workflow_id,
                            position,
                            type,
                            path,
                            url,
                            command,
                            execution_mode,
                            failure_strategy,
                            retry_count,
                            retry_delay_ms,
                            condition_variable_key,
                            condition_operator,
                            condition_value,
                            condition_on_false,
                            condition_jump_to_step_id,
                            note,
                            delay_ms
                        )
                        VALUES (?1, ?2, ?3, 'open_path', ?4, NULL, NULL, NULL, 'stop', 0, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                        ",
                        params![
                            id,
                            item.id(),
                            position as i64,
                            path,
                            condition.map(|value| value.variable_key.as_str()),
                            condition.map(|value| value.operator.as_str()),
                            condition.map(|value| value.value.as_str()),
                            condition.map(|value| value.on_false_action.as_str()),
                            condition.and_then(|value| value.jump_to_step_id.as_deref()),
                            note,
                            *delay_ms as i64
                        ],
                    )?;
                }
                WorkflowStep::OpenUrl {
                    id,
                    url,
                    note,
                    delay_ms,
                    condition,
                } => {
                    let condition = condition.as_ref();
                    transaction.execute(
                        "
                        INSERT INTO workflow_steps (
                            id,
                            workflow_id,
                            position,
                            type,
                            path,
                            url,
                            command,
                            execution_mode,
                            failure_strategy,
                            retry_count,
                            retry_delay_ms,
                            condition_variable_key,
                            condition_operator,
                            condition_value,
                            condition_on_false,
                            condition_jump_to_step_id,
                            note,
                            delay_ms
                        )
                        VALUES (?1, ?2, ?3, 'open_url', NULL, ?4, NULL, NULL, 'stop', 0, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                        ",
                        params![
                            id,
                            item.id(),
                            position as i64,
                            url,
                            condition.map(|value| value.variable_key.as_str()),
                            condition.map(|value| value.operator.as_str()),
                            condition.map(|value| value.value.as_str()),
                            condition.map(|value| value.on_false_action.as_str()),
                            condition.and_then(|value| value.jump_to_step_id.as_deref()),
                            note,
                            *delay_ms as i64
                        ],
                    )?;
                }
                WorkflowStep::RunCommand {
                    id,
                    command,
                    execution_mode,
                    failure_strategy,
                    retry_count,
                    retry_delay_ms,
                    note,
                    delay_ms,
                    condition,
                } => {
                    let condition = condition.as_ref();
                    transaction.execute(
                        "
                        INSERT INTO workflow_steps (
                            id,
                            workflow_id,
                            position,
                            type,
                            path,
                            url,
                            command,
                            execution_mode,
                            failure_strategy,
                            retry_count,
                            retry_delay_ms,
                            condition_variable_key,
                            condition_operator,
                            condition_value,
                            condition_on_false,
                            condition_jump_to_step_id,
                            note,
                            delay_ms
                        )
                        VALUES (?1, ?2, ?3, 'run_command', NULL, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                        ",
                        params![
                            id,
                            item.id(),
                            position as i64,
                            command,
                            execution_mode.as_str(),
                            failure_strategy.as_str(),
                            *retry_count as i64,
                            *retry_delay_ms as i64,
                            condition.map(|value| value.variable_key.as_str()),
                            condition.map(|value| value.operator.as_str()),
                            condition.map(|value| value.value.as_str()),
                            condition.map(|value| value.on_false_action.as_str()),
                            condition.and_then(|value| value.jump_to_step_id.as_deref()),
                            note,
                            *delay_ms as i64
                        ],
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn ensure_workflow_exists(transaction: &Transaction<'_>, workflow_id: &str) -> Result<()> {
    let item_type = transaction
        .query_row(
            "SELECT type FROM items WHERE id = ?1",
            [workflow_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    match item_type.as_deref() {
        Some("workflow") => Ok(()),
        Some(_) => Err(anyhow!(
            "Only workflow items can be set as the default workflow."
        )),
        None => Err(anyhow!("Workflow {workflow_id} was not found.")),
    }
}

fn upsert_setting(transaction: &Transaction<'_>, key: &str, value: &str) -> Result<()> {
    transaction.execute(
        "
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params![key, value],
    )?;
    Ok(())
}

fn delete_setting(transaction: &Transaction<'_>, key: &str) -> Result<()> {
    transaction.execute("DELETE FROM app_settings WHERE key = ?1", [key])?;
    Ok(())
}

fn clear_default_workflow_if_matches(
    transaction: &Transaction<'_>,
    workflow_id: &str,
) -> Result<()> {
    transaction.execute(
        "DELETE FROM app_settings WHERE key = ?1 AND value = ?2",
        params![DEFAULT_WORKFLOW_KEY, workflow_id],
    )?;
    Ok(())
}

fn upsert_command_history(
    transaction: &Transaction<'_>,
    payload: &CommandHistoryPayload,
) -> Result<()> {
    let used_at = current_timestamp();
    transaction.execute(
        "
        INSERT INTO command_history (kind, target, title, last_used_at, use_count)
        VALUES (?1, ?2, ?3, ?4, 1)
        ON CONFLICT(kind, target) DO UPDATE SET
            title = excluded.title,
            last_used_at = excluded.last_used_at,
            use_count = command_history.use_count + 1
        ",
        params![
            payload.kind.as_str(),
            payload.target.as_str(),
            payload.title.as_str(),
            used_at
        ],
    )?;

    transaction.execute(
        "
        DELETE FROM command_history
        WHERE (kind, target) IN (
            SELECT kind, target
            FROM command_history
            ORDER BY last_used_at DESC, use_count DESC, title COLLATE NOCASE ASC
            LIMIT -1 OFFSET ?1
        )
        ",
        [COMMAND_HISTORY_LIMIT],
    )?;

    Ok(())
}

fn insert_data_tool_history_entry(
    transaction: &Transaction<'_>,
    payload: &DataToolHistoryPayload,
) -> Result<DataToolHistoryEntry> {
    let entry = DataToolHistoryEntry {
        id: Uuid::new_v4().to_string(),
        action: payload.action.clone(),
        status: payload.status.clone(),
        title: payload.title.clone(),
        summary: payload.summary.clone(),
        occurred_at: current_timestamp(),
        source_path: payload.source_path.clone(),
        output_path: payload.output_path.clone(),
        backup_path: payload.backup_path.clone(),
        item_names: payload.item_names.clone(),
        errors: payload.errors.clone(),
        extra: payload.extra.clone(),
    };

    transaction.execute(
        "
        INSERT INTO data_tool_history (
            id,
            action,
            status,
            title,
            summary,
            occurred_at,
            source_path,
            output_path,
            backup_path,
            item_names_json,
            errors_json,
            extra_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ",
        params![
            entry.id.as_str(),
            entry.action.as_str(),
            entry.status.as_str(),
            entry.title.as_str(),
            entry.summary.as_str(),
            entry.occurred_at.as_str(),
            entry.source_path.as_deref(),
            entry.output_path.as_deref(),
            entry.backup_path.as_deref(),
            serde_json::to_string(&entry.item_names)?,
            serde_json::to_string(&entry.errors)?,
            serde_json::to_string(&entry.extra)?,
        ],
    )?;

    transaction.execute(
        "
        DELETE FROM data_tool_history
        WHERE id IN (
            SELECT id
            FROM data_tool_history
            ORDER BY occurred_at DESC, title COLLATE NOCASE ASC
            LIMIT -1 OFFSET ?1
        )
        ",
        [DATA_TOOL_HISTORY_LIMIT],
    )?;

    Ok(entry)
}

fn sanitize_ids(ids: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut sanitized = Vec::new();

    for id in ids {
        let trimmed = id.trim();
        if trimmed.is_empty() {
            continue;
        }

        if seen.insert(trimmed.to_string()) {
            sanitized.push(trimmed.to_string());
        }
    }

    sanitized
}

fn sanitize_paths(paths: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut sanitized = Vec::new();

    for path in paths {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            continue;
        }

        let normalized = normalize_project_path_for_matching(trimmed);
        if seen.insert(normalized) {
            sanitized.push(trimmed.to_string());
        }
    }

    sanitized
}

fn sanitize_browser_bookmark_entries(
    entries: &[BrowserBookmarkImportEntry],
) -> Vec<BrowserBookmarkImportEntry> {
    let mut seen = HashSet::new();
    let mut sanitized = Vec::new();

    for entry in entries {
        let url = entry.url.trim();
        if url.is_empty() {
            continue;
        }

        let normalized_url = normalize_url_for_matching(url);
        if normalized_url.is_empty() || !seen.insert(normalized_url) {
            continue;
        }

        sanitized.push(BrowserBookmarkImportEntry {
            browser: entry.browser.trim().to_string(),
            profile_name: entry.profile_name.trim().to_string(),
            source_path: entry.source_path.trim().to_string(),
            name: entry.name.trim().to_string(),
            url: url.to_string(),
            folder_path: entry.folder_path.trim().to_string(),
        });
    }

    sanitized
}

fn apply_batch_edit_to_item(item: &DeskItem, payload: &BatchEditItemsPayload) -> DeskItem {
    let mut next_item = item.clone();
    let next_updated_at = current_timestamp();

    match &mut next_item {
        DeskItem::App { base, .. }
        | DeskItem::Project { base, .. }
        | DeskItem::Folder { base, .. }
        | DeskItem::Url { base, .. }
        | DeskItem::Script { base, .. }
        | DeskItem::Workflow { base, .. } => {
            if let Some(description) = &payload.description {
                base.description = description.clone();
            }

            if let Some(icon) = &payload.icon {
                base.icon = icon.clone();
            }

            if let Some(tags) = &payload.tags {
                base.tags = match payload.tag_mode {
                    BatchTagMode::Replace => tags.clone(),
                    BatchTagMode::Append => {
                        let mut merged = base.tags.clone();
                        for tag in tags {
                            if !merged
                                .iter()
                                .any(|current| current.eq_ignore_ascii_case(tag))
                            {
                                merged.push(tag.clone());
                            }
                        }
                        merged
                    }
                };
            }

            base.updated_at = next_updated_at;
        }
    }

    next_item
}

fn build_import_payload(item: &DeskItem) -> Result<ItemPayload> {
    let base = PayloadBase {
        name: item.base().name.clone(),
        description: item.base().description.clone(),
        tags: item.base().tags.clone(),
        icon: item.base().icon.clone(),
        favorite: item.base().favorite,
    };

    Ok(match item {
        DeskItem::App { launch_target, .. } => ItemPayload::App {
            base,
            launch_target: launch_target.clone(),
        },
        DeskItem::Project {
            project_path,
            dev_command,
            ..
        } => ItemPayload::Project {
            base,
            project_path: project_path.clone(),
            dev_command: dev_command.clone(),
        },
        DeskItem::Folder { path, .. } => ItemPayload::Folder {
            base,
            path: path.clone(),
        },
        DeskItem::Url { url, .. } => ItemPayload::Url {
            base,
            url: url.clone(),
        },
        DeskItem::Script {
            command,
            execution_mode,
            ..
        } => ItemPayload::Script {
            base,
            command: command.clone(),
            execution_mode: *execution_mode,
        },
        DeskItem::Workflow {
            variables, steps, ..
        } => ItemPayload::Workflow {
            base,
            variables: variables
                .iter()
                .map(|variable| WorkflowVariable {
                    id: Uuid::new_v4().to_string(),
                    key: variable.key.clone(),
                    label: variable.label.clone(),
                    default_value: variable.default_value.clone(),
                    required: variable.required,
                })
                .collect(),
            steps: steps
                .iter()
                .map(|step| match step {
                    WorkflowStep::OpenPath {
                        path,
                        note,
                        delay_ms,
                        condition,
                        ..
                    } => WorkflowStep::OpenPath {
                        id: Uuid::new_v4().to_string(),
                        path: path.clone(),
                        note: note.clone(),
                        delay_ms: *delay_ms,
                        condition: condition.clone(),
                    },
                    WorkflowStep::OpenUrl {
                        url,
                        note,
                        delay_ms,
                        condition,
                        ..
                    } => WorkflowStep::OpenUrl {
                        id: Uuid::new_v4().to_string(),
                        url: url.clone(),
                        note: note.clone(),
                        delay_ms: *delay_ms,
                        condition: condition.clone(),
                    },
                    WorkflowStep::RunCommand {
                        command,
                        execution_mode,
                        failure_strategy,
                        retry_count,
                        retry_delay_ms,
                        note,
                        delay_ms,
                        condition,
                        ..
                    } => WorkflowStep::RunCommand {
                        id: Uuid::new_v4().to_string(),
                        command: command.clone(),
                        execution_mode: *execution_mode,
                        failure_strategy: *failure_strategy,
                        retry_count: *retry_count,
                        retry_delay_ms: *retry_delay_ms,
                        note: note.clone(),
                        delay_ms: *delay_ms,
                        condition: condition.clone(),
                    },
                })
                .collect(),
        },
    })
}

fn validate_restore_source(source: &Path, active_db_path: &Path) -> Result<()> {
    let validation_path = temporary_database_copy_path(active_db_path, "restore-validate")?;
    if validation_path.exists() {
        let _ = fs::remove_file(&validation_path);
    }

    fs::copy(source, &validation_path).with_context(|| {
        format!(
            "Failed to copy {} into DeskHub's validation workspace.",
            source.display()
        )
    })?;

    let validation_result = (|| -> Result<()> {
        let mut connection = Connection::open(&validation_path)
            .with_context(|| format!("Failed to open {}.", validation_path.display()))?;
        configure_connection(&connection)?;
        run_migrations(&mut connection)?;
        health_check_database(&connection, &validation_path)
    })();

    let _ = fs::remove_file(&validation_path);
    validation_result
}

fn compute_restore_diff(before: &[DeskItem], after: &[DeskItem]) -> Result<RestoreDiffSummary> {
    let before_map = before
        .iter()
        .map(|item| Ok((item.id().to_string(), serde_json::to_string(item)?)))
        .collect::<Result<std::collections::HashMap<_, _>>>()?;
    let after_map = after
        .iter()
        .map(|item| Ok((item.id().to_string(), serde_json::to_string(item)?)))
        .collect::<Result<std::collections::HashMap<_, _>>>()?;

    let added_count = after_map
        .keys()
        .filter(|id| !before_map.contains_key(*id))
        .count();
    let removed_count = before_map
        .keys()
        .filter(|id| !after_map.contains_key(*id))
        .count();
    let updated_count = after_map
        .iter()
        .filter(|(id, value)| {
            before_map
                .get(*id)
                .is_some_and(|before_value| before_value != *value)
        })
        .count();

    Ok(RestoreDiffSummary {
        before_item_count: before.len(),
        after_item_count: after.len(),
        added_count,
        removed_count,
        updated_count,
    })
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path, thread, time::Duration};

    use rusqlite::{Connection, params};
    use tempfile::tempdir;

    use super::StorageState;
    use crate::models::{
        BatchEditItemsPayload, BatchTagMode, BrowserBookmarkCandidate,
        BrowserBookmarkImportEntry, BrowserBookmarkScanResponse, CommandExecutionMode,
        CommandHistoryKind, CommandHistoryPayload, DataToolAction, DataToolHistoryPayload,
        DataToolOperationStatus, DeskItem, ItemPayload, OverviewLayoutPayload,
        OverviewLayoutTemplate, OverviewSectionId, OverviewWorkflowLinkMode, PayloadBase,
        ProjectDirectoryImportOptions, ProjectImportConflictStrategy, WorkflowFailureStrategy,
        WorkflowStep, WorkflowVariable,
    };

    fn app_payload(name: &str) -> ItemPayload {
        ItemPayload::App {
            base: PayloadBase {
                name: name.to_string(),
                description: "App item".into(),
                tags: vec!["tool".into()],
                icon: String::new(),
                favorite: false,
            },
            launch_target: "C:\\Windows\\System32\\notepad.exe".into(),
        }
    }

    fn script_payload(name: &str, execution_mode: CommandExecutionMode) -> ItemPayload {
        ItemPayload::Script {
            base: PayloadBase {
                name: name.to_string(),
                description: "Script item".into(),
                tags: vec!["ops".into()],
                icon: String::new(),
                favorite: false,
            },
            command: "echo hello".into(),
            execution_mode,
        }
    }

    fn workflow_payload(name: &str) -> ItemPayload {
        ItemPayload::Workflow {
            base: PayloadBase {
                name: name.into(),
                description: String::new(),
                tags: vec!["daily".into()],
                icon: String::new(),
                favorite: true,
            },
            variables: vec![],
            steps: vec![
                WorkflowStep::RunCommand {
                    id: "step-1".into(),
                    command: "npm run dev".into(),
                    execution_mode: CommandExecutionMode::NewTerminal,
                    failure_strategy: WorkflowFailureStrategy::Stop,
                    retry_count: 0,
                    retry_delay_ms: 0,
                    note: "启动服务".into(),
                    delay_ms: 400,
                    condition: None,
                },
                WorkflowStep::OpenUrl {
                    id: "step-2".into(),
                    url: "https://example.com".into(),
                    note: "打开站点".into(),
                    delay_ms: 1500,
                    condition: None,
                },
            ],
        }
    }

    fn project_payload(name: &str, project_path: &str, dev_command: &str) -> ItemPayload {
        ItemPayload::Project {
            base: PayloadBase {
                name: name.to_string(),
                description: "Project item".into(),
                tags: vec!["workspace".into()],
                icon: String::new(),
                favorite: false,
            },
            project_path: project_path.to_string(),
            dev_command: dev_command.to_string(),
        }
    }

    fn url_payload(name: &str, url: &str) -> ItemPayload {
        ItemPayload::Url {
            base: PayloadBase {
                name: name.to_string(),
                description: "URL item".into(),
                tags: vec!["docs".into()],
                icon: String::new(),
                favorite: false,
            },
            url: url.to_string(),
        }
    }

    #[test]
    fn creates_database_when_missing() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        assert!(state.get_items().expect("items").items.is_empty());
        assert!(temp_dir.path().join("data").join("deskhub.db").exists());
    }

    #[test]
    fn creates_expected_tables_for_v6() {
        let temp_dir = tempdir().expect("temp dir");
        let _state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let connection =
            Connection::open(temp_dir.path().join("data").join("deskhub.db")).expect("connection");

        let mut statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .expect("statement");
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("rows");

        let mut names = Vec::new();
        for row in rows {
            names.push(row.expect("row"));
        }

        assert!(names.contains(&"items".to_string()));
        assert!(names.contains(&"item_tags".to_string()));
        assert!(names.contains(&"workflow_steps".to_string()));
        assert!(names.contains(&"workflow_variables".to_string()));
        assert!(names.contains(&"app_settings".to_string()));
        assert!(names.contains(&"command_history".to_string()));
        assert!(names.contains(&"data_tool_history".to_string()));
    }

    #[test]
    fn migrates_v1_database_to_v5_with_blocking_defaults() {
        let temp_dir = tempdir().expect("temp dir");
        let data_dir = temp_dir.path().join("data");
        fs::create_dir_all(&data_dir).expect("data dir");
        let db_path = data_dir.join("deskhub.db");
        let connection = Connection::open(&db_path).expect("connection");

        connection
            .execute_batch(
                "
                CREATE TABLE items (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    icon TEXT NOT NULL DEFAULT '',
                    favorite INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_launched_at TEXT NULL,
                    launch_target TEXT NULL,
                    project_path TEXT NULL,
                    dev_command TEXT NULL,
                    path TEXT NULL,
                    url TEXT NULL,
                    command TEXT NULL,
                    execution_mode TEXT NULL
                );
                CREATE TABLE item_tags (
                    item_id TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    PRIMARY KEY (item_id, tag),
                    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
                );
                CREATE TABLE workflow_steps (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    path TEXT NULL,
                    url TEXT NULL,
                    command TEXT NULL,
                    execution_mode TEXT NULL,
                    FOREIGN KEY (workflow_id) REFERENCES items(id) ON DELETE CASCADE,
                    UNIQUE (workflow_id, position)
                );
                CREATE TABLE app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                PRAGMA user_version = 1;
                ",
            )
            .expect("schema");

        connection
            .execute(
                "
                INSERT INTO items (
                    id, name, type, description, icon, favorite, created_at, updated_at, command
                ) VALUES (?1, ?2, 'script', '', '', 0, ?3, ?3, ?4)
                ",
                params!["script-1", "Script", "2026-03-23T00:00:00Z", "echo hi"],
            )
            .expect("script");

        connection
            .execute(
                "
                INSERT INTO items (
                    id, name, type, description, icon, favorite, created_at, updated_at
                ) VALUES (?1, ?2, 'workflow', '', '', 0, ?3, ?3)
                ",
                params!["wf-1", "Workflow", "2026-03-23T00:00:00Z"],
            )
            .expect("workflow");

        connection
            .execute(
                "
                INSERT INTO workflow_steps (id, workflow_id, position, type, command)
                VALUES ('step-1', 'wf-1', 0, 'run_command', 'npm run dev')
                ",
                [],
            )
            .expect("step");

        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let items = state.get_items().expect("items").items;

        let script = items
            .iter()
            .find(|item| item.id() == "script-1")
            .expect("script item");

        match script {
            DeskItem::Script { execution_mode, .. } => {
                assert_eq!(*execution_mode, CommandExecutionMode::Blocking);
            }
            _ => panic!("expected script"),
        }

        let workflow = items
            .iter()
            .find(|item| item.id() == "wf-1")
            .expect("workflow item");

        match workflow {
            DeskItem::Workflow { steps, .. } => match &steps[0] {
                WorkflowStep::RunCommand {
                    execution_mode,
                    note,
                    delay_ms,
                    ..
                } => {
                    assert_eq!(*execution_mode, CommandExecutionMode::Blocking);
                    assert_eq!(note, "");
                    assert_eq!(*delay_ms, 0);
                }
                _ => panic!("expected command step"),
            },
            _ => panic!("expected workflow"),
        }
    }

    #[test]
    fn persists_crud_operations_and_execution_modes() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        let created = state
            .create_item(&script_payload("DeskHub", CommandExecutionMode::Background))
            .expect("created");
        let fetched = state.find_item(created.id()).expect("fetched");

        match fetched {
            DeskItem::Script { execution_mode, .. } => {
                assert_eq!(execution_mode, CommandExecutionMode::Background);
            }
            _ => panic!("expected script"),
        }

        thread::sleep(Duration::from_millis(5));

        let updated = state
            .update_item(created.id(), &workflow_payload("Morning flow"))
            .expect("updated");
        assert_eq!(updated.item_type(), "workflow");
        assert_ne!(updated.base().updated_at, created.base().updated_at);
        assert_eq!(updated.base().created_at, created.base().created_at);

        state.delete_item(created.id()).expect("deleted");
        assert!(state.get_items().expect("items").items.is_empty());
    }

    #[test]
    fn persists_workflow_variables_across_reads() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        let created = state
            .create_item(&ItemPayload::Workflow {
                base: PayloadBase {
                    name: "Variable flow".into(),
                    description: "带变量的工作流".into(),
                    tags: vec!["daily".into(), "param".into()],
                    icon: String::new(),
                    favorite: true,
                },
                variables: vec![WorkflowVariable {
                    id: "var-1".into(),
                    key: "projectPath".into(),
                    label: "项目目录".into(),
                    default_value: r"C:\dev\DeskHub".into(),
                    required: true,
                }],
                steps: vec![WorkflowStep::RunCommand {
                    id: "step-1".into(),
                    command: "code {{projectPath}}".into(),
                    execution_mode: CommandExecutionMode::NewTerminal,
                    failure_strategy: WorkflowFailureStrategy::Stop,
                    note: "打开项目".into(),
                    delay_ms: 0,
                    retry_count: 0,
                    retry_delay_ms: 0,
                    condition: None,
                }],
            })
            .expect("created");

        let fetched = state.find_item(created.id()).expect("fetched");

        match fetched {
            DeskItem::Workflow {
                variables, steps, ..
            } => {
                assert_eq!(variables.len(), 1);
                assert_eq!(variables[0].key, "projectPath");
                assert_eq!(variables[0].label, "项目目录");
                assert_eq!(variables[0].default_value, r"C:\dev\DeskHub");
                assert!(variables[0].required);

                match &steps[0] {
                    WorkflowStep::RunCommand {
                        command,
                        execution_mode,
                        failure_strategy,
                        note,
                        ..
                    } => {
                        assert_eq!(command, "code {{projectPath}}");
                        assert_eq!(*execution_mode, CommandExecutionMode::NewTerminal);
                        assert_eq!(*failure_strategy, WorkflowFailureStrategy::Stop);
                        assert_eq!(note, "打开项目");
                    }
                    _ => panic!("expected run_command"),
                }
            }
            _ => panic!("expected workflow"),
        }
    }

    #[test]
    fn marks_items_as_launched_and_clears_recent_history() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let created = state.create_item(&app_payload("DeskHub")).expect("created");

        thread::sleep(Duration::from_millis(5));
        let launched = state.mark_item_launched(created.id()).expect("launched");
        assert!(launched.base().last_launched_at.is_some());

        let cleared = state.clear_recent_items().expect("cleared");
        assert_eq!(cleared, 1);
        let cleared_item = state.find_item(created.id()).expect("item");
        assert_eq!(cleared_item.base().last_launched_at, None);
    }

    #[test]
    fn persists_default_workflow_setting_and_clears_on_delete() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let workflow = state
            .create_item(&workflow_payload("Morning flow"))
            .expect("workflow");

        let settings = state
            .set_default_workflow(Some(workflow.id()))
            .expect("settings");
        assert_eq!(settings.default_workflow_id.as_deref(), Some(workflow.id()));

        state.delete_item(workflow.id()).expect("deleted");
        assert_eq!(
            state
                .get_ui_settings()
                .expect("settings")
                .default_workflow_id,
            None
        );
    }

    #[test]
    fn rejects_non_workflow_default_item() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let app = state.create_item(&app_payload("DeskHub")).expect("app");

        let error = state
            .set_default_workflow(Some(app.id()))
            .expect_err("should reject");
        assert!(
            error
                .to_string()
                .contains("Only workflow items can be set as the default workflow.")
        );
    }

    #[test]
    fn ui_settings_include_default_overview_layout() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        let settings = state.get_ui_settings().expect("settings");

        assert_eq!(
            settings.overview_section_order,
            vec![
                OverviewSectionId::Recent,
                OverviewSectionId::Favorites,
                OverviewSectionId::Workflows,
                OverviewSectionId::Library,
            ]
        );
        assert!(settings.overview_hidden_sections.is_empty());
        assert!(settings.overview_layout_templates.is_empty());
        assert_eq!(
            settings.overview_workflow_link_mode,
            OverviewWorkflowLinkMode::None
        );
    }

    #[test]
    fn updates_and_normalizes_overview_layout_settings() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        let settings = state
            .update_overview_layout(&OverviewLayoutPayload {
                section_order: vec![OverviewSectionId::Library, OverviewSectionId::Recent],
                hidden_sections: vec![
                    OverviewSectionId::Workflows,
                    OverviewSectionId::Workflows,
                    OverviewSectionId::Favorites,
                ],
                layout_templates: Some(vec![
                    OverviewLayoutTemplate {
                        id: "focus-layout".into(),
                        name: "  开工布局  ".into(),
                        section_order: vec![
                            OverviewSectionId::Workflows,
                            OverviewSectionId::Recent,
                            OverviewSectionId::Favorites,
                        ],
                        hidden_sections: vec![OverviewSectionId::Library],
                    },
                ]),
                workflow_link_mode: Some(OverviewWorkflowLinkMode::PrioritizeWorkflows),
            })
            .expect("settings");

        assert_eq!(
            settings.overview_section_order,
            vec![
                OverviewSectionId::Library,
                OverviewSectionId::Recent,
                OverviewSectionId::Favorites,
                OverviewSectionId::Workflows,
            ]
        );
        assert_eq!(
            settings.overview_hidden_sections,
            vec![OverviewSectionId::Favorites, OverviewSectionId::Workflows]
        );
        assert_eq!(settings.overview_layout_templates.len(), 1);
        assert_eq!(settings.overview_layout_templates[0].id, "focus-layout");
        assert_eq!(settings.overview_layout_templates[0].name, "开工布局");
        assert_eq!(
            settings.overview_layout_templates[0].section_order,
            vec![
                OverviewSectionId::Workflows,
                OverviewSectionId::Recent,
                OverviewSectionId::Favorites,
                OverviewSectionId::Library,
            ]
        );
        assert_eq!(
            settings.overview_layout_templates[0].hidden_sections,
            vec![OverviewSectionId::Library]
        );
        assert_eq!(
            settings.overview_workflow_link_mode,
            OverviewWorkflowLinkMode::PrioritizeWorkflows
        );

        let persisted = state.get_ui_settings().expect("persisted settings");
        assert_eq!(
            persisted.overview_section_order,
            settings.overview_section_order
        );
        assert_eq!(
            persisted.overview_hidden_sections,
            settings.overview_hidden_sections
        );
        assert_eq!(
            persisted.overview_layout_templates,
            settings.overview_layout_templates
        );
        assert_eq!(
            persisted.overview_workflow_link_mode,
            settings.overview_workflow_link_mode
        );
    }

    #[test]
    fn command_history_upserts_usage_counts() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        state
            .record_command_history(&CommandHistoryPayload {
                kind: CommandHistoryKind::Item,
                target: "item-1".into(),
                title: "DeskHub".into(),
            })
            .expect("history");

        thread::sleep(Duration::from_millis(5));

        let entry = state
            .record_command_history(&CommandHistoryPayload {
                kind: CommandHistoryKind::Item,
                target: "item-1".into(),
                title: "DeskHub".into(),
            })
            .expect("history");

        assert_eq!(entry.use_count, 2);
        assert_eq!(
            state.get_command_history().expect("history").entries[0].target,
            "item-1"
        );
    }

    #[test]
    fn data_tool_history_persists_across_reads() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        let entry = state
            .record_data_tool_history(&DataToolHistoryPayload {
                action: DataToolAction::HealthCheck,
                status: DataToolOperationStatus::Success,
                title: "数据库健康检查".into(),
                summary: "Schema v5 检查完成".into(),
                source_path: Some("C:\\DeskHub\\data\\deskhub.db".into()),
                output_path: None,
                backup_path: None,
                item_names: Vec::new(),
                errors: Vec::new(),
                extra: Default::default(),
            })
            .expect("history");

        let history = state.get_data_tool_history().expect("history");
        assert_eq!(history.records.len(), 1);
        assert_eq!(history.records[0].id, entry.id);
        assert_eq!(history.records[0].action, DataToolAction::HealthCheck);

        let cleared = state.clear_data_tool_history().expect("clear");
        assert_eq!(cleared, 1);
        assert!(
            state
                .get_data_tool_history()
                .expect("history")
                .records
                .is_empty()
        );
    }

    #[test]
    fn health_report_and_backup_include_metadata() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        state.create_item(&app_payload("DeskHub")).expect("item");
        state
            .create_item(&workflow_payload("Morning flow"))
            .expect("workflow");

        let report = state.get_database_health_report().expect("report");
        assert_eq!(report.schema_version, 6);
        assert_eq!(report.quick_check.to_lowercase(), "ok");
        assert_eq!(report.table_counts.get("items"), Some(&2));

        let backup_path = temp_dir.path().join("backup").join("deskhub.db");
        let backup = state.backup_database(&backup_path).expect("backup");
        assert!(backup.sha256.is_some());
        assert_eq!(backup.item_count, Some(2));
        assert_eq!(backup.workflow_count, Some(1));
        assert!(
            backup
                .backups_directory
                .as_deref()
                .is_some_and(|path| path.ends_with("\\data\\backups"))
        );
    }

    #[test]
    fn batch_favorite_delete_and_export_work() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let first = state.create_item(&app_payload("One")).expect("first");
        let second = state.create_item(&app_payload("Two")).expect("second");

        let updated = state
            .set_items_favorite(&[first.id().into(), second.id().into()], true)
            .expect("favorite");
        assert!(updated.iter().all(|item| item.base().favorite));

        let export_path = temp_dir.path().join("export").join("items.json");
        let exported = state
            .export_items(&export_path, &[first.id().into(), second.id().into()])
            .expect("export");
        assert_eq!(exported, 2);
        assert!(export_path.exists());

        let deleted = state
            .delete_items(&[first.id().into(), second.id().into()])
            .expect("delete");
        assert_eq!(deleted.len(), 2);
    }

    #[test]
    fn batch_edit_updates_description_tags_and_icon() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let first = state.create_item(&app_payload("One")).expect("first");
        let second = state
            .create_item(&workflow_payload("Morning flow"))
            .expect("second");

        let updated = state
            .batch_edit_items(&BatchEditItemsPayload {
                ids: vec![first.id().into(), second.id().into()],
                description: Some("统一说明".into()),
                icon: Some("rocket".into()),
                tags: Some(vec!["shared".into(), "daily".into()]),
                tag_mode: BatchTagMode::Append,
            })
            .expect("batch edit");

        assert_eq!(updated.len(), 2);
        assert!(
            updated
                .iter()
                .all(|item| item.base().description == "统一说明")
        );
        assert!(updated.iter().all(|item| item.base().icon == "rocket"));
        assert!(
            updated
                .iter()
                .all(|item| item.base().tags.iter().any(|tag| tag == "shared"))
        );
    }

    #[test]
    fn import_items_generates_new_ids_and_keeps_existing_data() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let existing = state
            .create_item(&app_payload("Existing"))
            .expect("existing");

        let export_path = temp_dir.path().join("import-items.json");
        fs::write(
            &export_path,
            serde_json::json!({
                "version": 1,
                "exportedAt": "2026-03-23T00:00:00Z",
                "items": [
                    {
                        "id": "legacy-script",
                        "name": "Legacy Script",
                        "type": "script",
                        "description": "",
                        "tags": ["ops"],
                        "icon": "",
                        "favorite": true,
                        "createdAt": "2026-03-22T00:00:00Z",
                        "updatedAt": "2026-03-22T00:00:00Z",
                        "lastLaunchedAt": "2026-03-22T01:00:00Z",
                        "command": "echo hi",
                        "executionMode": "background"
                    },
                    {
                        "id": "bad-url",
                        "name": "Broken",
                        "type": "url",
                        "description": "",
                        "tags": [],
                        "icon": "",
                        "favorite": false,
                        "createdAt": "2026-03-22T00:00:00Z",
                        "updatedAt": "2026-03-22T00:00:00Z",
                        "lastLaunchedAt": null,
                        "url": "not-a-url"
                    }
                ]
            })
            .to_string(),
        )
        .expect("write");

        let result = state.import_items(&export_path).expect("import");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.errors.len(), 1);
        assert_ne!(result.items[0].id(), "legacy-script");
        assert_eq!(result.items[0].base().last_launched_at, None);

        let items = state.get_items().expect("items").items;
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item.id() == existing.id()));
    }

    #[test]
    fn preview_import_items_reports_valid_and_invalid_entries_without_writing() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let import_path = temp_dir.path().join("preview-items.json");

        fs::write(
            &import_path,
            serde_json::json!({
                "version": 1,
                "exportedAt": "2026-03-23T00:00:00Z",
                "items": [
                    {
                        "id": "legacy-app",
                        "name": "Legacy App",
                        "type": "app",
                        "description": "",
                        "tags": ["tool"],
                        "icon": "",
                        "favorite": false,
                        "createdAt": "2026-03-22T00:00:00Z",
                        "updatedAt": "2026-03-22T00:00:00Z",
                        "lastLaunchedAt": null,
                        "launchTarget": "C:\\\\Windows\\\\System32\\\\notepad.exe"
                    },
                    {
                        "id": "bad-url",
                        "name": "Broken",
                        "type": "url",
                        "description": "",
                        "tags": [],
                        "icon": "",
                        "favorite": false,
                        "createdAt": "2026-03-22T00:00:00Z",
                        "updatedAt": "2026-03-22T00:00:00Z",
                        "lastLaunchedAt": null,
                        "url": "not-a-url"
                    }
                ]
            })
            .to_string(),
        )
        .expect("write");

        let preview = state.preview_import_items(&import_path).expect("preview");
        assert_eq!(preview.valid_count, 1);
        assert_eq!(preview.invalid_count, 1);
        assert_eq!(preview.items.len(), 2);
        assert_eq!(state.get_items().expect("items").items.len(), 0);
    }

    #[test]
    fn scan_project_directories_marks_existing_projects() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let workspace = temp_dir.path().join("workspace");
        fs::create_dir_all(&workspace).expect("workspace");
        fs::write(
            workspace.join("package.json"),
            r#"{"name":"deskhub-web","scripts":{"dev":"vite"}}"#,
        )
        .expect("package");

        let api_dir = workspace.join("api");
        fs::create_dir_all(&api_dir).expect("api");
        fs::write(
            api_dir.join("Cargo.toml"),
            "[package]\nname = \"deskhub-api\"\nversion = \"0.1.0\"\n",
        )
        .expect("cargo");

        let existing = state
            .create_item(&project_payload(
                "Existing Web",
                &workspace.display().to_string(),
                "pnpm dev",
            ))
            .expect("existing");

        let scan = state.scan_project_directories(&workspace, None).expect("scan");

        assert_eq!(scan.scanned_directory_count, 2);
        assert_eq!(scan.scan_depth, 1);
        assert_eq!(scan.skipped_directory_count, 0);
        assert_eq!(scan.importable_count, 1);
        assert_eq!(scan.existing_count, 1);
        assert!(
            scan.candidates
                .iter()
                .any(|candidate| candidate.existing_item_id.as_deref() == Some(existing.id()))
        );
        assert!(
            scan.candidates
                .iter()
                .any(|candidate| candidate.suggested_name == "deskhub-api")
        );
    }

    #[test]
    fn browser_bookmark_scan_marks_existing_urls() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let existing = state
            .create_item(&url_payload("DeskHub Docs", "https://example.com/docs"))
            .expect("existing");
        let connection =
            Connection::open(temp_dir.path().join("data").join("deskhub.db")).expect("connection");
        super::configure_connection(&connection).expect("configure");

        let scan = super::annotate_browser_bookmark_scan(
            &connection,
            BrowserBookmarkScanResponse {
                source_count: 1,
                candidate_count: 2,
                importable_count: 0,
                existing_count: 0,
                sources: vec![],
                candidates: vec![
                    BrowserBookmarkCandidate {
                        id: "bookmark-1".into(),
                        browser: "Chrome".into(),
                        profile_name: "Default".into(),
                        source_path: "C:\\Bookmarks".into(),
                        name: "DeskHub Docs".into(),
                        url: "https://example.com/docs".into(),
                        folder_path: "书签栏 / 开发".into(),
                        existing_item_id: None,
                        existing_item_name: None,
                    },
                    BrowserBookmarkCandidate {
                        id: "bookmark-2".into(),
                        browser: "Edge".into(),
                        profile_name: "Profile 1".into(),
                        source_path: "C:\\Bookmarks".into(),
                        name: "DeskHub Repo".into(),
                        url: "https://github.com/example/deskhub".into(),
                        folder_path: "其他收藏夹".into(),
                        existing_item_id: None,
                        existing_item_name: None,
                    },
                ],
            },
        )
        .expect("scan");

        assert_eq!(scan.importable_count, 1);
        assert_eq!(scan.existing_count, 1);
        assert!(
            scan.candidates.iter().any(|candidate| {
                candidate.existing_item_id.as_deref() == Some(existing.id())
                    && candidate.existing_item_name.as_deref() == Some("DeskHub Docs")
            })
        );
    }

    #[test]
    fn import_project_directories_creates_items_and_skips_duplicates() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let workspace = temp_dir.path().join("workspace");
        fs::create_dir_all(&workspace).expect("workspace");

        let api_dir = workspace.join("api");
        fs::create_dir_all(&api_dir).expect("api");
        fs::write(
            api_dir.join("Cargo.toml"),
            "[package]\nname = \"deskhub-api\"\nversion = \"0.1.0\"\n",
        )
        .expect("cargo");

        let web_dir = workspace.join("web");
        fs::create_dir_all(&web_dir).expect("web");
        fs::write(
            web_dir.join("package.json"),
            r#"{"name":"deskhub-web","scripts":{"dev":"vite"}}"#,
        )
        .expect("package");
        fs::write(web_dir.join("pnpm-lock.yaml"), "lockfileVersion: 9.0").expect("lock");

        state
            .create_item(&project_payload(
                "Existing API",
                &api_dir.display().to_string(),
                "cargo run",
            ))
            .expect("existing");

        let result = state
            .import_project_directories(&[
                api_dir.display().to_string(),
                web_dir.display().to_string(),
            ], None)
            .expect("import");

        assert_eq!(result.items.len(), 1);
        assert!(result.updated_paths.is_empty());
        assert_eq!(result.items[0].name(), "deskhub-web");
        assert_eq!(result.skipped_paths, vec![api_dir.display().to_string()]);
        assert!(result.errors.is_empty());

        let items = state.get_items().expect("items").items;
        assert_eq!(items.len(), 2);
        let imported = items
            .iter()
            .find(|item| item.name() == "deskhub-web")
            .expect("imported project");
        assert!(imported.base().tags.iter().any(|tag| tag == "node"));
        assert!(imported.base().tags.iter().any(|tag| tag == "workspace"));
    }

    #[test]
    fn import_project_directories_can_refresh_existing_projects() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let workspace = temp_dir.path().join("workspace");
        fs::create_dir_all(&workspace).expect("workspace");

        let docs_dir = workspace.join("docs");
        fs::create_dir_all(&docs_dir).expect("docs");
        fs::write(
            docs_dir.join("package.json"),
            r#"{"name":"deskhub-docs","scripts":{"dev":"vite"}}"#,
        )
        .expect("package");

        let existing = state
            .create_item(&ItemPayload::Project {
                base: PayloadBase {
                    name: "Legacy Docs".into(),
                    description: "Old description".into(),
                    tags: vec!["manual".into()],
                    icon: "book".into(),
                    favorite: true,
                },
                project_path: docs_dir.display().to_string(),
                dev_command: "npm run dev".into(),
            })
            .expect("existing");

        let response = state
            .import_project_directories(
                &[docs_dir.display().to_string()],
                Some(&ProjectDirectoryImportOptions {
                    conflict_strategy: ProjectImportConflictStrategy::RefreshExisting,
                }),
            )
            .expect("refresh");

        assert_eq!(response.items.len(), 1);
        assert_eq!(response.updated_paths, vec![docs_dir.display().to_string()]);
        assert!(response.skipped_paths.is_empty());
        assert!(response.errors.is_empty());

        let refreshed = state.find_item(existing.id()).expect("refreshed");
        assert_eq!(refreshed.name(), "deskhub-docs");
        assert!(refreshed.base().favorite);
        assert_eq!(refreshed.base().icon, "book");
        assert!(refreshed.base().tags.iter().any(|tag| tag == "manual"));
        assert!(refreshed.base().tags.iter().any(|tag| tag == "node"));
    }

    #[test]
    fn import_browser_bookmarks_creates_url_items_and_skips_duplicates() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        state
            .create_item(&url_payload("Existing Docs", "https://example.com/docs"))
            .expect("existing");

        let response = state
            .import_browser_bookmarks(&[
                BrowserBookmarkImportEntry {
                    browser: "Chrome".into(),
                    profile_name: "Default".into(),
                    source_path: r"C:\Chrome\Bookmarks".into(),
                    name: "DeskHub Docs".into(),
                    url: "https://example.com/docs".into(),
                    folder_path: "书签栏 / 开发".into(),
                },
                BrowserBookmarkImportEntry {
                    browser: "Edge".into(),
                    profile_name: "Profile 1".into(),
                    source_path: r"C:\Edge\Bookmarks".into(),
                    name: "DeskHub Repo".into(),
                    url: "https://github.com/example/deskhub".into(),
                    folder_path: "其他收藏夹 / 团队".into(),
                },
            ])
            .expect("import");

        assert_eq!(response.items.len(), 1);
        assert_eq!(response.skipped_urls, vec!["https://example.com/docs".to_string()]);
        assert!(response.errors.is_empty());
        assert_eq!(response.items[0].item_type(), "url");
        assert_eq!(response.items[0].name(), "DeskHub Repo");
        assert!(
            response.items[0]
                .base()
                .tags
                .iter()
                .any(|tag| tag == "bookmark")
        );
        assert!(
            response.items[0]
                .base()
                .tags
                .iter()
                .any(|tag| tag == "edge")
        );

        let items = state.get_items().expect("items").items;
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn clear_command_history_removes_entries() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");

        state
            .record_command_history(&CommandHistoryPayload {
                kind: CommandHistoryKind::Item,
                target: "item-1".into(),
                title: "DeskHub".into(),
            })
            .expect("history");

        let cleared = state.clear_command_history().expect("clear");
        assert_eq!(cleared, 1);
        assert!(
            state
                .get_command_history()
                .expect("history")
                .entries
                .is_empty()
        );
    }

    #[test]
    fn consistency_check_reports_invalid_default_workflow_reference() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let db_path = temp_dir.path().join("data").join("deskhub.db");
        let connection = Connection::open(&db_path).expect("connection");

        connection
            .execute(
                "INSERT INTO app_settings (key, value) VALUES (?1, ?2)",
                params![super::DEFAULT_WORKFLOW_KEY, "missing-workflow"],
            )
            .expect("setting");

        let report = state.run_data_consistency_check().expect("report");
        assert!(!report.ok);
        assert!(
            report
                .issues
                .iter()
                .any(|issue| issue.code == "default_workflow_missing")
        );
    }

    #[test]
    fn optimize_database_and_export_text_report_work() {
        let temp_dir = tempdir().expect("temp dir");
        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        state.create_item(&app_payload("DeskHub")).expect("item");

        let maintenance = state.optimize_database().expect("maintenance");
        assert_eq!(maintenance.quick_check.to_lowercase(), "ok");
        assert!(maintenance.page_count_after >= 0);

        let report_path = temp_dir.path().join("reports").join("issues.txt");
        let exported = state
            .export_text_report(
                &report_path,
                "DeskHub 错误列表",
                &["第一条".into(), "第二条".into()],
            )
            .expect("report");
        assert_eq!(exported.line_count, 2);
        assert!(report_path.exists());
    }

    #[test]
    fn backup_and_restore_database_work_without_importing_legacy_json() {
        let temp_dir = tempdir().expect("temp dir");
        let data_dir = temp_dir.path().join("data");
        fs::create_dir_all(&data_dir).expect("data dir");
        fs::write(data_dir.join("items.json"), "{ \"items\": [] }").expect("legacy file");

        let state = StorageState::new(temp_dir.path().to_path_buf()).expect("state");
        let original = state
            .create_item(&app_payload("Original"))
            .expect("original");

        let backup_path = temp_dir.path().join("backup.db");
        state.backup_database(&backup_path).expect("backup");
        assert!(backup_path.exists());

        state.delete_item(original.id()).expect("delete");
        assert!(state.get_items().expect("items").items.is_empty());

        let restore_result = state.restore_database(&backup_path).expect("restore");
        let safety_backup_path = restore_result
            .backup_path
            .expect("restore should create a safety backup");
        assert!(Path::new(&safety_backup_path).exists());
        let items = state.get_items().expect("items").items;
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name(), "Original");
        assert!(data_dir.join("items.json").exists());
    }

    #[test]
    fn creates_recovery_copy_when_database_is_corrupt() {
        let temp_dir = tempdir().expect("temp dir");
        let data_dir = temp_dir.path().join("data");
        fs::create_dir_all(&data_dir).expect("data dir");
        let db_path = data_dir.join("deskhub.db");
        let corrupt_bytes = b"not-a-valid-sqlite-database";
        fs::write(&db_path, corrupt_bytes).expect("corrupt db");

        let error = match StorageState::new(temp_dir.path().to_path_buf()) {
            Ok(_) => panic!("should fail"),
            Err(error) => error,
        };
        let error_message = error.to_string();

        assert!(error_message.contains("failed its health check"));
        assert!(error_message.contains("recovery copy was saved"));

        let recovery_dir = data_dir.join("recovery");
        let mut recovery_entries = fs::read_dir(&recovery_dir)
            .expect("recovery dir")
            .map(|entry| entry.expect("entry").path())
            .collect::<Vec<_>>();
        recovery_entries.sort();

        assert_eq!(recovery_entries.len(), 1);
        assert_eq!(
            fs::read(&recovery_entries[0]).expect("recovery bytes"),
            corrupt_bytes
        );
    }
}
