# DeskHub 安装包与产物策略评估

最后更新：2026-03-28

本文档用于评估 DeskHub 当前阶段的安装包、发布产物和元信息策略。

它是评估文档，不是最终锁定决策。真正拍板之前，不应把本文中的建议写成已承诺能力。

## 当前现状

截至 2026-03-28，DeskHub 当前已具备这些发布基础：

- Tauri 配置中的 `productName` 为 `DeskHub`
- 应用标识符为 `com.realfeeling.deskhub`
- `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 已采用统一版本号
- GitHub Actions 已有 Windows release workflow
- Release draft 已支持自动上传 `src-tauri/target/release/bundle/` 产物
- 当前仍是 `Windows First`

当前仍未彻底统一的点：

- 安装包图标资产还没有形成跨平台完整矩阵
- Release 页面还没有固定使用的截图与升级说明模板
- `installer` 与 `portable zip` 的双产物策略还没有正式锁定

## 产物对比

| 维度 | Installer | Portable Zip |
| --- | --- | --- |
| 首次使用门槛 | 低 | 中 |
| 是否适合普通用户 | 更适合 | 需要解释 |
| 是否便于快捷方式与系统关联 | 更好 | 一般 |
| 更新路径 | 更清晰 | 需要额外说明 |
| 用户对数据目录位置的预期 | 更稳定 | 容易误解为“和程序同目录” |
| 支持成本 | 较低 | 较高 |
| 适合作为当前主发版产物 | 是 | 暂不建议直接主推 |

## 当前建议

在没有进一步产品决策前，建议保持：

- `Installer` 作为默认对外发布产物
- `Portable Zip` 仅保留为评估项，不默认承诺

原因：

- DeskHub 依赖 SQLite、本地数据工具与备份恢复，用户更需要清晰稳定的安装与数据目录预期
- Portable Zip 会带来更多“数据放哪里、是否可直接覆盖升级、是否能多份并存”的支持成本
- 当前项目主线仍在 Windows First 的功能稳态阶段，先把 installer 体验、发布素材和升级说明打磨完整更划算

## 如果将来要支持 Portable Zip，需要先补齐的条件

- 明确 Zip 版的数据目录策略与用户文案
- 明确 Zip 覆盖升级是否被正式支持
- 明确 Zip 与 Installer 是否允许共存，以及冲突时如何提示
- 明确 Release 页面下载说明、升级须知和故障排查文案
- 补一轮真实 smoke test，确认 Zip 版不会引出新的路径或权限问题

## 元信息统一核对基线

每次准备发版时，建议至少核对下面这些字段：

- 应用名称：`DeskHub`
- 包版本：`package.json`
- Rust 版本：`src-tauri/Cargo.toml`
- Tauri 版本：`src-tauri/tauri.conf.json`
- 应用标识符：`com.realfeeling.deskhub`
- 主窗口标题：`DeskHub`
- Release 标题格式：`DeskHub vX.Y.Z`
- GitHub artifact 命名是否可读、可分辨平台

## 图标资产建议

当前仓库里已经存在：

- [`src-tauri/icons/icon.ico`](./src-tauri/icons/icon.ico)

后续如果进入真正的安装包视觉统一阶段，建议把图标资产补齐为一套明确矩阵，并记录来源文件与导出规格，避免每次发版前临时处理。

在那之前，`RELEASE.md` 应该把“图标、应用名称与元信息核对”保留为发版前 checklist，而不是假定已经彻底完成。

## 推荐推进顺序

建议把“安装包与发布资产打磨”继续拆成三步：

### 第一步：模板先齐

- 固定 screenshot shot list
- 固定 release notes 模板
- 固定升级须知模板
- 固定 smoke test 记录模板

### 第二步：元信息与视觉统一

- 统一图标资产
- 统一安装包名称、窗口标题、Release 标题文案
- 核对平台文案与权限提示

### 第三步：再决定是否给 Zip 正式席位

- 先做对比评估
- 再决定是否双产物长期并行
- 决定后再写进 `DECISIONS.md`

## 当前结论

本轮结论不是“已锁定双产物”，而是：

- 发布资产模板应该先落地
- 安装包元信息核对应该进入固定流程
- `Portable Zip` 还需要在更明确的产品和运维预期下再拍板
