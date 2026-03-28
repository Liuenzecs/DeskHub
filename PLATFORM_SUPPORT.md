# DeskHub Platform Support

最后更新：2026-03-28

## 当前结论

DeskHub 仍然是 `Windows First`，但启动器后端已经拆成平台抽象，并补上了 `macOS / Linux` 的基础实现。

这意味着：

- Windows 仍是当前最完整、最优先验证的平台
- macOS / Linux 不再只是“未实现”占位
- 不同平台的启动语义已明确收敛到一套能力矩阵
- `macOS / Linux` 的关键 launcher 语义现在已有 Rust 单元测试覆盖

## 启动能力矩阵

### Windows

- `app`
  - 直接启动 `.exe`
  - `.lnk` 通过 shell 打开
- `project`
  - 有 `devCommand` 时以 `new_terminal` 语义执行
  - 无命令时打开项目目录
- `folder`
  - 使用 `explorer`
- `url`
  - 使用系统默认浏览器
- `script / workflow.run_command`
  - `blocking / new_terminal / background`
  - 统一通过临时 `.cmd` 脚本规整 quoting

### macOS

- `app`
  - `.app` bundle 或目录通过 `open`
  - 可执行文件优先直接 `spawn`
  - 直接启动失败时回退到 `open`
- `project / folder`
  - 目录通过 `open`
  - `devCommand` 通过 Terminal + `osascript` 新开终端执行
- `url`
  - 通过 `open`
- `script / workflow.run_command`
  - `blocking`
    - `sh -lc`
  - `new_terminal`
    - `Terminal` + `osascript`
  - `background`
    - `nohup sh -lc ... &`

### Linux

- `app`
  - 可执行文件优先直接 `spawn`
  - 直接启动失败时回退到 opener
- `project / folder`
  - 目录通过 opener 打开
  - `devCommand` 通过已探测到的终端执行
- `url`
  - 通过 opener 打开
- `script / workflow.run_command`
  - `blocking`
    - `sh -lc`
  - `new_terminal`
    - 自动探测终端并执行
  - `background`
    - `nohup sh -lc ... &`

## Linux 回退策略

### opener

优先级：

1. `xdg-open`
2. `gio open`

### terminal

优先探测：

1. `x-terminal-emulator`
2. `gnome-terminal`
3. `konsole`
4. `xfce4-terminal`
5. `xterm`
6. `alacritty`
7. `kitty`
8. `wezterm`

如果都不存在，会返回明确错误，而不是静默失败。

## 当前边界

- 这轮只补了启动 backend，不承诺三平台 UI/安装包/权限表现完全一致
- `macOS / Linux` 本轮仍没有在真实本机环境做完整回归，但已经补上 CI 编译校验与关键 launcher 单测
- `project.devCommand` 仍然固定沿用“新终端运行”语义，没有扩成可配置

## 后续建议

- 评估 terminal title / icon / 新窗口体验的进一步一致化
- 继续补充更贴近真实运行环境的平台 smoke 回归
