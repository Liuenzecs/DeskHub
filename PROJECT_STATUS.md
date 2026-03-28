# DeskHub Project Status

最后更新：2026-03-28

## 当前阶段

DeskHub 当前处于 `V2.1` 的稳定增强阶段。

这一阶段的核心目标已经不是“从 0 到 1 搭起来”，而是把已经成型的桌面控制台继续做厚、做稳、做成可长期维护的本地应用底座。

当前主线重点有两条：

- 把参考图风格的高密度工具控制台继续打磨成真正高频可用的工作台
- 把 SQLite、launcher、数据工具和跨平台抽象继续收敛成更正式的桌面应用基础设施

## 本轮完成

### Q. 跨平台 launcher 预研已完成

- 已补齐 [`src-tauri/src/platform_launcher.rs`](./src-tauri/src/platform_launcher.rs) 的 `macOS / Linux` 启动 backend
- Windows 仍然是当前最完整实现，但 `macOS / Linux` 已不再只是 `unsupported` 占位
- Linux 的 opener fallback 与 terminal fallback 已明确
- 已新增 [`PLATFORM_SUPPORT.md`](./PLATFORM_SUPPORT.md) 记录平台能力矩阵与当前边界

### R. 中长期产品方向第一阶段已完成

- 总览布局已新增预设：
  - `均衡`
  - `专注启动`
  - `流程优先`
  - `资源盘点`
- 总览区块顺序与显隐已持久化
- 数据工具已新增“项目目录半自动导入”链路：
  - 选择工作区目录
  - 扫描根目录与一级子目录
  - 识别可导入项目
  - 跳过已存在项目
  - 批量导入为 `project` 条目
- 项目识别能力已从单纯 `package.json / Cargo.toml` 扩展到更多常见项目线索
- workflow 模板库已继续扩充，补入更贴近日常开发的模板

### T. 浏览器收藏夹半自动导入已完成

- 数据工具已新增 Windows First 的 Chrome / Edge 收藏夹扫描与导入链路
- 扫描结果支持展示来源 profile、书签路径、已存在网址标记与批量选择导入
- 导入会把收藏夹条目落为 `url` 类型，并跳过已存在网址、保留来源信息到描述与标签
- 数据工具历史已补齐 `import_bookmarks` 记录，便于回溯导入结果
- 本轮改动文件：
  - [`src-tauri/src/bookmark_importer.rs`](./src-tauri/src/bookmark_importer.rs)
  - [`src-tauri/src/models.rs`](./src-tauri/src/models.rs)
  - [`src-tauri/src/commands.rs`](./src-tauri/src/commands.rs)
  - [`src-tauri/src/main.rs`](./src-tauri/src/main.rs)
  - [`src-tauri/src/storage.rs`](./src-tauri/src/storage.rs)
  - [`src/types/items.ts`](./src/types/items.ts)
  - [`src/lib/tauri.ts`](./src/lib/tauri.ts)
  - [`src/app/items-context.ts`](./src/app/items-context.ts)
  - [`src/app/ItemsContext.tsx`](./src/app/ItemsContext.tsx)
  - [`src/components/BrowserBookmarkImportModal.tsx`](./src/components/BrowserBookmarkImportModal.tsx)
  - [`src/components/DataToolsModal.tsx`](./src/components/DataToolsModal.tsx)
  - [`src/components/DataToolsModal.test.tsx`](./src/components/DataToolsModal.test.tsx)
  - [`src/app/AppRouter.test.tsx`](./src/app/AppRouter.test.tsx)
  - [`src/app/ItemsContext.test.tsx`](./src/app/ItemsContext.test.tsx)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### U. 项目目录导入第二阶段已完成

