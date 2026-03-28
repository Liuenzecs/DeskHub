#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod bookmark_importer;
mod commands;
mod launcher;
mod migrations;
mod models;
mod platform_launcher;
mod project_inspector;
mod storage;

use std::{error::Error, io};

use storage::StorageState;
use tauri::Manager;

fn boxed_error(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(io::Error::other(message.into()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| boxed_error(error.to_string()))?;
            let storage =
                StorageState::new(app_data_dir).map_err(|error| boxed_error(error.to_string()))?;
            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_items,
            commands::get_command_history,
            commands::get_data_tool_history,
            commands::record_command_history,
            commands::record_data_tool_history,
            commands::clear_data_tool_history,
            commands::clear_command_history,
            commands::get_ui_settings,
            commands::update_ui_settings,
            commands::update_overview_layout,
            commands::inspect_project_directory,
            commands::scan_browser_bookmarks,
            commands::import_browser_bookmarks,
            commands::scan_project_directories,
            commands::import_project_directories,
            commands::create_item,
            commands::update_item,
            commands::delete_item,
            commands::delete_items,
            commands::toggle_favorite,
            commands::set_items_favorite,
            commands::batch_edit_items,
            commands::launch_item,
            commands::launch_workflow,
            commands::clear_recent_items,
            commands::set_default_workflow,
            commands::export_items,
            commands::import_items,
            commands::preview_import_items,
            commands::backup_database,
            commands::restore_database,
            commands::run_database_health_check,
            commands::run_data_consistency_check,
            commands::optimize_database,
            commands::open_backups_directory,
            commands::export_text_report,
            commands::export_structured_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running DeskHub");
}
