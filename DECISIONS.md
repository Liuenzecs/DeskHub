# DeskHub Decisions Log

最后更新：2026-03-28

本文档记录已经锁定或已经在代码中落地的重要产品与技术决策，避免后续协作时重复讨论。

## D-001 参考图导航优先于早期三页草案

状态：已生效

决定：

- 不再以 `Home / All Items / Workflows` 三页结构作为主信息架构
- 采用参考图风格的内容类型导航

结果：

- 主导航固定为 `总览 / 应用 / 项目 / 网站 / 文件夹 / 脚本 / 工作流 / 最近使用`
- `/` 固定重定向到 `/overview`

## D-002 运行时正式存储统一使用 SQLite

状态：已生效

决定：

- 正式数据层统一使用 SQLite
- 不再使用 JSON 作为运行时主存储

结果：

- 数据库文件位于 `<appDataDir>/data/deskhub.db`
- 默认工作流、命令历史、数据工具历史与 UI 设置统一进入 SQLite

## D-003 旧 JSON 不迁移、不提示、不自动删除

状态：已生效

决定：

- 若本地存在旧 `items.json`
- 不自动导入
- 不提示迁移
- 不自动删除

结果：

- SQLite 从空库或现有库启动
- 旧 JSON 只作为历史残留文件保留

## D-004 系统操作与持久化统一归 Rust 后端

状态：已生效

决定：

- 前端不直接承担系统级启动逻辑
- 启动器、数据库、备份恢复、导入导出都由 Tauri Rust command 负责

结果：

- 前后端职责边界清晰
- 启动语义、存储语义、错误反馈可集中收敛

## D-005 命令面板是第一入口

状态：已生效

决定：

- `Ctrl+K / Cmd+K` 的命令面板是 DeskHub 第一入口
- 命令面板必须覆盖条目、路由、动作三类结果

结果：

- 命令面板承担“启动 / 跳转 / 新建 / 全局动作”四类高频入口
- 命令历史持久化到 SQLite

## D-006 中文搜索必须支持拼音和首字母

状态：已生效

决定：

- 中文搜索不仅支持原文，还支持完整拼音与拼音首字母
- 固定使用 `pinyin-pro`

结果：

- 条目搜索与命令面板都复用同一套预计算索引能力

## D-007 Windows 命令执行统一收敛到临时脚本

状态：已生效

决定：

- Windows 下 `blocking / new_terminal / background` 都不直接拼接原始命令字符串执行
- 统一先生成 UTF-16LE 临时 `.cmd` 脚本，再用 `cmd` 执行

结果：

- 复杂路径、空格路径和中文命令文件在 spawn 阶段更稳定
- `.cmd / .bat / .ps1` 文件入口也能被统一归一化处理

## D-008 script 与 workflow.run_command 支持三种执行模式

状态：已生效

决定：

- `script` 与 workflow `run_command` 支持：
  - `blocking`
  - `new_terminal`
  - `background`

结果：

- 新建脚本和新建命令步骤默认使用 `new_terminal`
- 历史数据通过 migration 回填为 `blocking`

## D-009 project.devCommand 暂不开放执行模式配置

状态：已生效

决定：

- `project.devCommand` 仍固定按“新终端运行”处理
- 本轮不把执行模式扩散到所有命令型字段

结果：

- 先保证 `script` 与 workflow 的通用命令体验完整
- 避免 scope 扩散

## D-010 数据工具属于高价值操作，必须有确认与结果回看

状态：已生效

决定：

- 恢复、导入、清空历史等危险操作必须二次确认
- 执行结果不只用 toast，必须在界面里可回看
- 数据工具历史要持久化

结果：

- Data Tools 更接近正式桌面应用，而不是一次性操作面板

## D-011 管理页控制状态需要可记忆

状态：已生效

决定：

- 资源页和工作流页的 `sortOption / selectedTags / selectionMode` 需要记住上次状态

结果：

- 使用 `deskhub:list-controls:${route}` 作为本地存储键
- 高频管理页不会每次进入都回到默认态

## D-012 workflow 的控制流能力放在 step 层实现

状态：已生效

决定：

- 条件判断、失败策略、重试与跳转都挂在 step 层
- 不引入独立的复杂流程编辑器