- 项目目录扫描已升级为 `1-4` 级递归扫描，并支持忽略规则
- 数据工具已支持 `skip_existing / refresh_existing` 两种冲突策略
- `refresh_existing` 会刷新已有 `project` 条目的名称、描述、标签、路径、启动命令与 `updatedAt`
- `refresh_existing` 会保留已有条目的 `id / favorite / icon / createdAt / lastLaunchedAt`
- 数据工具已记住最近扫描目录、扫描深度、忽略规则与冲突策略
- 项目导入预览已展示相对路径、深度、过滤目录数与冲突提示
- 本轮改动文件：
  - [`src-tauri/src/models.rs`](./src-tauri/src/models.rs)
  - [`src-tauri/src/commands.rs`](./src-tauri/src/commands.rs)
  - [`src-tauri/src/project_inspector.rs`](./src-tauri/src/project_inspector.rs)
  - [`src-tauri/src/storage.rs`](./src-tauri/src/storage.rs)
  - [`src/types/items.ts`](./src/types/items.ts)
  - [`src/lib/tauri.ts`](./src/lib/tauri.ts)
  - [`src/app/items-context.ts`](./src/app/items-context.ts)
  - [`src/app/ItemsContext.tsx`](./src/app/ItemsContext.tsx)
  - [`src/components/DataToolsModal.tsx`](./src/components/DataToolsModal.tsx)
  - [`src/components/ProjectDirectoryImportModal.tsx`](./src/components/ProjectDirectoryImportModal.tsx)
  - [`src/components/DataToolsModal.test.tsx`](./src/components/DataToolsModal.test.tsx)
  - [`src/components/ItemFormModal.test.tsx`](./src/components/ItemFormModal.test.tsx)
  - [`src/app/AppRouter.test.tsx`](./src/app/AppRouter.test.tsx)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### V. 总览布局继续产品化已完成

- 总览布局已支持“保存为命名模板”，并持久化到 SQLite `app_settings`
- 总览布局 modal 已支持：
  - 应用内置预设
  - 保存当前布局为命名模板
  - 删除已保存模板
  - 直接应用已保存模板
- 新增默认工作流联动策略：
  - `保持手动布局`
  - `有默认工作流时自动置顶工作流区块`
- 当默认工作流联动开启时：
  - `workflows` 区块会自动显示
  - `workflows` 区块会被提到总览首位
- 总览页头部已展示：
  - 当前布局名称
  - 当前联动策略
  - 默认工作流状态
  - 直接执行默认工作流入口
- 本轮改动文件：
  - [`src/types/items.ts`](./src/types/items.ts)
  - [`src/lib/overview-layout.ts`](./src/lib/overview-layout.ts)
  - [`src/components/OverviewLayoutModal.tsx`](./src/components/OverviewLayoutModal.tsx)
  - [`src/pages/OverviewPage.tsx`](./src/pages/OverviewPage.tsx)
  - [`src/app/ItemsContext.tsx`](./src/app/ItemsContext.tsx)
  - [`src/app/AppRouter.test.tsx`](./src/app/AppRouter.test.tsx)
  - [`src/app/ItemsContext.test.tsx`](./src/app/ItemsContext.test.tsx)
  - [`src/components/DataToolsModal.test.tsx`](./src/components/DataToolsModal.test.tsx)
  - [`src/components/ItemFormModal.test.tsx`](./src/components/ItemFormModal.test.tsx)
  - [`src-tauri/src/models.rs`](./src-tauri/src/models.rs)
  - [`src-tauri/src/storage.rs`](./src-tauri/src/storage.rs)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### W. 命令面板继续强化已完成

- 命令面板动作入口继续扩展，现已支持直接执行：
  - 数据工具
  - 清空最近使用
  - 清空命令历史
  - starter template 新建
  - workflow template 新建
- `route / action / item` 的搜索排序与分组展示已打通：
  - 分组顺序跟随实际排序结果
  - 不再被固定 `条目 / 导航 / 动作` 顺序抵消权重调优
- 最近命令学习能力继续增强：
  - 更强的 `useCount + lastUsedAt` 加权
  - 清理类动作可被历史学习正确拉升
- scoped query 的高亮与命中提示已统一基于去 scope 后的 `raw query`
- 搜索结果文案已进一步压缩统一：
  - `导航 · 页面`
  - `动作 · ...`
  - `模板 · ...`
- `clear_command_history` 已特判为“不回写自身”，避免刚清空又立刻生成一条新的历史
- 本轮改动文件：
  - [`src/types/items.ts`](./src/types/items.ts)
  - [`src/lib/command-palette.ts`](./src/lib/command-palette.ts)
  - [`src/components/CommandPalette.tsx`](./src/components/CommandPalette.tsx)
  - [`src/app/AppLayout.tsx`](./src/app/AppLayout.tsx)
  - [`src/lib/command-palette.test.ts`](./src/lib/command-palette.test.ts)
  - [`src/app/AppRouter.test.tsx`](./src/app/AppRouter.test.tsx)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### X. 性能与包体继续收敛第一阶段已完成

