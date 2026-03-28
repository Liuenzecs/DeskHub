use std::{
    collections::{HashSet, VecDeque},
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, anyhow};
use serde_json::Value as JsonValue;
use toml::Value as TomlValue;

use crate::models::{
    ProjectDirectoryScanOptions, ProjectDirectoryScanResponse, ProjectImportCandidate,
    ProjectInspectionResult,
};

const PACKAGE_JSON: &str = "package.json";
const CARGO_TOML: &str = "Cargo.toml";
const PYPROJECT_TOML: &str = "pyproject.toml";
const GO_MOD: &str = "go.mod";
const COMPOSER_JSON: &str = "composer.json";
const GEMFILE: &str = "Gemfile";
const PNPM_LOCK: &str = "pnpm-lock.yaml";
const YARN_LOCK: &str = "yarn.lock";
const GIT_DIR: &str = ".git";
const MAX_PROJECT_SCAN_DEPTH: usize = 4;
const DEFAULT_PROJECT_IMPORT_EXCLUDE_PATTERNS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ".venv",
    "venv",
];

pub fn inspect_project_directory(path: &Path) -> Result<ProjectInspectionResult> {
    if !path.exists() {
        return Err(anyhow!("Project path does not exist: {}", path.display()));
    }

    if !path.is_dir() {
        return Err(anyhow!(
            "Project path is not a directory: {}",
            path.display()
        ));
    }

    let mut detected_files = Vec::new();
    let mut suggested_name = None;
    let mut command_suggestions = Vec::new();

    let package_json_path = path.join(PACKAGE_JSON);
    if package_json_path.is_file() {
        detected_files.push(PACKAGE_JSON.to_string());
        let package_json = fs::read_to_string(&package_json_path)
            .with_context(|| format!("Failed to read {}.", package_json_path.display()))?;
        if let Ok(value) = serde_json::from_str::<JsonValue>(&package_json) {
            if suggested_name.is_none() {
                suggested_name = value
                    .get("name")
                    .and_then(JsonValue::as_str)
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
            }

            command_suggestions.extend(detect_package_json_commands(path, &value));
        }
    }

    let cargo_toml_path = path.join(CARGO_TOML);
    if cargo_toml_path.is_file() {
        detected_files.push(CARGO_TOML.to_string());
        let cargo_toml = fs::read_to_string(&cargo_toml_path)
            .with_context(|| format!("Failed to read {}.", cargo_toml_path.display()))?;
        if let Ok(value) = cargo_toml.parse::<TomlValue>() {
            if suggested_name.is_none() {
                suggested_name = value
                    .get("package")
                    .and_then(|package| package.get("name"))
                    .and_then(TomlValue::as_str)
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
            }
        }

        if suggested_name.is_none() {
            suggested_name = detect_cargo_package_name(&cargo_toml);
        }

        push_unique_string(&mut command_suggestions, "cargo run".to_string());
    }

    let pyproject_toml_path = path.join(PYPROJECT_TOML);
    if pyproject_toml_path.is_file() {
        detected_files.push(PYPROJECT_TOML.to_string());
        let pyproject_toml = fs::read_to_string(&pyproject_toml_path)
            .with_context(|| format!("Failed to read {}.", pyproject_toml_path.display()))?;
        if let Ok(value) = pyproject_toml.parse::<TomlValue>() {
            if suggested_name.is_none() {
                suggested_name = detect_pyproject_name(&value);
            }
        }
    }

    let go_mod_path = path.join(GO_MOD);
    if go_mod_path.is_file() {
        detected_files.push(GO_MOD.to_string());
        let go_mod = fs::read_to_string(&go_mod_path)
            .with_context(|| format!("Failed to read {}.", go_mod_path.display()))?;
        if suggested_name.is_none() {
            suggested_name = detect_go_module_name(&go_mod);
        }
        push_unique_string(&mut command_suggestions, "go run .".to_string());
    }

    if path.join(COMPOSER_JSON).is_file() {
        detected_files.push(COMPOSER_JSON.to_string());
    }

    if path.join(GEMFILE).is_file() {
        detected_files.push(GEMFILE.to_string());
    }

    if path.join(PNPM_LOCK).is_file() {
        detected_files.push(PNPM_LOCK.to_string());
    }

    if path.join(YARN_LOCK).is_file() {
        detected_files.push(YARN_LOCK.to_string());
    }

    if path.join(GIT_DIR).is_dir() {
        detected_files.push(GIT_DIR.to_string());
    }

    detected_files.sort();
    detected_files.dedup();

    if suggested_name.is_none() {
        suggested_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
    }

    let suggested_command = command_suggestions.first().cloned();

    Ok(ProjectInspectionResult {
        suggested_name,
        suggested_command,
        command_suggestions,
        detected_files,
    })
}

