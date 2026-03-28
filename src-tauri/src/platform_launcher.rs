use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, SystemTime},
};

use anyhow::{Context, Result, anyhow};
use url::Url;
use uuid::Uuid;

use crate::models::CommandExecutionMode;

const LAUNCH_SCRIPT_DIR: &str = "deskhub-launcher";
const STALE_LAUNCH_SCRIPT_TTL: Duration = Duration::from_secs(60 * 60 * 24);

pub fn launch_app(target: &str) -> Result<()> {
    current_platform().launch_app(target)
}

pub fn launch_project(display_name: &str, project_path: &str, dev_command: &str) -> Result<()> {
    current_platform().launch_project(display_name, project_path, dev_command)
}

pub fn open_path(target: &str) -> Result<()> {
    current_platform().open_path(target)
}

pub fn open_url(target: &str) -> Result<()> {
    current_platform().open_url(target)
}

pub fn run_command(
    command: &str,
    current_dir: Option<&str>,
    execution_mode: CommandExecutionMode,
    window_title: Option<&str>,
) -> Result<()> {
    current_platform().run_command(command, current_dir, execution_mode, window_title)
}

trait PlatformLaunchBackend: Sync {
    fn launch_app(&self, target: &str) -> Result<()>;
    fn launch_project(
        &self,
        display_name: &str,
        project_path: &str,
        dev_command: &str,
    ) -> Result<()>;
    fn open_path(&self, target: &str) -> Result<()>;
    fn open_url(&self, target: &str) -> Result<()>;
    fn run_command(
        &self,
        command: &str,
        current_dir: Option<&str>,
        execution_mode: CommandExecutionMode,
        window_title: Option<&str>,
    ) -> Result<()>;
}

#[cfg(target_os = "windows")]
fn current_platform() -> &'static dyn PlatformLaunchBackend {
    &windows::WINDOWS_PLATFORM
}

#[cfg(target_os = "macos")]
fn current_platform() -> &'static dyn PlatformLaunchBackend {
    &macos::MACOS_PLATFORM
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn current_platform() -> &'static dyn PlatformLaunchBackend {
    &linux::LINUX_PLATFORM
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn validate_existing_path<'a>(target: &'a str, label: &str) -> Result<&'a Path> {
    let path = Path::new(target);
    if path.exists() {
        Ok(path)
    } else {
        Err(anyhow!("{label} does not exist: {target}"))
    }
}