- 搜索底层已从“静态同步引入 `pinyin-pro`”切到“原始搜索同步 + 拼音 runtime 延迟加载”
- `ItemsProvider` 现在会在 idle 时同时做两件事：
  - 预热条目搜索索引
  - 预热拼音搜索 runtime
- `AppLayout` 已新增 command palette idle 预热：
  - 提前拉起命令面板模块
  - 提前构建 route / action / item 的 prepared entries
- 资源页搜索与命令面板都已接入 runtime 订阅：
  - 当拼音 runtime 就绪时会自动重算结果
  - 不需要用户手动关闭重开页面或面板
- 搜索缓存已支持“先建 raw，再补 pinyin / initials”的渐进式补全
- 新增搜索底层测试，覆盖：
  - runtime 未就绪时 raw 搜索仍正常
  - runtime 就绪后缓存索引可直接支持拼音 / 首字母匹配
- 本轮构建观察：
  - `search-vendor` 仍为独立 chunk，当前体积约 `286.77 kB / gzip 141.44 kB`
  - 但它已不再是资源页搜索的同步阻塞依赖
  - 主入口 `index` 当前约 `41.91 kB / gzip 11.35 kB`
- 本轮改动文件：
  - [`src/lib/search-index.ts`](./src/lib/search-index.ts)
  - [`src/lib/search-index.test.ts`](./src/lib/search-index.test.ts)
  - [`src/lib/command-history.ts`](./src/lib/command-history.ts)
  - [`src/lib/idle.ts`](./src/lib/idle.ts)
  - [`src/hooks/useSearchRuntime.ts`](./src/hooks/useSearchRuntime.ts)
  - [`src/hooks/useSearch.ts`](./src/hooks/useSearch.ts)
  - [`src/components/CommandPalette.tsx`](./src/components/CommandPalette.tsx)
  - [`src/app/AppLayout.tsx`](./src/app/AppLayout.tsx)
  - [`src/app/ItemsContext.tsx`](./src/app/ItemsContext.tsx)
  - [`src/lib/command-palette.ts`](./src/lib/command-palette.ts)
  - [`src/lib/command-palette.test.ts`](./src/lib/command-palette.test.ts)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### Y. 搜索结果缓存与压力基线已完成

- 条目搜索结果已补齐结果级缓存：
  - 继续按 `items` 数组引用复用
  - cache key 已纳入 `search runtime version`
  - 避免拼音 runtime 就绪前后的旧结果串用
- 命令面板的 `prepared entries` 已补齐按 `items + defaultWorkflowId` 的引用级缓存
- 命令面板 `search results / quick view` 的 `WeakMap` 缓存结构已整理清晰，避免后续继续扩展时出现隐式脏缓存
- 最近使用页已把待搜索数组改为 `useMemo` 稳定引用，开始真正吃到结果级缓存收益
- 已补齐 synthetic 大数据量测试，覆盖：
  - 条目搜索重复查询复用同一结果引用
  - 命令面板 prepared entries / 搜索结果 / quick view 的缓存复用
  - 较大条目集下的搜索正确性基线
- 本轮构建观察：
  - `search-vendor` 已从约 `286.77 kB / gzip 141.44 kB` 小幅收敛到约 `286.59 kB / gzip 141.24 kB`
  - 通过本地 transliteration wrapper 只暴露 `pinyin` 后，证明 namespace dynamic import 这条线仍有一点点可挖空间
  - 但这一轮主要收敛的仍然是查询时延与缓存命中，不是 chunk 体积本身
- 本轮改动文件：
  - [`src/lib/item-utils.ts`](./src/lib/item-utils.ts)
  - [`src/lib/search-index.ts`](./src/lib/search-index.ts)
  - [`src/lib/search-transliteration-runtime.ts`](./src/lib/search-transliteration-runtime.ts)
  - [`src/lib/command-palette.ts`](./src/lib/command-palette.ts)
  - [`src/lib/command-palette.test.ts`](./src/lib/command-palette.test.ts)
  - [`src/lib/item-utils.test.ts`](./src/lib/item-utils.test.ts)
  - [`src/pages/RecentPage.tsx`](./src/pages/RecentPage.tsx)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### Z. 命令面板空查询预热与滚动/多选压力基线已完成

