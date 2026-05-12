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
use tauri::{
    Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn boxed_error(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(io::Error::other(message.into()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| boxed_error(error.to_string()))?;
            let storage =
                StorageState::new(app_data_dir).map_err(|error| boxed_error(error.to_string()))?;
            app.manage(storage);

            // Build tray menu
            let show_hide = MenuItemBuilder::with_id("show_hide", "Show/Hide DeskHub")
                .build(app)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit DeskHub").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .item(&separator)
                .item(&quit)
                .build()?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("DeskHub")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Global shortcut: Alt+Shift+Space to toggle window
            let shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::Space);
            app.global_shortcut().register(shortcut)?;

            // Minimize to tray on close
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

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
            commands::set_theme,
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
            commands::export_structured_report,
            commands::get_notes,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::get_spaces,
            commands::create_space,
            commands::update_space,
            commands::delete_space,
            commands::assign_items_to_spaces,
            commands::remove_items_from_space,
            commands::get_item_space_ids
        ])
        .run(tauri::generate_context!())
        .expect("error while running DeskHub");
}
