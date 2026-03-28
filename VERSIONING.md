# DeskHub Versioning Strategy

本文件定义 DeskHub 的版本号、tag、changelog 与 GitHub Release 约定。

## 版本号规范

DeskHub 当前采用语义化版本号：

- `MAJOR.MINOR.PATCH`

示例：

- `0.1.0`
- `0.1.1`
- `0.2.0`

当前仍处于 `0.x` 阶段，意味着接口与行为仍可能继续收敛，但每次版本发布仍要保持明确的升级说明。

## 何时升级哪个版本位

### Patch

适用于：

- bug 修复
- UI 细节修复
- 不改变主要交互语义的小优化
- 纯数据层修复或稳定性修复

示例：

- `0.1.0 -> 0.1.1`

### Minor

适用于：

- 新增用户可感知能力
- 新的数据工具能力
- 新的工作流能力
- 新的管理页能力
- 不破坏已有数据结构的功能扩展

示例：

- `0.1.1 -> 0.2.0`

### Major

适用于：

- 明确的破坏式行为变化
- 明确的迁移成本
- 产品定位或核心交互发生根本调整

当前 `0.x` 阶段通常不主动进入 `1.0.0`，除非：

- Windows 主线体验稳定
- 发布流程稳定
- 核心数据结构与工作流语义基本定型

## 预发布版本

预发布版本使用：

- `vX.Y.Z-beta.1`
- `vX.Y.Z-rc.1`

规则：

- 正式版前的验证构建优先使用 `beta` 或 `rc`
- GitHub Release workflow 会把包含 `-` 的 tag 视为 prerelease
- 正式 tag 会直接发布 GitHub Release，不再先生成 draft

## 必须同步的版本位置

每次正式发版都必须同步以下三个文件：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

这三处版本号应保持一致。

## Tag 规范

DeskHub 的 Git tag 采用：

- 正式版：`vX.Y.Z`
- 预发布：`vX.Y.Z-beta.1`

示例：

- `v0.1.0`
- `v0.1.1`
- `v0.2.0-beta.1`

## Changelog 流程

`CHANGELOG.md` 采用简化的 Keep a Changelog 风格。

日常开发时：

- 所有未发布变化先写入 `[Unreleased]`

准备发版时：

1. 将 `[Unreleased]` 中已完成内容整理到对应版本段落
2. 新增类似 `## [0.1.1] - 2026-03-26` 的版本标题
3. 保留新的空白 `[Unreleased]` 区块

建议至少记录：

- Added
- Changed
- Fixed

## GitHub Release 约定

GitHub Release 自动化 workflow 位于：

- `.github/workflows/release.yml`

推荐发版方式：

1. 更新三个版本号
2. 更新 `CHANGELOG.md`
3. 运行 `npm run check`
4. 创建并推送 tag
5. 等待 GitHub Actions 生成 GitHub Release 和 Windows bundle
6. 检查产物与 release 文案是否正确

## 推荐发版命令

示例：

```bash
git tag v0.1.1
git push origin v0.1.1
```

预发布示例：

```bash
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

## 版本发布最小清单

每次发版至少确认：

- 版本号三处同步
- `CHANGELOG.md` 已更新
- `PROJECT_STATUS.md` 与 `DECISIONS.md` 已同步关键变化
- `npm run check` 通过
- 如果涉及打包或启动器行为，已本地 smoke test

## 当前建议

- 小修复优先走 patch
- 具有明确用户感知的新能力走 minor
- 没有充分理由时，不要为了“看起来升级很多”而抬高版本号