- `AppLayout` 的 idle 预热已从“只建 prepared entries”推进到“连空查询 quick view 一起预热”
- 新增 `warmCommandPalette(items, commandHistory, defaultWorkflowId)`，统一复用：
  - prepared entries 缓存
  - quick view 缓存
  - 空库场景下的 route / action 入口预热
- 新增组件/Hook 级压力测试，覆盖：
  - `VirtualList` 在大列表下只挂载可视窗口，并能随滚动推进渲染窗口
  - `useSelectionController` 在大集合下的全选、筛选收缩与 shift range 选择行为
- 本轮构建观察：
  - `search-vendor` 体积维持在约 `286.59 kB / gzip 141.24 kB`
  - 本轮主要收敛的是首开空查询路径与滚动/多选压力验证，不是继续压缩 chunk 体积
- 本轮改动文件：
  - [`src/lib/command-palette.ts`](./src/lib/command-palette.ts)
  - [`src/app/AppLayout.tsx`](./src/app/AppLayout.tsx)
  - [`src/lib/command-palette.test.ts`](./src/lib/command-palette.test.ts)
  - [`src/components/VirtualList.test.tsx`](./src/components/VirtualList.test.tsx)
  - [`src/hooks/useSelectionController.test.tsx`](./src/hooks/useSelectionController.test.tsx)
- 本轮验证：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### AA. 跨平台 CI 编译校验已完成

- GitHub Actions 已新增 `platform-compile` job，覆盖：
  - `ubuntu-latest`
  - `macos-latest`