结果：

- 当前 workflow 已具备轻量但足够实用的控制流能力

## D-013 跨平台 launcher 抽象已经正式建立

状态：已生效

决定：

- 新增 [`src-tauri/src/platform_launcher.rs`](./src-tauri/src/platform_launcher.rs) 作为统一平台启动抽象
- 保持 `Windows First`，但不再把 `macOS / Linux` 留在永久占位状态

结果：

- Windows 仍是当前最完整实现
- macOS 已补上 `open`、Terminal 新终端、后台命令等基础 backend
- Linux 已补上 opener fallback、终端探测、新终端与后台命令 backend
- 详细能力矩阵沉淀到 [`PLATFORM_SUPPORT.md`](./PLATFORM_SUPPORT.md)

## D-014 总览布局个性化属于正式设置，而不是临时前端状态

状态：已生效

决定：

- 总览区块顺序与显隐状态进入 SQLite `app_settings`
- 不单独散落在前端本地存储

结果：

- `overviewSectionOrder / overviewHiddenSections` 成为正式 UI 设置
- 总览布局可跨重启保留

## D-015 starter templates 与 workflow templates 属于正式录入能力

状态：已生效

决定：

- 非 workflow 条目支持 starter templates
- workflow 继续扩充更贴近日常使用的模板集

结果：

- 高频录入更快
- 录入体验不再完全依赖手填

## D-016 R 的当前优先实现是总览预设与项目目录导入

状态：已生效

决定：

- 中长期产品方向在这一阶段先做“总览布局预设 + 项目目录半自动导入”
- 暂不先做会影响信息架构的“空间 / 分组”

结果：

- 已落地 `均衡 / 专注启动 / 流程优先 / 资源盘点` 四种总览预设
- 已落地项目目录扫描、识别、去重与批量导入链路

## D-017 空间 / 分组仍属于后续信息架构决策

状态：待后续产品决策

决定：

- 空间、分组、跨空间搜索这类能力暂不在当前轮次直接实现
- 等待更明确的产品信息架构方案后再推进

结果：

- 当前文档会把它们保留在 `PROJECT_STATUS.md` 的后续方向中
- 现阶段优先把已落地的控制台能力打磨稳定

## D-018 项目目录导入第二阶段采用“有限深度扫描 + 显式冲突策略”

状态：已生效

决定：

- 项目目录扫描深度限制在 `1-4` 级，避免无限递归带来的性能和误扫风险
- 默认忽略规则固定包含 `.git / node_modules / target / dist / build / .next / .turbo / coverage / .venv / venv`
- 冲突策略固定支持 `skip_existing` 与 `refresh_existing`
- 默认冲突策略为 `skip_existing`
- 项目导入偏好只属于本地 UI 偏好，继续存放在前端 `localStorage`

结果：

- 数据工具现在可以在更深目录结构下扫描项目，同时保留性能边界
- `refresh_existing` 会刷新已有 `project` 的名称、描述、标签、路径、启动命令与 `updatedAt`
- `refresh_existing` 会保留已有条目的 `id / favorite / icon / createdAt / lastLaunchedAt`
- 最近扫描目录、扫描深度、忽略规则与冲突策略都会在下次打开数据工具时自动恢复

## D-019 总览布局第二阶段采用“正式模板 + 正式联动策略”

状态：已生效

决定：

- 总览布局不再只保存“当前顺序与显隐”，而是正式支持命名模板
- 命名模板继续作为正式设置进入 SQLite `app_settings`
- 不把总览模板散落到前端 `localStorage`

结果：

- 总览布局现在支持保存为命名模板、再次应用、删除模板
- “当前布局”不再只有“预设 / 自定义”两种语义，也能对应到用户自己的命名模板
- 总览布局个性化能力从一次性调序升级成可复用的正式配置

## D-020 默认工作流与总览布局的联动先收敛为两档

状态：已生效

决定：

- 默认工作流联动策略当前只保留两档：
  - `none`
  - `prioritize_workflows`
- `prioritize_workflows` 的语义固定为：
  - 自动显示 `workflows` 区块
  - 自动把 `workflows` 区块提到总览最前

结果：