pub fn scan_project_directories(
    root: &Path,
    options: Option<&ProjectDirectoryScanOptions>,
) -> Result<ProjectDirectoryScanResponse> {
    if !root.exists() {
        return Err(anyhow!("Workspace path does not exist: {}", root.display()));
    }

    if !root.is_dir() {
        return Err(anyhow!(
            "Workspace path is not a directory: {}",
            root.display()
        ));
    }

    let options = normalize_scan_options(options);
    let mut seen_paths = HashSet::new();
    let mut candidates = Vec::new();
    let mut scanned_directory_count = 0usize;
    let mut skipped_directory_count = 0usize;
    let mut queue = VecDeque::from([(root.to_path_buf(), 0usize)]);

    while let Some((candidate_path, depth)) = queue.pop_front() {
        let normalized_path = candidate_path
            .canonicalize()
            .unwrap_or_else(|_| candidate_path.clone());

        if !seen_paths.insert(normalized_path) {
            continue;
        }

        scanned_directory_count += 1;
        if !looks_like_project_directory(&candidate_path) {
            if depth < options.scan_depth {
                for child_directory in collect_child_directories(
                    root,
                    &candidate_path,
                    &options.exclude_patterns,
                    &mut skipped_directory_count,
                )? {
                    queue.push_back((child_directory, depth + 1));
                }
            }
        } else {
            let inspection = inspect_project_directory(&candidate_path)?;
            let suggested_name = inspection.suggested_name.clone().unwrap_or_else(|| {
                candidate_path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("Untitled project")
                    .trim()
                    .to_string()
            });

            candidates.push(ProjectImportCandidate {
                path: candidate_path.display().to_string(),
                relative_path: relative_project_path(root, &candidate_path),
                depth,
                suggested_name,
                suggested_command: inspection.suggested_command,
                detected_files: inspection.detected_files,
                existing_item_id: None,
                existing_item_name: None,
            });

            if depth < options.scan_depth {
                for child_directory in collect_child_directories(
                    root,
                    &candidate_path,
                    &options.exclude_patterns,
                    &mut skipped_directory_count,
                )? {
                    queue.push_back((child_directory, depth + 1));
                }
            }
        }
    }

    candidates.sort_by(|left, right| {
        left.depth
            .cmp(&right.depth)
            .then_with(|| left.relative_path.cmp(&right.relative_path))
            .then_with(|| left.path.cmp(&right.path))
    });

    Ok(ProjectDirectoryScanResponse {
        root_path: root.display().to_string(),
        scan_depth: options.scan_depth,
        scanned_directory_count,
        skipped_directory_count,
        importable_count: 0,
        existing_count: 0,
        exclude_patterns: options.exclude_patterns,
        candidates,
    })
}

fn normalize_scan_options(options: Option<&ProjectDirectoryScanOptions>) -> ProjectDirectoryScanOptions {
    let mut exclude_patterns = DEFAULT_PROJECT_IMPORT_EXCLUDE_PATTERNS
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();

    if let Some(options) = options {
        for pattern in &options.exclude_patterns {
            push_unique_string(&mut exclude_patterns, pattern.trim().to_string());
        }
    }

    ProjectDirectoryScanOptions {
        scan_depth: options
            .map(|options| options.scan_depth)
            .unwrap_or(1)
            .clamp(1, MAX_PROJECT_SCAN_DEPTH),
        exclude_patterns: exclude_patterns
            .into_iter()
            .map(|pattern| pattern.trim().replace('\\', "/"))
            .filter(|pattern| !pattern.is_empty())
            .collect(),
    }
}

fn collect_child_directories(
    root: &Path,
    current: &Path,
    exclude_patterns: &[String],
    skipped_directory_count: &mut usize,
) -> Result<Vec<PathBuf>> {
    let mut directories = Vec::new();
    for entry in fs::read_dir(current)
        .with_context(|| format!("Failed to read workspace directory {}.", current.display()))?
    {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            let next_path = entry.path();
            if should_exclude_directory(root, &next_path, exclude_patterns) {
                *skipped_directory_count += 1;
                continue;
            }

            directories.push(next_path);
        }
    }

    directories.sort();
    Ok(directories)
}