- Linux runner 已按 Tauri v2 prerequisites 补齐 Rust backend 编译所需系统依赖
- 当前跨平台 CI 范围先收敛为：
  - `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
  - 目标是尽早发现编译/链接回归，而不是直接扩成完整打包流水线
- 本轮改动文件：
  - [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- 本轮验证：
  - `python` 解析 `.github/workflows/ci.yml` 成功
  - 本地现有验证链仍通过：
    - `npm run lint`
    - `npm run test:run`
    - `npm run build`
    - `cargo test --manifest-path src-tauri/Cargo.toml`

### AB. 平台特定 launcher 测试已完成

- `platform_launcher.rs` 已新增 `macOS / Linux` 平台语义回归测试，覆盖：
  - macOS Terminal AppleScript 命令拼接与转义
  - Linux opener fallback 优先级
  - Linux terminal launcher 优先级
  - Linux 新终端命令参数拼接
- 为保证这些测试稳定可测，已把少量内部 helper 收敛为 `pub(super)` 可见性
- `PLATFORM_SUPPORT.md` 已同步更新，明确：
  - `macOS / Linux` 现在不仅有 backend 和 CI 编译校验
  - 关键 launcher 语义也已有 Rust 单测覆盖
- 本轮改动文件：
  - [`src-tauri/src/platform_launcher.rs`](./src-tauri/src/platform_launcher.rs)
  - [`PLATFORM_SUPPORT.md`](./PLATFORM_SUPPORT.md)
- 本轮验证：
  - `cargo test --manifest-path src-tauri/Cargo.toml platform_launcher`
  - `cargo test --manifest-path src-tauri/Cargo.toml launcher`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

### AC. 发布资产模板第一阶段已完成

- 已新增 [`RELEASE_ASSET_TEMPLATES.md`](./RELEASE_ASSET_TEMPLATES.md)，固定沉淀：
  - release 截图 shot list
  - GitHub Release 文案模板
  - 升级须知模板
  - release smoke test 记录模板
- [`RELEASE.md`](./RELEASE.md) 已把这些模板接入到正式发版 checklist
- [`README.md`](./README.md) 文档地图已补齐发布资产模板入口
- 本轮改动文件：
  - [`RELEASE_ASSET_TEMPLATES.md`](./RELEASE_ASSET_TEMPLATES.md)
  - [`RELEASE.md`](./RELEASE.md)
  - [`README.md`](./README.md)
  - [`CHANGELOG.md`](./CHANGELOG.md)
- 本轮验证：
  - `npm run lint`

### AD. 安装包产物策略评估已完成

- 已新增 [`PACKAGING_STRATEGY.md`](./PACKAGING_STRATEGY.md)
- 已形成 installer 与 portable zip 的对比矩阵、前置条件与元信息核对基线
- 当前明确：
  - 先把 installer 继续作为默认发版路径
  - portable zip 先保留在评估状态，不写成已承诺能力
- [`DECISIONS.md`](./DECISIONS.md) 已补记“模板先行、双产物暂不锁定”的当前决策
- 本轮改动文件：
  - [`PACKAGING_STRATEGY.md`](./PACKAGING_STRATEGY.md)
  - [`RELEASE.md`](./RELEASE.md)
  - [`DECISIONS.md`](./DECISIONS.md)
  - [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
- 本轮验证：
  - `npm run lint`

### AE. 首版真实 release 素材已完成

- 已新增浏览器演示态 capture 链路，可在非 Tauri 环境下通过 `?demo=release-assets` 稳定复现首版发版画面
- 已生成首版真实素材草案目录 [`release-assets/first-release-draft`](./release-assets/first-release-draft)，包含：
  - 6 张真实 release 截图
  - [`RELEASE_NOTES.md`](./release-assets/first-release-draft/RELEASE_NOTES.md)
  - [`UPGRADE_NOTES.md`](./release-assets/first-release-draft/UPGRADE_NOTES.md)
  - [`README.md`](./release-assets/first-release-draft/README.md)
- 截图生成流程已脚本化，避免继续依赖手工摆拍；截图入口与命令面板/数据工具/列表筛选状态均可通过 URL capture 参数稳定控制
- [`README.md`](./README.md)、[`RELEASE.md`](./RELEASE.md)、[`CHANGELOG.md`](./CHANGELOG.md) 已同步接入首版真实素材入口
- 本轮改动文件：
  - [`src/lib/release-demo-data.ts`](./src/lib/release-demo-data.ts)
  - [`src/lib/release-demo.ts`](./src/lib/release-demo.ts)
  - [`src/lib/release-demo.test.ts`](./src/lib/release-demo.test.ts)
  - [`src/app/ItemsContext.tsx`](./src/app/ItemsContext.tsx)
  - [`src/app/AppLayout.tsx`](./src/app/AppLayout.tsx)
  - [`src/components/CommandPalette.tsx`](./src/components/CommandPalette.tsx)
  - [`src/pages/ResourcePage.tsx`](./src/pages/ResourcePage.tsx)
  - [`src/pages/WorkflowsPage.tsx`](./src/pages/WorkflowsPage.tsx)
  - [`src/hooks/usePersistedListControls.ts`](./src/hooks/usePersistedListControls.ts)
  - [`src/app/AppRouter.test.tsx`](./src/app/AppRouter.test.tsx)
  - [`scripts/generate-release-assets.mjs`](./scripts/generate-release-assets.mjs)
  - [`package.json`](./package.json)
  - [`release-assets/first-release-draft/README.md`](./release-assets/first-release-draft/README.md)
  - [`release-assets/first-release-draft/RELEASE_NOTES.md`](./release-assets/first-release-draft/RELEASE_NOTES.md)
  - [`release-assets/first-release-draft/UPGRADE_NOTES.md`](./release-assets/first-release-draft/UPGRADE_NOTES.md)
  - [`release-assets/first-release-draft/screenshots/01-overview.png`](./release-assets/first-release-draft/screenshots/01-overview.png)
  - [`release-assets/first-release-draft/screenshots/02-command-palette-empty.png`](./release-assets/first-release-draft/screenshots/02-command-palette-empty.png)
  - [`release-assets/first-release-draft/screenshots/03-command-palette-workflow-search.png`](./release-assets/first-release-draft/screenshots/03-command-palette-workflow-search.png)
  - [`release-assets/first-release-draft/screenshots/04-projects-page.png`](./release-assets/first-release-draft/screenshots/04-projects-page.png)
  - [`release-assets/first-release-draft/screenshots/05-workflows-page.png`](./release-assets/first-release-draft/screenshots/05-workflows-page.png)
  - [`release-assets/first-release-draft/screenshots/06-data-tools.png`](./release-assets/first-release-draft/screenshots/06-data-tools.png)
  - [`README.md`](./README.md)
  - [`RELEASE.md`](./RELEASE.md)
  - [`CHANGELOG.md`](./CHANGELOG.md)
- 本轮验证：
  - `npm run build`
  - `npm run release:shots`
  - `npm run test:run -- --maxWorkers 1 src/app/AppRouter.test.tsx src/lib/release-demo.test.ts`

### AF. 性能与包体继续收敛第二阶段第一批已完成

- 搜索 runtime 拉起边界已继续收紧：`useSearchRuntime` 现在只在拉丁查询下主动加载 transliteration runtime，不再对所有非空查询都拉起重模块
- 命令面板 idle 预热已补上预算控制：仅预热最近 `8` 条命令历史，避免重库场景下的过度预热
- 已新增 [`scripts/report-bundle-stats.mjs`](./scripts/report-bundle-stats.mjs) 与 [`PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md)，形成当前构建体积基线
- 当前基线显示：
  - `search-vendor` 约 `280 kB / gzip 138 kB`
  - 主入口 `index` 约 `50.4 kB / gzip 13.8 kB`
  - `DataToolsModal` 约 `55.2 kB / gzip 11.6 kB`
