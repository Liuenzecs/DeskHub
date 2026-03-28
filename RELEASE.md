# DeskHub 发布说明

本文件记录当前项目的发布前检查项、手动发版步骤，以及 GitHub Release 自动化流程。

当前发布策略以 Windows 为主。

## 发布前先看哪些文档

发版前建议依次确认：

- [`VERSIONING.md`](./VERSIONING.md)
- [`CHANGELOG.md`](./CHANGELOG.md)
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
- [`DECISIONS.md`](./DECISIONS.md)
- [`RELEASE_ASSET_TEMPLATES.md`](./RELEASE_ASSET_TEMPLATES.md)
- [`PACKAGING_STRATEGY.md`](./PACKAGING_STRATEGY.md)
- [`release-assets/first-release-draft/README.md`](./release-assets/first-release-draft/README.md)

## 版本同步

发布前必须同步以下 3 个版本号：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

建议三处保持一致，例如 `0.1.0 -> 0.1.1`。

tag 规则遵循 [`VERSIONING.md`](./VERSIONING.md)：

- 正式版：`vX.Y.Z`
- 预发布：`vX.Y.Z-beta.1`

## 发版 checklist

### 代码与文档

- 确认 `README.md`、`PROJECT_STATUS.md`、`DECISIONS.md` 已同步本版重要变化
- 确认 `CHANGELOG.md` 的 `[Unreleased]` 已整理，或已拆分出对应版本段落
- 确认 release 截图、更新说明、升级须知已按 [`RELEASE_ASSET_TEMPLATES.md`](./RELEASE_ASSET_TEMPLATES.md) 准备
- 确认没有遗留临时调试代码、临时 mock、临时文案、测试快捷入口
- 确认 SQLite schema 变更已带 migration，且迁移文档同步
- 确认安装包图标、应用名称、版本号与 artifact 命名符合 [`PACKAGING_STRATEGY.md`](./PACKAGING_STRATEGY.md) 中的元信息核对基线

### 自动验证

至少运行：

```bash
npm run check
```

如果本版涉及桌面打包行为，额外建议运行：

```bash
npm run tauri:build -- --debug
```

正式构建：

```bash
npm run tauri:build
```

### 手动回归建议

至少手动检查以下场景：

- 六种条目都能新增、编辑、删除并在重启后保留
- 应用、项目、文件夹、网站、脚本、工作流都能正常启动
- `project` 在有 `devCommand` 时优先运行命令，没有时打开目录
- workflow 能顺序执行 `open_path / open_url / run_command`
- workflow 条件、失败策略、重试、跳转行为符合预期
- 默认工作流能从 Topbar 的“一键上班模式”直接启动
- `Ctrl+K / Cmd+K` 能搜索条目、导航、动作
- 数据工具中的备份、恢复、导入、结构化报告导出反馈清晰
- 最近使用与收藏状态同步正常

### 发布资产准备

建议在进入最终发版前，按 [`RELEASE_ASSET_TEMPLATES.md`](./RELEASE_ASSET_TEMPLATES.md) 至少补齐：

- 6 张基础 release 截图
- GitHub Release 文案
- 升级须知
- smoke test 记录

### 如果本版涉及数据库变更

额外确认：

- migration 能从旧版本库正确升级
- 健康检查失败时不会静默重建空库
- 备份 / 恢复 / 导入 / 导出行为与新 schema 兼容
- 诊断模式下破坏性操作会被正确锁定

### 如果本版涉及启动器变更

额外确认：

- 中文路径、带空格路径、复杂命令都能稳定启动
- `new_terminal` 与 `background` 的行为符合预期
- 不会额外弹出不需要的后端窗口

## GitHub Release 自动化

仓库已提供 GitHub Actions workflow：

- [`ci.yml`](./.github/workflows/ci.yml)
- [`release.yml`](./.github/workflows/release.yml)

其中：

- `ci.yml` 负责常规校验
- `release.yml` 负责 Windows release 构建、GitHub Release 草稿创建、bundle 产物上传

触发方式：

- 推送 `vX.Y.Z` 或 `vX.Y.Z-beta.1` tag
- 或手动触发 `release.yml` 并填写 release tag

自动化流程会做：

- 安装 Node / Rust 依赖
- 运行 `npm run check`
- 执行 Tauri Windows 构建
- 创建或更新 GitHub Release 草稿
- 上传 `src-tauri/target/release/bundle/` 产物

## 手动发版步骤

### 1. 更新版本号与 changelog

修改：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `CHANGELOG.md`

### 2. 跑完整校验

```bash
npm run check
```

### 3. 本地构建正式包

```bash
npm run tauri:build
```

### 4. 检查产物

重点检查：

- `src-tauri/target/release/bundle/`
- 安装包 / 可执行文件命名是否正确
- 首次启动是否能成功打开主窗口
- 产物说明是否和当前策略一致

如需判断这一版是否提供 portable zip，请先参考：

- [`PACKAGING_STRATEGY.md`](./PACKAGING_STRATEGY.md)

### 5. 创建并推送 tag

示例：

```bash
git tag v0.1.1
git push origin v0.1.1
```

### 6. 检查 GitHub Release 草稿

重点确认：

- Release 标题与 tag 正确
- 产物上传完整
- `CHANGELOG.md` 对应版本内容已同步到 release 文案
- 是否应标记为 prerelease

### 7. 发布后补充记录

建议至少记录：

- 本版新增能力
- 本版修复的问题
- 本版已知限制
- 是否包含 migration / 数据层变化
- 实际验证通过的安装包与 smoke test 结论
- 本次 release 文案、升级须知与截图是否已归档

## 发布后建议

- 保存本次构建产物
- 记录最终校验命令输出
- 如果这一版调整了信息架构、工作流语义或数据工具行为，把结果同步回 `DECISIONS.md`
