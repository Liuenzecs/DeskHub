<div align="center">

# DeskHub

**Your local launch console for apps, projects, websites and workflows.**

把本地工具、开发项目、常用网站和启动流程收进同一界面的桌面工作台。

![Release](https://img.shields.io/badge/Release-First%20Draft-378ADD?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%20First-639922?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-Tauri%20%2B%20React%20%2B%20SQLite-1A1A1A?style=for-the-badge)
![Search](https://img.shields.io/badge/Search-Ctrl%20%2B%20K%20First-E6E2D9?style=for-the-badge&labelColor=1A1A1A)

[查看更新说明](./RELEASE_NOTES.md) · [查看升级须知](./UPGRADE_NOTES.md) · [查看仓库说明](../../README.md)

</div>

---

![DeskHub Overview](./screenshots/01-overview.png)

## 一句话介绍

DeskHub = 把软件、项目、文件夹、网站和工作流统一管理，并支持一键进入工作状态的电脑控制中心。

它不是传统的大留白 Dashboard，而是一个偏高密度、键盘优先、操作路径极短的桌面控制台。目标只有四个：

- 搜索快
- 启动快
- 管理快
- 数据可靠

## 为什么会需要它

真实工作环境里的入口通常是碎的：

- 软件在开始菜单、桌面或固定栏里
- 项目分散在不同磁盘和工作区目录里
- 常用网站躺在浏览器书签和历史里
- 启动服务要敲命令
- 固定工作流每天都要手动重复一遍

DeskHub 把这些入口收进同一套模型里，让你可以：

- 搜索一个名字，立刻打开目标
- 点一下工作流，直接进入当前工作状态
- 把最近、收藏、项目和网址都留在同一套工作台里

## 核心亮点

| 能力 | 说明 |
| --- | --- |
| 命令面板优先 | `Ctrl+K / Cmd+K` 是一号入口，支持条目、导航、动作统一搜索 |
| 六类资源统一管理 | 应用、项目、网站、文件夹、脚本、工作流放在一处 |
| 工作流可视化 | 直接展示步骤链，点之前就知道会执行什么 |
| 数据层正式化 | SQLite 持久化，配套备份、恢复、导入导出、健康检查 |
| 高密度 UI | 更接近 Raycast / Linear 风格的开发者控制台，而不是 SaaS 仪表盘 |

## 它看起来是什么样

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="./screenshots/02-command-palette-empty.png" alt="DeskHub Command Palette" />
      <p><strong>命令面板是一号入口</strong><br />搜索应用、项目、网站、页面导航和全局动作，不用先层层进入页面。</p>
    </td>
    <td width="50%" valign="top">
      <img src="./screenshots/03-command-palette-workflow-search.png" alt="DeskHub Workflow Search" />
      <p><strong>工作流可直接搜索执行</strong><br />工作流足够高频时，直接从命令面板启动通常比进入工作流页更快。</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="./screenshots/04-projects-page.png" alt="DeskHub Projects Page" />
      <p><strong>资源页负责管理</strong><br />排序、标签筛选、收藏、多选和批量操作都集中在资源页完成。</p>
    </td>
    <td width="50%" valign="top">
      <img src="./screenshots/05-workflows-page.png" alt="DeskHub Workflows Page" />
      <p><strong>工作流页负责进入状态</strong><br />步骤链直观可见，默认工作流和一键上班模式形成完整闭环。</p>
    </td>
  </tr>
</table>

## 你可以用它做什么

- 统一管理 6 类条目：应用、项目、网站、文件夹、脚本、工作流
- 用 `Ctrl+K / Cmd+K` 搜索任意条目、页面导航或全局动作
- 把“打开项目目录 + 启动服务 + 打开网页”保存成一个工作流
- 收藏高频内容，并用最近使用快速回访
- 用默认工作流把常见“上班启动动作”收敛到顶部入口
- 通过数据工具做数据库备份、恢复、导入、导出、预检和健康检查

## 为什么它更适合开发者

- 入口管理和启动动作在同一套模型里，而不是“书签管理”和“脚本工具”各管一摊
- 工作流不是附属功能，而是主路径能力
- UI 默认就为高频使用设计，操作密度高，信息反馈快
- 数据已经从临时 JSON 试验态升级到正式 SQLite 存储层

## 首版已经具备的正式能力

- `Ctrl+K / Cmd+K` 全局命令面板
- 中文、拼音、首字母搜索
- 默认工作流与顶部“一键上班模式”
- `open_path / open_url / run_command` 工作流步骤
- 工作流变量、条件、重试、失败策略和执行摘要
- 原生路径选择器录入应用、项目和文件夹
- 项目目录半自动导入
- 浏览器收藏夹导入
- 备份、恢复、导入、导出、健康检查、一致性检查
- 排序、标签筛选、批量收藏、批量删除、批量导出

## 适合谁

- 需要同时管理多个本地项目的开发者
- 经常在应用、目录、网页、脚本之间切换的高频电脑用户
- 想把固定“进入工作状态”动作收敛成一键流程的人
- 希望本地数据更稳定，而不是依赖试验性 JSON 存储的用户

## 当前版本边界

- 当前仍是 `Windows First`
- macOS / Linux 已有基础 launcher backend，但还没有完成完整产品化适配
- 旧 `items.json` 不会自动迁移到 SQLite
- portable zip 仍在评估阶段，当前默认更适合把 installer 作为正式发布产物

## 本目录包含什么

这是 DeskHub 首版真实 release 素材目录，当前包含：

- 6 张真实截图
- [`RELEASE_NOTES.md`](./RELEASE_NOTES.md)
- [`UPGRADE_NOTES.md`](./UPGRADE_NOTES.md)
- 可重复生成截图的脚本入口

如果你要把这套内容拿去做首版 GitHub Release 页面，这里已经不只是素材清单，而是一套可以直接继续精修的对外介绍骨架。

## 如何刷新这套素材

先构建：

```bash
npm run build
```

再生成截图：

```bash
npm run release:shots
```

如果需要同步最新包体基线：

```bash
npm run perf:report
```

## 配套文档

- [`RELEASE_NOTES.md`](./RELEASE_NOTES.md)：首版更新说明草案
- [`UPGRADE_NOTES.md`](./UPGRADE_NOTES.md)：首版升级须知草案
- [`../../README.md`](../../README.md)：仓库主 README
- [`../../RELEASE.md`](../../RELEASE.md)：正式发布 checklist
- [`../../PROJECT_STATUS.md`](../../PROJECT_STATUS.md)：当前阶段与后续方向
- [`../../DECISIONS.md`](../../DECISIONS.md)：已锁定的重要产品与技术决策
