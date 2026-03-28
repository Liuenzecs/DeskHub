# Changelog

All notable changes to DeskHub will be documented in this file.

The format follows a simplified Keep a Changelog style, and versions are intended to align with:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## [Unreleased]

### Added

### Changed

### Fixed

## [0.2.1] - 2026-03-28

### Added

- Windows release build now generates an NSIS installer bundle, so tagged releases can include a `setup.exe` installer.

### Changed

- Tauri bundler is now explicitly enabled in `tauri.conf.json` for Windows packaging.

### Fixed

- Resolved the release packaging gap where `tauri build` only produced `deskhub.exe` but no installer artifact.

## [0.2.0] - 2026-03-28

### Added

- Workflow `run_command` steps now support `stop / continue / retry` failure strategies.
- Workflow steps now support condition-based execution and jump targets.
- Workflow execution summary now displays per-step results, retry attempts, warnings, skipped steps, and jump behavior.
- Data Tools now includes a settings center for automatic backup, retention count, and diagnostic mode.
- Data Tools can export a structured JSON report containing settings and the latest operation snapshot.
- Release engineering docs now include versioning guidance, release checklist, and a dedicated GitHub Actions release workflow.
- Rust migrations are now split into a dedicated `src-tauri/src/migrations.rs` module instead of staying embedded in `storage.rs`.
- Release docs now include reusable release asset templates and a packaging strategy evaluation baseline.
- Release assets now include a browser-rendered first draft screenshot set, release notes draft, and upgrade notes draft.

### Changed

- Database restore history now persists restore diff statistics, including before/after item counts and added/removed/updated totals.
- Diagnostic mode now disables restore, import, optimize, and command/data-tool history cleanup actions from the UI.
- Windows restore flow now correctly releases SQLite file handles before replacing the database file.
- Search transliteration runtime now only eagerly loads for latin queries, and command-palette idle warmup only uses the recent history slice needed by quick view.

### Fixed

- Recovered `WorkflowExecutionSummaryDialog.tsx` after an interrupted refactor and restored the frontend build.
- Removed unreachable workflow launch message code in `src-tauri/src/commands.rs`.
- Fixed the Windows restore regression that caused `os error 32` during Rust tests.

## [0.1.0] - 2026-03-26

### Added

- Initial DeskHub V2.1 desktop control-center foundation.
- SQLite-backed local storage for apps, projects, websites, folders, scripts, and workflows.
- Command palette with Chinese, pinyin, and initials search.
- Batch management, workflow templates, and data tools.