fn validate_working_directory(current_dir: Option<&str>) -> Result<()> {
    let Some(path) = current_dir else {
        return Ok(());
    };

    if Path::new(path).is_dir() {
        Ok(())
    } else {
        Err(anyhow!("Working directory does not exist: {path}"))
    }
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn validate_url(target: &str) -> Result<()> {
    Url::parse(target).with_context(|| format!("Invalid URL: {target}"))?;
    Ok(())
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn run_blocking_posix_command(command: &str, current_dir: Option<&str>) -> Result<()> {
    if command.trim().is_empty() {
        return Err(anyhow!("Command cannot be empty."));
    }

    validate_working_directory(current_dir)?;

    let mut process = Command::new("sh");
    process.args(["-lc", command]);

    if let Some(path) = current_dir {
        process.current_dir(path);
    }

    let status = process
        .status()
        .with_context(|| format!("Failed to start blocking command: {command}"))?;

    if !status.success() {
        return Err(anyhow!("Command exited with status {status}: {command}"));
    }

    Ok(())
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn spawn_posix_background_command(command: &str, current_dir: Option<&str>) -> Result<()> {
    if command.trim().is_empty() {
        return Err(anyhow!("Command cannot be empty."));
    }

    validate_working_directory(current_dir)?;

    let background_command = build_posix_background_command(command, current_dir);
    let status = Command::new("sh")
        .args(["-lc", &background_command])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .with_context(|| format!("Failed to spawn background command: {command}"))?;

    if !status.success() {
        return Err(anyhow!(
            "Background launcher exited with status {status}: {command}"
        ));
    }

    Ok(())
}

fn build_posix_terminal_command(command: &str, current_dir: Option<&str>) -> String {
    if let Some(path) = current_dir {
        format!("cd {} && {}", quote_for_posix_shell(path), command)
    } else {
        command.to_string()
    }
}

fn build_posix_background_command(command: &str, current_dir: Option<&str>) -> String {
    let background = format!(
        "nohup sh -lc {} >/dev/null 2>&1 &",
        quote_for_posix_shell(command)
    );
    if let Some(path) = current_dir {
        format!("cd {} && {background}", quote_for_posix_shell(path))
    } else {
        background
    }
}

fn quote_for_posix_shell(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'"'"'"#))
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn escape_applescript_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "")
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn is_command_available(program: &str) -> bool {
    let Some(path_variable) = env::var_os("PATH") else {
        return false;
    };

    env::split_paths(&path_variable).any(|directory| directory.join(program).is_file())
}

#[cfg(target_os = "windows")]
pub(crate) mod windows {
    use super::*;

    pub(super) static WINDOWS_PLATFORM: WindowsPlatform = WindowsPlatform;

    pub(super) struct WindowsPlatform;

    impl PlatformLaunchBackend for WindowsPlatform {
        fn launch_app(&self, target: &str) -> Result<()> {
            if !Path::new(target).exists() {
                return Err(anyhow!("App target does not exist: {target}"));
            }

            if should_launch_via_shell(Path::new(target)) {
                return launch_with_shell(target)
                    .with_context(|| format!("Failed to open app shortcut: {target}."));
            }

            Command::new(target)
                .spawn()
                .with_context(|| format!("Failed to start {target}."))?;

            Ok(())
        }

        fn launch_project(
            &self,
            display_name: &str,
            project_path: &str,
            dev_command: &str,
        ) -> Result<()> {
            if !Path::new(project_path).exists() {
                return Err(anyhow!("Project path does not exist: {project_path}"));
            }

            if dev_command.trim().is_empty() {
                return self.open_path(project_path);
            }

            self.run_command(
                dev_command,
                Some(project_path),
                CommandExecutionMode::NewTerminal,
                Some(display_name),
            )
        }

        fn open_path(&self, target: &str) -> Result<()> {
            if !Path::new(target).exists() {
                return Err(anyhow!("Path does not exist: {target}"));
            }

            Command::new("explorer")
                .arg(target)
                .spawn()
                .with_context(|| format!("Failed to open {target}."))?;

            Ok(())
        }

        fn open_url(&self, target: &str) -> Result<()> {
            Url::parse(target).with_context(|| format!("Invalid URL: {target}"))?;
            let command = format!("start \"\" \"{}\"", target.replace('"', "\"\""));

            Command::new("cmd")
                .args(["/C", &command])
                .spawn()
                .with_context(|| format!("Failed to open {target}."))?;

            Ok(())
        }

        fn run_command(
            &self,
            command: &str,
            current_dir: Option<&str>,
            execution_mode: CommandExecutionMode,
            window_title: Option<&str>,
        ) -> Result<()> {
            if command.trim().is_empty() {
                return Err(anyhow!("Command cannot be empty."));
            }

            validate_working_directory(current_dir)?;

            match execution_mode {
                CommandExecutionMode::Blocking => run_blocking_command(command, current_dir),
                CommandExecutionMode::NewTerminal => {
                    run_command_in_new_terminal(command, current_dir, window_title)
                }
                CommandExecutionMode::Background => run_command_in_background(command, current_dir),
            }
        }
    }

    fn launch_with_shell(target: &str) -> Result<()> {
        let command = format!("start \"\" {}", quote_for_cmd(target));

        Command::new("cmd")
            .args(["/D", "/C", &command])
            .spawn()
            .with_context(|| format!("Failed to open target via shell: {target}"))?;

        Ok(())
    }

    fn run_blocking_command(command: &str, current_dir: Option<&str>) -> Result<()> {
        let script_path = create_launch_script(command, current_dir)
            .with_context(|| format!("Failed to prepare blocking command script: {command}"))?;
        let mut process = Command::new("cmd");

        let status = process
            .args(["/D", "/C"])
            .arg(script_path.as_os_str())
            .status()
            .with_context(|| format!("Failed to start blocking command: {command}"))?;

        if !status.success() {
            return Err(anyhow!("Command exited with status {status}: {command}"));
        }

        Ok(())
    }

    fn run_command_in_new_terminal(
        command: &str,
        current_dir: Option<&str>,
        window_title: Option<&str>,
    ) -> Result<()> {
        let script_path = create_launch_script(command, current_dir)
            .with_context(|| format!("Failed to prepare new terminal command script: {command}"))?;
        let command_script = build_new_terminal_command(&script_path, window_title);

        Command::new("cmd")
            .args(["/D", "/C", &command_script])
            .spawn()
            .with_context(|| format!("Failed to spawn command in a new terminal: {command}"))?;

        Ok(())
    }

    fn run_command_in_background(command: &str, current_dir: Option<&str>) -> Result<()> {
        let script_path = create_launch_script(command, current_dir)
            .with_context(|| format!("Failed to prepare background command script: {command}"))?;
        let mut process = Command::new("cmd");

        apply_hidden_window(&mut process);
        process
            .args(["/D", "/C"])
            .arg(script_path.as_os_str())
            .spawn()
            .with_context(|| format!("Failed to spawn background command: {command}"))?;

        Ok(())
    }

    fn create_launch_script(command: &str, current_dir: Option<&str>) -> Result<PathBuf> {
        cleanup_stale_launch_scripts();

        let launch_script_dir = std::env::temp_dir().join(LAUNCH_SCRIPT_DIR);
        fs::create_dir_all(&launch_script_dir).with_context(|| {
            format!("Failed to create launcher temp directory: {launch_script_dir:?}")
        })?;

        let script_path = launch_script_dir.join(format!("{}.cmd", Uuid::new_v4()));
        write_windows_command_file(&script_path, &build_launch_script(command, current_dir))
            .with_context(|| {
                format!("Failed to write temporary command script: {script_path:?}")
            })?;

        Ok(script_path)
    }

    fn cleanup_stale_launch_scripts() {
        let launch_script_dir = std::env::temp_dir().join(LAUNCH_SCRIPT_DIR);
        let now = SystemTime::now();
        let entries = match fs::read_dir(&launch_script_dir) {
            Ok(entries) => entries,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let is_stale = entry
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| now.duration_since(modified).ok())
                .is_some_and(|age| age > STALE_LAUNCH_SCRIPT_TTL);

            if is_stale {
                let _ = fs::remove_file(path);
            }
        }
    }

    pub(crate) fn build_launch_script(command: &str, current_dir: Option<&str>) -> String {
        let mut lines = vec!["@echo off".to_string(), "setlocal".to_string()];

        if let Some(path) = current_dir {
            lines.push(format!("cd /D {}", quote_for_cmd(path)));
            lines.push("if errorlevel 1 exit /b 1".to_string());
        }

        lines.push(normalize_command_for_launch_script(command));
        lines.push(String::new());
        lines.join("\r\n")
    }

    pub(crate) fn normalize_command_for_launch_script(command: &str) -> String {
        let Some(script_path) = resolve_direct_script_file(command) else {
            return command.to_string();
        };

        let path = script_path.display().to_string();
        match script_path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref()
        {
            Some("cmd") | Some("bat") => format!("call {}", quote_for_cmd(&path)),
            Some("ps1") => format!(
                "powershell -NoProfile -ExecutionPolicy Bypass -File {}",
                quote_for_cmd(&path)
            ),
            _ => command.to_string(),
        }
    }

    fn resolve_direct_script_file(command: &str) -> Option<PathBuf> {
        let trimmed = command.trim();
        if trimmed.is_empty() {
            return None;
        }

        let direct_path = PathBuf::from(trimmed);
        if direct_path.is_file() {
            return Some(direct_path);
        }

        let unquoted = trim_wrapping_quotes(trimmed);
        if unquoted == trimmed {
            return None;
        }

        let quoted_path = PathBuf::from(unquoted);
        if quoted_path.is_file() {
            Some(quoted_path)
        } else {
            None
        }
    }

    fn trim_wrapping_quotes(value: &str) -> &str {
        value
            .strip_prefix('"')
            .and_then(|trimmed| trimmed.strip_suffix('"'))
            .unwrap_or(value)
    }

    fn write_windows_command_file(path: &Path, content: &str) -> Result<()> {
        let mut bytes = vec![0xFF, 0xFE];
        for unit in content.encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        fs::write(path, bytes)?;
        Ok(())
    }

    pub(crate) fn build_new_terminal_command(
        script_path: &Path,
        window_title: Option<&str>,
    ) -> String {
        let quoted_script_path = quote_for_cmd(&script_path.display().to_string());
        let title = sanitize_window_title(window_title.unwrap_or("DeskHub"));
        format!("start \"{title}\" cmd /D /K {quoted_script_path}")
    }

    fn quote_for_cmd(value: &str) -> String {
        format!("\"{}\"", value.replace('"', "\"\""))
    }

    fn sanitize_window_title(value: &str) -> String {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed == "DeskHub" {
            "DeskHub".into()
        } else {
            format!("DeskHub · {}", trimmed.replace('"', "'"))
        }
    }

    pub(crate) fn should_launch_via_shell(path: &Path) -> bool {
        path.extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("lnk"))
    }

    fn apply_hidden_window(process: &mut Command) {
        use std::os::windows::process::CommandExt;

        process.creation_flags(0x08000000);
    }
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
mod macos {
    use super::*;

    pub(super) static MACOS_PLATFORM: MacOsPlatform = MacOsPlatform;

    pub(super) struct MacOsPlatform;

    impl PlatformLaunchBackend for MacOsPlatform {
        fn launch_app(&self, target: &str) -> Result<()> {
            let path = validate_existing_path(target, "App target")?;

            if should_open_with_open(path) {
                return spawn_open_command(target);
            }

            Command::new(target)
                .spawn()
                .or_else(|_| Command::new("open").arg(target).spawn())
                .with_context(|| format!("Failed to start {target}."))?;

            Ok(())
        }

        fn launch_project(
            &self,
            display_name: &str,
            project_path: &str,
            dev_command: &str,
        ) -> Result<()> {
            validate_existing_path(project_path, "Project path")?;

            if dev_command.trim().is_empty() {
                return self.open_path(project_path);
            }

            self.run_command(
                dev_command,
                Some(project_path),
                CommandExecutionMode::NewTerminal,
                Some(display_name),
            )
        }

        fn open_path(&self, target: &str) -> Result<()> {
            validate_existing_path(target, "Path")?;
            spawn_open_command(target)
        }

        fn open_url(&self, target: &str) -> Result<()> {
            validate_url(target)?;
            spawn_open_command(target)
        }

        fn run_command(
            &self,
            command: &str,
            current_dir: Option<&str>,
            execution_mode: CommandExecutionMode,
            _window_title: Option<&str>,
        ) -> Result<()> {
            match execution_mode {
                CommandExecutionMode::Blocking => run_blocking_posix_command(command, current_dir),
                CommandExecutionMode::NewTerminal => run_command_in_terminal(command, current_dir),
                CommandExecutionMode::Background => {
                    spawn_posix_background_command(command, current_dir)
                }
            }
        }
    }

    fn should_open_with_open(path: &Path) -> bool {
        path.is_dir()
            || path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
    }

    fn spawn_open_command(target: &str) -> Result<()> {
        Command::new("open")
            .arg(target)
            .spawn()
            .with_context(|| format!("Failed to open {target}."))?;
        Ok(())
    }

    fn run_command_in_terminal(command: &str, current_dir: Option<&str>) -> Result<()> {
        if command.trim().is_empty() {
            return Err(anyhow!("Command cannot be empty."));
        }

        validate_working_directory(current_dir)?;

        let script_lines = build_terminal_osascript_lines(command, current_dir);

        Command::new("osascript")
            .args(["-e", &script_lines[0], "-e", &script_lines[1]])
            .spawn()
            .with_context(|| format!("Failed to spawn command in Terminal: {command}"))?;

        Ok(())
    }

    pub(super) fn build_terminal_osascript_lines(
        command: &str,
        current_dir: Option<&str>,
    ) -> [String; 2] {
        let shell_command = build_posix_terminal_command(command, current_dir);
        [
            "tell application \"Terminal\" to activate".to_string(),
            format!(
                "tell application \"Terminal\" to do script \"{}\"",
                escape_applescript_string(&shell_command)
            ),
        ]
    }
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
mod linux {
    use super::*;

    pub(super) static LINUX_PLATFORM: LinuxPlatform = LinuxPlatform;

    pub(super) struct LinuxPlatform;

    impl PlatformLaunchBackend for LinuxPlatform {
        fn launch_app(&self, target: &str) -> Result<()> {
            let path = validate_existing_path(target, "App target")?;
            if path.is_dir() {
                return self.open_path(target);
            }

            match Command::new(target).spawn() {
                Ok(_) => Ok(()),
                Err(spawn_error) => spawn_linux_opener(target).with_context(|| {
                    format!(
                        "Failed to start {target} directly ({spawn_error}) and no opener fallback succeeded."
                    )
                }),
            }
        }

        fn launch_project(
            &self,
            display_name: &str,
            project_path: &str,
            dev_command: &str,
        ) -> Result<()> {
            validate_existing_path(project_path, "Project path")?;

            if dev_command.trim().is_empty() {
                return self.open_path(project_path);
            }

            self.run_command(
                dev_command,
                Some(project_path),
                CommandExecutionMode::NewTerminal,
                Some(display_name),
            )
        }

        fn open_path(&self, target: &str) -> Result<()> {
            validate_existing_path(target, "Path")?;
            spawn_linux_opener(target)
        }

        fn open_url(&self, target: &str) -> Result<()> {
            validate_url(target)?;
            spawn_linux_opener(target)
        }

        fn run_command(
            &self,
            command: &str,
            current_dir: Option<&str>,
            execution_mode: CommandExecutionMode,
            window_title: Option<&str>,
        ) -> Result<()> {
            match execution_mode {
                CommandExecutionMode::Blocking => run_blocking_posix_command(command, current_dir),
                CommandExecutionMode::NewTerminal => {
                    run_command_in_new_terminal(command, current_dir, window_title)
                }
                CommandExecutionMode::Background => {
                    spawn_posix_background_command(command, current_dir)
                }
            }
        }
    }

    #[derive(Debug, Clone, Copy)]
    pub(super) struct TerminalLauncher {
        pub(super) program: &'static str,
        pub(super) prefix: &'static [&'static str],
    }

    const TERMINAL_LAUNCHERS: &[TerminalLauncher] = &[
        TerminalLauncher {
            program: "x-terminal-emulator",
            prefix: &["-e"],
        },
        TerminalLauncher {
            program: "gnome-terminal",
            prefix: &["--"],
        },
        TerminalLauncher {
            program: "konsole",
            prefix: &["-e"],
        },
        TerminalLauncher {
            program: "xfce4-terminal",
            prefix: &["-e"],
        },
        TerminalLauncher {
            program: "xterm",
            prefix: &["-e"],
        },
        TerminalLauncher {
            program: "alacritty",
            prefix: &["-e"],
        },
        TerminalLauncher {
            program: "kitty",
            prefix: &[],
        },
        TerminalLauncher {
            program: "wezterm",
            prefix: &["start", "--always-new-process", "--"],
        },
    ];

    const OPENERS: &[(&str, &[&str])] = &[("xdg-open", &[]), ("gio", &["open"])];

    fn spawn_linux_opener(target: &str) -> Result<()> {
        let (program, prefix) = find_linux_opener_with(is_command_available)
            .ok_or_else(|| {
                anyhow!("No supported Linux opener was found. Install xdg-open or gio.")
            })?;

        let mut process = Command::new(program);
        process.args(prefix).arg(target);
        process
            .spawn()
            .with_context(|| format!("Failed to open {target} via {program}"))?;

        Ok(())
    }

    pub(super) fn find_linux_opener_with<F>(
        mut is_available: F,
    ) -> Option<(&'static str, &'static [&'static str])>
    where
        F: FnMut(&str) -> bool,
    {
        OPENERS
            .iter()
            .find(|(program, _)| is_available(program))
            .copied()
    }

    fn resolve_terminal_launcher() -> Result<&'static TerminalLauncher> {
        find_terminal_launcher_with(is_command_available).ok_or_else(|| {
                anyhow!(
                    "No supported Linux terminal was found. Tried: {}",
                    TERMINAL_LAUNCHERS
                        .iter()
                        .map(|launcher| launcher.program)
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            })
    }

    pub(super) fn find_terminal_launcher_with<F>(
        mut is_available: F,
    ) -> Option<&'static TerminalLauncher>
    where
        F: FnMut(&str) -> bool,
    {
        TERMINAL_LAUNCHERS
            .iter()
            .find(|launcher| is_available(launcher.program))
    }

    fn run_command_in_new_terminal(
        command: &str,
        current_dir: Option<&str>,
        _window_title: Option<&str>,
    ) -> Result<()> {
        if command.trim().is_empty() {
            return Err(anyhow!("Command cannot be empty."));
        }

        validate_working_directory(current_dir)?;

        let launcher = resolve_terminal_launcher()?;
        let mut process = Command::new(launcher.program);
        process.args(build_terminal_command_args(
            launcher,
            command,
            current_dir,
        ));

        process.spawn().with_context(|| {
            format!(
                "Failed to spawn command in a new terminal via {}: {command}",
                launcher.program
            )
        })?;

        Ok(())
    }

    pub(super) fn build_terminal_command_args(
        launcher: &TerminalLauncher,
        command: &str,
        current_dir: Option<&str>,
    ) -> Vec<String> {
        let shell_command = build_posix_terminal_command(command, current_dir);
        launcher
            .prefix
            .iter()
            .map(|value| (*value).to_string())
            .chain(["sh", "-lc"].into_iter().map(str::to_string))
            .chain(std::iter::once(shell_command))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_posix_background_command, build_posix_terminal_command, macos, linux,
        quote_for_posix_shell,
    };

    #[test]
    fn posix_terminal_command_prepends_working_directory() {
        let command = build_posix_terminal_command("npm run dev", Some("/Users/demo/deskhub"));

        assert_eq!(command, "cd '/Users/demo/deskhub' && npm run dev");
    }

    #[test]
    fn posix_background_command_wraps_with_nohup() {
        let command =
            build_posix_background_command("pnpm dev --port 3000", Some("/workspace/app"));

        assert_eq!(
            command,
            "cd '/workspace/app' && nohup sh -lc 'pnpm dev --port 3000' >/dev/null 2>&1 &"
        );
    }

    #[test]
    fn posix_shell_quoting_escapes_single_quotes() {
        let quoted = quote_for_posix_shell("/tmp/DeskHub's workspace");

        assert_eq!(quoted, "'/tmp/DeskHub'\"'\"'s workspace'");
    }

    #[test]
    fn macos_terminal_osascript_lines_escape_quotes_and_activate_terminal() {
        let lines = macos::build_terminal_osascript_lines(
            "printf 'DeskHub \"ready\"'",
            Some("/Users/demo/DeskHub"),
        );

        assert_eq!(lines[0], "tell application \"Terminal\" to activate");
        assert_eq!(
            lines[1],
            "tell application \"Terminal\" to do script \"cd '/Users/demo/DeskHub' && printf 'DeskHub \\\"ready\\\"'\""
        );
    }

    #[test]
    fn linux_opener_selection_prefers_xdg_open_before_gio() {
        let opener = linux::find_linux_opener_with(|program| program == "xdg-open" || program == "gio")
            .expect("expected Linux opener");

        assert_eq!(opener.0, "xdg-open");
        assert!(opener.1.is_empty());
    }

    #[test]
    fn linux_terminal_selection_respects_priority_order() {
        let launcher = linux::find_terminal_launcher_with(|program| {
            program == "konsole" || program == "xterm"
        })
        .expect("expected Linux terminal launcher");

        assert_eq!(launcher.program, "konsole");
        assert_eq!(launcher.prefix, &["-e"]);
    }

    #[test]
    fn linux_terminal_command_args_include_launcher_prefix_and_shell_command() {
        let launcher = linux::find_terminal_launcher_with(|program| program == "wezterm")
            .expect("expected wezterm launcher");

        let args = linux::build_terminal_command_args(
            launcher,
            "pnpm dev --filter api",
            Some("/workspace/deskhub"),
        );

        assert_eq!(
            args,
            vec![
                "start".to_string(),
                "--always-new-process".to_string(),
                "--".to_string(),
                "sh".to_string(),
                "-lc".to_string(),
                "cd '/workspace/deskhub' && pnpm dev --filter api".to_string(),
            ]
        );
    }
}