- 本轮改动文件：
  - [`src/hooks/useSearchRuntime.ts`](./src/hooks/useSearchRuntime.ts)
  - [`src/hooks/useSearchRuntime.test.tsx`](./src/hooks/useSearchRuntime.test.tsx)
  - [`src/lib/search-index.ts`](./src/lib/search-index.ts)
  - [`src/app/AppLayout.tsx`](./src/app/AppLayout.tsx)
  - [`scripts/report-bundle-stats.mjs`](./scripts/report-bundle-stats.mjs)
  - [`package.json`](./package.json)
  - [`PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md)
- 本轮验证：
  - `npm run build`
  - `npm run perf:report`
  - `npm run test:run -- --maxWorkers 1 src/app/AppRouter.test.tsx src/hooks/useSearchRuntime.test.tsx src/lib/release-demo.test.ts`

## 当前技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 桌面壳：Tauri v2
- 后端：Rust
- 正式存储：SQLite
- 搜索增强：`pinyin-pro`
- 原生路径选择：`tauri-plugin-dialog`

## 当前验证状态

本轮已通过：

- `npm run lint`
- `npm run build`
- `npm run perf:report`
- `npm run release:shots`
- `npm run test:run -- --maxWorkers 1 src/app/AppRouter.test.tsx src/hooks/useSearchRuntime.test.tsx src/lib/release-demo.test.ts`

本轮未重新执行：

- `cargo test --manifest-path src-tauri/Cargo.toml`

当前已知验证边界：

- 默认 worker 下的 `npm run test:run -- 文件列表` 在当前环境仍偶发异常退出；串行 `--maxWorkers 1` 的本轮定向测试已稳定通过
- 全量 `npm run test:run` 在当前环境下仍有 Vitest worker / 超时不稳定现象，本轮不记为稳定全绿

## COMPLETED

### A. 启动器与系统执行

- `app / project / folder / url / script / workflow` 主链路可用
- `blocking / new_terminal / background` 三种执行模式已落地
- Windows 命令执行已统一通过临时脚本规整 quoting
- `.lnk / .cmd / .bat / .ps1` 等常见入口已补齐

### B. 前端性能与分包

- 路由级 lazy load 已完成
- 重型弹层已拆成懒加载
- 搜索索引预计算与缓存复用已接入

### C. 命令面板进化

- 已支持 `item / route / action` 三类统一结果
- 已支持中文 / 拼音 / 首字母搜索
- 已支持 scoped query：`app:` `project:` `workflow:` `route:` `action:`
- 已支持最近命令、收藏优先与默认工作流动作

### D. 管理页能力增强

- 类型页与工作流页已支持排序、标签筛选与选择模式
- 已支持批量收藏 / 取消收藏 / 删除 / 导出
- 最近使用页已支持“清空最近使用”

### E. 工作流系统升级

- workflow 已支持变量、条件、失败策略、重试与执行摘要
- workflow 支持从任意步骤开始执行
- workflow 卡片已展示步骤链预览

### F. 录入与表单体验

- `app / project / folder / workflow open_path` 已支持原生路径选择
- 项目目录可自动识别名称与建议命令
- URL 即时校验、标签 chips、图标选择器、草稿恢复已接入

### G. 数据层与可靠性

- SQLite schema 已升级到 `v6`
- migration runner 已拆分并覆盖多版本升级
- 健康检查、恢复副本、JSON 导入导出、数据库备份恢复已完成

### H. 数据工具体验

- 数据库备份 / 恢复 / 导入 / 导出 / 预检 / 健康检查 / 一致性检查 / 优化 已可用
- 数据工具历史已持久化
- 结构化报告与错误列表导出已接入

### I. UI / 视觉打磨

- 已统一为高密度“桌面控制台”风格
- 卡片 hover、顶部搜索、一键上班模式与整体 token 已统一
- 空状态、modal、hover 动作与列表层级已收敛

### J. 键盘与可访问性

- 主要 modal 已统一 focus trap / Esc / 初始焦点
- 命令面板已补齐 combobox 语义
- 多选快捷键已接入

### K. 测试与质量

- `AppRouter / ItemsContext / ItemFormModal / DataToolsModal / Rust storage / launcher` 的关键链路已覆盖
- 本地整体验证命令链路可跑通

### L. 大列表性能与搜索优化

- 资源页 / 最近页已接入虚拟列表
- `useSearch` 与命令面板搜索已统一底层搜索能力

### M. 工作流参数化与执行摘要

- workflow 变量、默认值、必填校验与启动前输入已落地
- 启动后会回传执行摘要、实际变量与步骤结果

### N. 录入体验继续增强

- 项目目录识别已升级为多候选命令建议
- 图标与标签输入体验已继续增强

### O. 数据层与运维深化

- migration runner 已独立为 [`migrations.rs`](./src-tauri/src/migrations.rs)
- 自动备份、保留策略、诊断模式与结构化报告已成型

### P. 发布工程

- 已建立 [`CHANGELOG.md`](./CHANGELOG.md)
- 已补齐 [`VERSIONING.md`](./VERSIONING.md) 与 [`RELEASE.md`](./RELEASE.md)
- 已新增 GitHub release workflow

### Q. 跨平台 launcher 预研

- 平台启动抽象层已建立
- Windows / macOS / Linux 启动 backend 已接入
- 平台能力矩阵与 fallback 策略已有文档化说明

### R. 中长期方向第一阶段

- 总览布局预设模板
- 总览区块个性化持久化
- starter templates 与 workflow templates 扩充
- 项目目录半自动导入第一阶段

### S. 工作流流程控制深化

- `run_command` 已支持 `stop / continue / retry`
- step 级条件判断、跳转、重试次数与间隔已落地
- 工作流执行结果已包含 warning / retry / jump / failure 上下文

### T. 浏览器收藏夹半自动导入

- 已落地 Windows First 的 Chrome / Edge 收藏夹扫描、预览选择与导入链路
- 已支持标记已存在网址、导入时自动跳过重复 URL，并保留来源浏览器 / profile / 文件夹信息
- 数据工具历史已补齐 `import_bookmarks` 结果记录与错误回溯

### U. 项目目录导入第二阶段

- 已支持 `1-4` 级项目目录递归扫描
- 已支持默认忽略规则与自定义过滤规则
- 已支持 `skip_existing / refresh_existing` 冲突策略
- 已支持记住最近工作区与导入偏好
- 扫描预览已展示相对路径、深度、过滤目录数与刷新提示

### V. 总览布局继续产品化

- 已支持命名总览布局模板并持久化到 SQLite 设置
- 已支持在总览布局 modal 中应用、保存、删除布局模板
- 已支持默认工作流联动策略，并在联动开启时自动优先展示工作流区块
- 总览页已展示当前布局、联动状态与默认工作流快捷入口

### W. 命令面板继续强化

- 已补充数据工具、清理动作与模板动作的更多快捷入口
- 已补强最近命令学习能力与 route / action / item 排序调优
- 已统一 scoped query 的高亮、命中提示与结果说明文案
- `clear_command_history` 已避免“清空后立刻把自己重新写回历史”的反直觉行为

### X. 性能与包体继续收敛第一阶段

- 已把拼音搜索 runtime 从静态同步依赖改成 idle / 查询触发的延迟加载
- 已把 command palette 模块与 prepared entries 纳入 idle 预热
- 资源页搜索与命令面板都会在 runtime 就绪后自动重算结果
- 已补齐搜索底层渐进式缓存与对应测试覆盖

### Y. 搜索结果缓存与压力基线

- 已补齐条目搜索结果缓存与 runtime-version 隔离
- 已补齐命令面板 prepared entries / 搜索结果 / quick view 的引用级缓存
- 最近使用页已稳定输入数组引用，开始真正复用结果缓存
- 已补齐 synthetic 大数据量搜索测试，形成后续性能回归基线

### Z. 命令面板空查询预热与滚动/多选压力基线

- 已把命令面板 idle 预热推进到空查询 quick view
- 已让空库场景也能预热 route / action 入口
- 已补齐 `VirtualList / useSelectionController` 的大集合压力基线测试

### AA. 跨平台 CI 编译校验

- 已在 GitHub Actions 中补齐 `macOS / Linux` Rust backend 编译校验
- Linux runner 依赖已按 Tauri v2 官方 prerequisites 补齐
- 当前范围先收敛到 `cargo test --no-run`

### AB. 平台特定 launcher 测试

- 已补齐 `macOS Terminal AppleScript / Linux opener fallback / Linux terminal launcher` 的关键语义测试
- `PLATFORM_SUPPORT.md` 已同步到“backend + CI 编译校验 + launcher 单测”状态

### AC. 发布资产模板第一阶段

- 已沉淀 release 截图、更新说明、升级须知与 smoke test 模板
- `RELEASE.md` 与 `README.md` 已接入文档入口，发版流程不再只靠临时整理素材

### AD. 安装包产物策略评估

- 已形成 installer / portable zip 对比矩阵与元信息核对基线
- 当前只锁定“先评估、不把双产物写成已承诺能力”，尚未最终拍板长期双产物策略

### AE. 首版真实 release 素材

- 已生成首版真实截图、更新说明与升级须知草案
- 已建立浏览器 demo capture 链路与自动截图脚本，发版素材可重复生成
- `README.md / RELEASE.md / CHANGELOG.md` 已接入真实素材入口

### AF. 性能与包体继续收敛第二阶段第一批

- transliteration runtime 主动加载边界已收紧到拉丁查询与有限 idle 预热
- 命令面板 idle 预热只取最近 8 条命令历史，减少过度预热
- 已形成新的包体基线文档，后续第二阶段可以继续围绕 `search-vendor` 与页面级 profiling 深挖

## NEXT

下面保留的是仍值得继续推进、但尚未完成的真实后续方向。

### 1. 空间 / 分组信息架构

- 条目分组 / 空间
- 空间隔离与跨空间搜索
- 默认视角、默认空间与空间级筛选规则
- 这一项会直接影响信息架构，必须谨慎推进

### 2. 性能与包体继续收敛第二阶段

- 继续压缩 `search-vendor` 本身体积，而不只是延迟加载
- 在已有底层压力基线之上，继续补页面级 profiling 与更贴近真实使用的筛选/批量操作链路观测
- 继续评估 command palette / 资源页是否还有值得进入 idle 的预热边界，避免过度预热

### 3. 跨平台工程化

- 安装包、权限表现与平台文案的一致化

### 4. 安装包与发布资产打磨

- 安装包图标、应用名称与元信息统一
- 把 [`release-assets/first-release-draft`](./release-assets/first-release-draft) 收口到具体版本目录，并补正式 smoke test 记录
- 如要提供 portable zip，先补齐数据目录、升级与共存语义后再做正式决策

## 当前已知优化点

- `search-vendor` 已从同步依赖链里解耦，但体积本身仍然偏大，后续还有继续压缩空间
- 搜索结果缓存、空查询 quick view 预热、主动加载边界收紧和体积基线文档已经补上，但距离“第二阶段完成”还差页面级 profiling 与 chunk 体积继续收缩
- “空间 / 分组”是下一个真正会影响信息架构的大项，不适合仓促落地
- 性能与包体已完成第一阶段，下一条最自然的主线是“性能与包体继续收敛第二阶段”
- macOS / Linux 已补上基础 backend、CI 编译校验与 launcher 单测，但还没有做完整平台回归与产品化对齐
- 首版 release 素材已经有真实截图和文案草案，接下来主要剩版本化归档、安装包元信息统一与正式 smoke test 证据沉淀
- Windows 环境下 `cargo test` 结束时偶发 incremental 目录“拒绝访问” warning，但当前不影响退出码与测试结果

## 暂不建议优先推进

- AI 功能
- 云同步
- 多用户
- 在线账号体系
- 复杂进程守护 / 日志面板
- macOS / Linux 全链路产品化适配