fn looks_like_project_directory(path: &Path) -> bool {
    [
        PACKAGE_JSON,
        CARGO_TOML,
        PYPROJECT_TOML,
        GO_MOD,
        COMPOSER_JSON,
        GEMFILE,
    ]
    .iter()
    .any(|file_name| path.join(file_name).is_file())
        || path.join(GIT_DIR).is_dir()
}

fn detect_package_manager(path: &Path) -> &'static str {
    if path.join(PNPM_LOCK).is_file() {
        "pnpm"
    } else if path.join(YARN_LOCK).is_file() {
        "yarn"
    } else {
        "npm"
    }
}

fn detect_package_json_commands(path: &Path, value: &JsonValue) -> Vec<String> {
    let Some(scripts) = value.get("scripts").and_then(JsonValue::as_object) else {
        return Vec::new();
    };
    let package_manager = detect_package_manager(path);
    let mut commands = Vec::new();

    for script_name in [
        "dev",
        "start",
        "tauri:dev",
        "desktop",
        "electron:dev",
        "serve",
        "preview",
    ] {
        if !scripts.contains_key(script_name) {
            continue;
        }

        push_unique_string(
            &mut commands,
            format_package_manager_command(package_manager, script_name),
        );
    }

    commands
}

fn format_package_manager_command(package_manager: &str, script_name: &str) -> String {
    match package_manager {
        "yarn" => format!("yarn {script_name}"),
        "pnpm" => format!("pnpm {script_name}"),
        "npm" if script_name == "start" => "npm start".to_string(),
        _ => format!("npm run {script_name}"),
    }
}

