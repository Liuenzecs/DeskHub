# DeskHub Agents Guide

最后更新：2026-03-24

## 目标

DeskHub 是一个基于 `Tauri + React + TypeScript + Tailwind CSS + SQLite` 的桌面工作台，用来统一管理：

- 应用
- 项目
- 网站
- 文件夹
- 脚本
- 工作流

当前产品定位是“开发者/高频电脑用户的桌面控制台”，重点是：

- 搜索快
- 启动快
- 管理快
- 数据可靠

## 角色

### Product Owner

产品 owner 是仓库当前使用者。

职责：

- 决定产品方向与体验取舍
- 决定哪些功能进入当前版本
- 决定视觉参考和信息架构

### Implementation Agent

默认实现代理是 Codex 或其他协作型编码代理。

职责：

- 先阅读现有代码，再做改动
- 保持前后端模型一致
- 做完实现后自行运行验证
- 把关键架构变化补到文档

## 沟通约定

- 与用户的交流统一使用中文
- 不引入 AI 功能
- 不擅自拍板改动已经锁定的产品决策
- 当存在明显 tradeoff 时，优先记录到 `DECISIONS.md`

## 当前技术边界

- 平台优先级：Windows 第一
- 正式持久化：SQLite
- 旧 `items.json`：废弃、不迁移、不自动删除
- 系统启动与数据库读写：统一走 Tauri Rust 后端
- 前端不直接做系统级启动逻辑
- UI 不引入大型组件库，保持自定义 Tailwind 组件

## 当前信息架构

主导航固定为：

- 总览
- 应用
- 项目
- 网站
- 文件夹
- 脚本
- 工作流
- 最近使用

命令面板是第一入口，不是附属功能。

管理页的高频控制状态需要可记忆，不应每次进入页面都回到默认态。
命令面板应覆盖“启动 / 跳转 / 新建 / 全局动作”四类高频入口。

## 核心数据模型

### DeskItem 公共字段

- `id`
- `name`
- `type`
- `description`
- `tags`
- `icon`
- `favorite`
- `createdAt`
- `updatedAt`
- `lastLaunchedAt`

### 类型专属字段

- `app.launchTarget`
- `project.projectPath`
- `project.devCommand`
- `folder.path`
- `url.url`
- `script.command`
- `script.executionMode`
- `workflow.steps`

### WorkflowStep

- `open_path`
- `open_url`
- `run_command`

其中 `run_command` 额外包含：

- `executionMode`

### CommandExecutionMode

- `blocking`
- `new_terminal`
- `background`

## 当前后端职责

Rust 后端统一负责：

- SQLite 初始化与 migration
- 启动健康检查
- CRUD
- 批量收藏/删除
- 最近记录清空
- 默认工作流设置
- 命令历史记录
- JSON 导入导出
- 数据库备份恢复
- 应用/目录/网址/脚本/工作流启动
- Windows 命令执行脚本归一化与失败上下文返回

## 当前前端职责

前端统一负责：

- 路由与页面骨架
- 表单与校验
- 搜索与筛选
- 批量管理交互
- 管理页控制状态持久化
- 复制条目与工作流
- 命令面板
- 命令面板 scoped 搜索与全局新建入口
- 懒加载与分包策略落地
- toast 反馈
- 状态同步与 hydration

## UI 原则

- 参考 Raycast / Linear 风格的高密度工具控制台
- 不做 SaaS Dashboard 风格的大留白卡片
- Hover 才暴露次级操作
- Badge 要明确区分类型
- 工作流卡片必须展示步骤链
- Topbar 永远保留“一键上班模式”
- 命令面板要能覆盖高频入口，不只搜条目，也要能直达数据工具等全局动作
- 命令面板要允许用户通过简短语法快速缩小范围，例如 `app:`、`workflow:`、`action:`

## 开发原则

- 优先修底层一致性，再改 UI
- 先做可用，再做复杂抽象
- 同一能力的状态来源只能有一套
- 低频重模块优先懒加载，不默认进入首屏主包
- 备份、恢复、导入这类高价值操作必须有明确确认与结果反馈
- 复制属于正式管理动作，不是临时测试能力
- workflow 的复制与步骤复制都必须重建 step id，避免 SQLite 主键冲突
- Windows 下命令型启动逻辑优先统一收敛到临时脚本路径，不要回退到脆弱的原始字符串拼接
- 搜索优化优先选择“预计算 / 预热 / 缓存”，不要把高成本拼音计算压回输入时
- 新增字段时必须同时考虑：
  - Rust 模型
  - SQLite schema
  - 前端类型
  - 表单
  - 搜索
  - 测试

## 改动前检查清单

- 是否会影响已有 SQLite schema
- 是否需要 migration
- 是否会影响命令面板搜索权重
- 是否需要更新管理页本地持久化状态键或默认值
- 是否会影响默认工作流规则
- 是否会影响 Windows 启动语义
- 是否需要补测试
- 是否需要更新 `DECISIONS.md` 或 `PROJECT_STATUS.md`

## 验证命令

常用验证命令：

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `cargo test`
- `npm run tauri:build -- --debug`

## 文档维护规则

发生以下情况时应更新文档：

- 主信息架构变化
- 存储方案变化
- 命令接口变化
- 启动逻辑变化
- 版本目标变化
- 当前优先级变化

## 明确不做

当前阶段不做：

- AI 功能
- 云同步
- 多用户
- 账号体系
- 权限系统
- 进程守护面板
- 实时日志流面板
- macOS / Linux 完整适配