- 联动规则足够明确，不会演变成难以理解的隐式多档布局魔法
- 总览页和顶部“一键上班模式”形成了统一语义：设置默认工作流后，总览也会更偏向工作流启动场景

## D-021 命令面板继续扩大动作覆盖面，但清空命令历史不回写自身

状态：已生效

决定：

- 命令面板继续作为 DeskHub 第一入口，新增直接动作：
  - 数据工具
  - 清空最近使用
  - 清空命令历史
  - starter templates 新建
  - workflow templates 新建
- 搜索结果分组顺序不再固定为 `item -> route -> action`，而是跟随实际排序结果，避免权重调优被固定分组顺序抵消
- scoped query 的高亮与命中提示统一基于去掉 scope 之后的 `raw query`
- `clear_command_history` 属于“清理历史”的自指动作，执行后不再把自己重新写回命令历史

结果：

- 命令面板现在更接近真正的一号入口，不需要先跳页面再做高频动作
- 模板录入、新建工作流、清理历史等操作都能直接从 palette 触发
- route / action / item 的排序调优终于能反映到分组展示顺序
- `action:`、`route:` 这类 scoped 搜索的高亮和匹配提示与实际搜索行为保持一致

## D-022 拼音搜索 runtime 改为延迟加载，但保持功能语义不变

状态：已生效

决定：

- 不移除 `pinyin-pro`，继续保持“中文 / 拼音 / 首字母”搜索能力
- 但 `pinyin-pro` 不再通过 `search-index` 静态进入页面同步依赖链
- 改为：
  - 原始文本搜索同步可用
  - 拼音 runtime 在 idle 时预热
  - 当用户输入拉丁字母搜索时也会主动拉起 runtime
  - runtime 就绪后由列表搜索和命令面板自动重新计算结果

结果：

- `search-vendor` 仍然是独立的大 chunk，但已从页面搜索的同步阻塞依赖中解耦
- 冷启动时先保证原始搜索响应，拼音能力在 idle / 首次拼音查询后补齐
- 已有搜索缓存会在 runtime 就绪后自动补全拼音与首字母索引，不需要丢弃重建
- 命令面板相关索引和模块也开始在 idle 阶段预热，第一入口的打开延迟进一步收敛

## D-023 搜索结果缓存与命令面板 prepared entries 继续按引用复用

状态：已生效

决定：

- 条目搜索结果继续按 `items` 数组引用做结果级缓存，并把搜索 runtime 版本纳入 cache key，避免拼音 runtime 就绪前后复用脏结果
- 命令面板的 `prepared entries` 也按 `items + defaultWorkflowId` 做引用级缓存
- quick view 与 palette 搜索结果继续按 `preparedEntries + commandHistory` 做 `WeakMap` 复用
- 最近使用页不再在 render 里重复创建待搜索数组，改为先 `useMemo` 稳定输入引用

结果：

- `AppLayout` 的 idle 预热现在不仅能预热底层搜索索引，也能真正复用命令面板的 prepared entries
- 命令面板首开和重复查询能吃到更多缓存收益，而不是只复用 search index
- 资源页、最近页、命令面板三条搜索链路的缓存命中条件更加一致
- 已新增 synthetic 大数据量测试，作为后续“性能与包体继续收敛第二阶段”的回归基线

## D-024 命令面板 idle 预热继续扩展到空查询 quick view，滚动与多选压测下沉到组件/Hook 层

状态：已生效

决定：

- `AppLayout` 的 idle 预热不再只构建 `prepared entries`
- 改为统一调用 `warmCommandPalette(items, commandHistory, defaultWorkflowId)`，把空查询 quick view 也提前算好
- 预热不再要求条目数大于 0，空库场景也允许提前准备 route / action 入口
- 大数据量滚动与多选压力验证优先放在更稳定的 `VirtualList / useSelectionController` 层，而不是继续堆整页集成测试

结果：

- 命令面板首次打开空查询视图时，可以更稳定地复用 idle 阶段已经准备好的 quick view
- 默认空库、轻库和重库三种场景的 palette 首开路径更加一致
- “滚动窗口推进”和“筛选后批量选择收缩”已有独立回归基线，后续做页面级 profiling 时不必再从 0 补底层验证