fn detect_pyproject_name(value: &TomlValue) -> Option<String> {
    value
        .get("project")
        .and_then(|project| project.get("name"))
        .and_then(TomlValue::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            value
                .get("tool")
                .and_then(|tool| tool.get("poetry"))
                .and_then(|poetry| poetry.get("name"))
                .and_then(TomlValue::as_str)
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
}

fn detect_go_module_name(contents: &str) -> Option<String> {
    contents
        .lines()
        .map(str::trim)
        .find_map(|line| line.strip_prefix("module "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.rsplit('/').next().unwrap_or(value).to_string())
}

fn push_unique_string(values: &mut Vec<String>, next_value: String) {
    if next_value.trim().is_empty() {
        return;
    }

    if !values.iter().any(|value| value == &next_value) {
        values.push(next_value);
    }
}

fn should_exclude_directory(root: &Path, candidate: &Path, exclude_patterns: &[String]) -> bool {
    let relative_path = candidate
        .strip_prefix(root)
        .unwrap_or(candidate)
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();
    let directory_name = candidate
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();

    exclude_patterns.iter().any(|pattern| {
        let normalized_pattern = pattern.trim().to_ascii_lowercase();
        !normalized_pattern.is_empty()
            && (directory_name == normalized_pattern || relative_path.contains(&normalized_pattern))
    })
}

fn relative_project_path(root: &Path, candidate: &Path) -> String {
    candidate
        .strip_prefix(root)
        .ok()
        .and_then(|value| {
            let rendered = value.to_string_lossy().replace('\\', "/");
            if rendered.is_empty() {
                None
            } else {
                Some(rendered)
            }
        })
        .unwrap_or_else(|| ".".to_string())
}

fn detect_cargo_package_name(contents: &str) -> Option<String> {
    let mut in_package_section = false;

    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_package_section = trimmed == "[package]";
            continue;
        }

        if !in_package_section || !trimmed.starts_with("name") {
            continue;
        }

        let (_, value) = trimmed.split_once('=')?;
        let normalized = value.trim().trim_matches('"').trim();
        if !normalized.is_empty() {
            return Some(normalized.to_string());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use crate::models::ProjectDirectoryScanOptions;

    use super::{inspect_project_directory, scan_project_directories};

    #[test]
    fn inspects_node_project_with_pnpm_dev_script() {
        let directory = tempdir().expect("temp dir");
        fs::write(
            directory.path().join("package.json"),
            r#"{"name":"deskhub-web","scripts":{"dev":"vite","start":"vite preview"}}"#,
        )
        .expect("package");
        fs::write(
            directory.path().join("pnpm-lock.yaml"),
            "lockfileVersion: 9.0",
        )
        .expect("lock");

        let result = inspect_project_directory(directory.path()).expect("inspection");

        assert_eq!(result.suggested_name.as_deref(), Some("deskhub-web"));
        assert_eq!(result.suggested_command.as_deref(), Some("pnpm dev"));
        assert_eq!(
            result.command_suggestions,
            vec!["pnpm dev".to_string(), "pnpm start".to_string()]
        );
        assert!(
            result
                .detected_files
                .iter()
                .any(|entry| entry == "package.json")
        );
    }

    #[test]
    fn inspects_rust_project_without_package_json() {
        let directory = tempdir().expect("temp dir");
        fs::write(
            directory.path().join("Cargo.toml"),
            "[package]\nname = \"desk-core\"\nversion = \"0.1.0\"\n",
        )
        .expect("cargo");

        let result = inspect_project_directory(directory.path()).expect("inspection");

        assert_eq!(result.suggested_name.as_deref(), Some("desk-core"));
        assert_eq!(result.suggested_command.as_deref(), Some("cargo run"));
        assert_eq!(result.command_suggestions, vec!["cargo run".to_string()]);
    }

    #[test]
    fn inspects_go_project_and_suggests_go_run() {
        let directory = tempdir().expect("temp dir");
        fs::write(
            directory.path().join("go.mod"),
            "module github.com/example/deskhub-cli\n\ngo 1.24\n",
        )
        .expect("go.mod");

        let result = inspect_project_directory(directory.path()).expect("inspection");

        assert_eq!(result.suggested_name.as_deref(), Some("deskhub-cli"));
        assert_eq!(result.suggested_command.as_deref(), Some("go run ."));
        assert!(result.detected_files.iter().any(|entry| entry == "go.mod"));
    }

    #[test]
    fn scans_root_and_first_level_project_directories() {
        let workspace = tempdir().expect("workspace");
        fs::write(
            workspace.path().join("package.json"),
            r#"{"name":"root-app","scripts":{"dev":"vite"}}"#,
        )
        .expect("root package");

        let api_dir = workspace.path().join("api");
        fs::create_dir_all(&api_dir).expect("api dir");
        fs::write(
            api_dir.join("Cargo.toml"),
            "[package]\nname = \"desk-api\"\nversion = \"0.1.0\"\n",
        )
        .expect("cargo");

        let docs_dir = workspace.path().join("docs");
        fs::create_dir_all(&docs_dir).expect("docs dir");

        let scan = scan_project_directories(workspace.path(), None).expect("scan");

        assert_eq!(scan.candidates.len(), 2);
        assert!(
            scan.candidates
                .iter()
                .any(|candidate| candidate.suggested_name == "root-app")
        );
        assert!(
            scan.candidates
                .iter()
                .any(|candidate| candidate.suggested_name == "desk-api")
        );
        assert!(
            !scan.candidates
                .iter()
                .any(|candidate| candidate.path.ends_with("docs"))
        );
        assert_eq!(scan.scan_depth, 1);
        assert_eq!(scan.scanned_directory_count, 3);
        assert_eq!(scan.skipped_directory_count, 0);
    }

    #[test]
    fn scans_deeper_and_respects_exclude_patterns() {
        let workspace = tempdir().expect("workspace");
        let services_dir = workspace.path().join("services");
        let api_dir = services_dir.join("api");
        let node_modules_dir = workspace.path().join("node_modules").join("pkg");

        fs::create_dir_all(&api_dir).expect("api dir");
        fs::create_dir_all(&node_modules_dir).expect("node_modules dir");
        fs::write(
            api_dir.join("package.json"),
            r#"{"name":"nested-api","scripts":{"dev":"vite"}}"#,
        )
        .expect("package");
        fs::write(
            node_modules_dir.join("package.json"),
            r#"{"name":"should-be-filtered","scripts":{"dev":"vite"}}"#,
        )
        .expect("filtered package");

        let scan = scan_project_directories(
            workspace.path(),
            Some(&ProjectDirectoryScanOptions {
                scan_depth: 2,
                exclude_patterns: vec!["services/docs".into()],
            }),
        )
        .expect("scan");

        assert_eq!(scan.scan_depth, 2);
        assert!(
            scan.candidates
                .iter()
                .any(|candidate| candidate.relative_path == "services/api" && candidate.depth == 2)
        );
        assert!(
            !scan
                .candidates
                .iter()
                .any(|candidate| candidate.path.contains("node_modules"))
        );
        assert!(scan.skipped_directory_count >= 1);
    }
}