## D-025 跨平台工程化先从 GitHub Actions 的 macOS / Linux Rust 编译校验开始

状态：已生效

决定：

- “跨平台工程化”这一阶段先不直接承诺完整产品可用性
- 先在 GitHub Actions 中补齐 `macOS / Linux` 的 Rust backend 编译校验
- Linux runner 依赖按 Tauri v2 官方 prerequisites 补齐
- 当前校验范围先收敛到 `cargo test --no-run`，优先发现编译与链接问题，不把 scope 一次扩成完整打包流水线

结果：

- CI 现在除了 Windows 的整体验证链路外，还会额外在 `ubuntu-latest / macos-latest` 上做 Rust backend 编译校验
- 跨平台 launcher 的代码改动以后能更早暴露平台编译回归
- “平台编译可过”与“平台产品已完成适配”被明确区分，避免过早高估跨平台完成度

## D-026 平台特定 launcher 回归优先覆盖“选择逻辑”和“命令拼接语义”

状态：已生效

决定：

- `macOS / Linux` 的 launcher 测试这一轮优先覆盖最容易回归、也最适合单测的部分：
  - macOS Terminal AppleScript 拼接
  - Linux opener fallback 选择优先级
  - Linux terminal launcher 选择优先级
  - Linux 新终端命令参数拼接
- 测试下沉到 `platform_launcher.rs` 的 helper 层，不做依赖真实平台环境的脆弱集成测试
- 为此允许把少量内部 helper 提升到 `pub(super)`，但不对外暴露到 crate 边界之外

结果：

- 现在 `macOS / Linux` 的启动 backend 不再只有“能编译”，而是对核心平台语义有了明确回归保护
- 后续若改 terminal fallback 顺序、osascript 结构或 shell 参数拼接，Rust 单测会更早提示回归
- 跨平台工程化从“预研 + 编译校验”进一步推进到了“关键语义有测试基线”

## D-027 发布资产模板先行，双产物策略暂不锁定

状态：已生效

决定：

- 当前先补齐 release 截图、更新说明、升级须知和 smoke test 模板
- `installer / portable zip` 的双产物策略先进入评估文档，不直接写成已锁定承诺
- 在正式拍板前，不把 portable zip 当成默认对外发布能力

结果：

- 已新增 [`RELEASE_ASSET_TEMPLATES.md`](./RELEASE_ASSET_TEMPLATES.md) 作为可复用的发布素材模板
- 已新增 [`PACKAGING_STRATEGY.md`](./PACKAGING_STRATEGY.md) 记录 installer 与 portable zip 的对比和前置条件
- [`RELEASE.md`](./RELEASE.md) 现在会把发布资产模板与安装包策略评估纳入固定发版检查流程

## D-028 首版真实 release 素材采用浏览器 demo capture 固化

状态：已生效

决定：

- 首版对外 release 素材不再依赖临时手工摆拍
- 统一通过非 Tauri 浏览器环境下的 `?demo=release-assets` 演示态生成稳定画面
- 截图场景通过 URL capture 参数控制命令面板、数据工具、列表筛选与排序状态
- 使用脚本化 headless 截图流程批量产出 release 画面

结果：

- 已生成 [`release-assets/first-release-draft`](./release-assets/first-release-draft) 首版真实素材草案
- 首版截图、更新说明与升级须知现在都可以重复生成，而不是只存在一次性的手工成果
- capture 参数只在 demo 模式覆盖页面初始状态，不污染正常用户的本地持久化控制状态

## D-029 性能第二阶段先收紧 runtime 拉起边界与 idle 预热预算

状态：已生效

决定：

- transliteration runtime 继续保留，但只在拉丁查询下主动加载，不再对所有非空查询都拉起
- 命令面板 idle 预热继续保留，但只预热最近 `8` 条命令历史，避免重库场景过度预热
- 构建体积观察固定通过 `npm run perf:report` 生成 [`PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md)

结果：

- 搜索能力语义不变，但 `search-vendor` 的实际拉起时机进一步收紧
- 命令面板首开预热继续存在，同时把历史驱动的预热成本控制在有限预算内
- 后续“性能与包体继续收敛第二阶段”已有稳定的体积基线文档可对照，不再只靠零散 build 输出
