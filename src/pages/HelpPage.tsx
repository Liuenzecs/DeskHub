import { BookOpen, Keyboard, LayoutGrid, Search, Workflow, Zap, Layers, Database, StickyNote, Palette, Monitor } from 'lucide-react'

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent)]/10 text-[color:var(--accent)]">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-[color:var(--text)]">{title}</h2>
      </div>
      <div className="space-y-2 text-sm leading-6 text-[color:var(--text-muted)]">{children}</div>
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--text)]">
      {children}
    </kbd>
  )
}

export function HelpPage() {
  return (
    <div className="px-3 py-4 lg:px-5 lg:py-6">
      <div className="mb-4">
        <h1 className="page-title">使用帮助</h1>
        <p className="page-description mt-1">详细了解 DeskHub 的所有功能和最佳实践</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={<Search className="h-4 w-4" />} title="命令面板（第一入口）">
          <p>
            命令面板是 DeskHub 最重要的入口。按 <Kbd>Ctrl+K</Kbd> 打开，可以搜索所有条目、页面导航和全局动作。
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>搜索条目</strong>：直接输入名称、拼音或首字母即可匹配</li>
            <li><strong>Scoped 搜索</strong>：输入 <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">app:</code> <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">project:</code> <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">workflow:</code> <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">route:</code> <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">action:</code> 缩小范围</li>
            <li><strong>导航</strong>：输入页面名称直接跳转</li>
            <li><strong>全局动作</strong>：打开数据工具、清空最近使用、新建条目等</li>
            <li>支持中文、完整拼音和拼音首字母搜索</li>
          </ul>
        </Section>

        <Section icon={<Keyboard className="h-4 w-4" />} title="键盘快捷键">
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
              <span>打开命令面板</span>
              <span><Kbd>Ctrl</Kbd> + <Kbd>K</Kbd></span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
              <span>全局显示/隐藏窗口</span>
              <span><Kbd>Alt</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Space</Kbd></span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
              <span>命令面板中切换分组</span>
              <span><Kbd>Tab</Kbd> / <Kbd>Shift+Tab</Kbd></span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
              <span>设置/取消默认工作流</span>
              <span>命令面板中 <Kbd>Alt+D</Kbd></span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
              <span>条目多选</span>
              <span><Kbd>Ctrl</Kbd> + 点击 / <Kbd>Shift</Kbd> + 点击</span>
            </div>
          </div>
        </Section>

        <Section icon={<LayoutGrid className="h-4 w-4" />} title="六类条目管理">
          <p>DeskHub 统一管理六种资源：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>应用</strong>：管理 .exe、.lnk 等软件入口，一键启动</li>
            <li><strong>项目</strong>：开发项目目录 + 启动命令（如 npm run dev），可自动识别项目类型</li>
            <li><strong>网站</strong>：常用网址，一键在浏览器中打开</li>
            <li><strong>文件夹</strong>：常用目录，在资源管理器中打开</li>
            <li><strong>脚本</strong>：终端命令，支持阻塞/新终端/后台三种执行模式</li>
            <li><strong>工作流</strong>：按顺序执行多个步骤（打开路径 → 打开网址 → 运行命令）</li>
          </ul>
          <p className="mt-2">每条目支持标签、收藏、图标自定义。在资源页面可以按类型筛选、排序、批量操作。</p>
        </Section>

        <Section icon={<Workflow className="h-4 w-4" />} title="工作流系统">
          <p>工作流是最强大的功能，可以将多个操作串联起来：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>步骤类型</strong>：打开路径（open_path）、打开网址（open_url）、运行命令（run_command）</li>
            <li><strong>变量系统</strong>：定义 <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">{'{{变量名}}'}</code> 占位符，启动时输入实际值</li>
            <li><strong>条件判断</strong>：根据变量值决定跳过或跳转到其他步骤</li>
            <li><strong>失败策略</strong>：停止（stop）、继续（continue）、重试（retry），可设置重试次数和间隔</li>
            <li><strong>执行模式</strong>：阻塞等待、新终端窗口、后台静默执行</li>
            <li><strong>延迟执行</strong>：每个步骤可设置毫秒级延迟</li>
            <li><strong>从中间开始</strong>：可以跳过前面的步骤，从任意步骤开始执行</li>
          </ul>
        </Section>

        <Section icon={<Zap className="h-4 w-4" />} title="一键上班模式">
          <p>设置一个默认工作流后，Topbar 右侧会一直显示绿色按钮：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>在命令面板中对工作流按 <Kbd>Alt+D</Kbd> 设为默认</li>
            <li>点击 Topbar 的"一键上班模式"按钮直接执行</li>
            <li>可在工作流页面搜索 <code className="rounded bg-[color:var(--surface-muted)] px-1 text-[11px]">focus=default-workflow</code> 进行配置</li>
          </ul>
        </Section>

        <Section icon={<Layers className="h-4 w-4" />} title="空间（分组）">
          <p>空间让你按场景组织条目：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>在空间页面创建空间（如"日常工作"、"开源项目"、"学习资源"）</li>
            <li>每个空间有独立的名称、描述和颜色标识</li>
            <li>条目可以属于多个空间</li>
            <li>空间过滤在资源页面可用</li>
          </ul>
        </Section>

        <Section icon={<Database className="h-4 w-4" />} title="数据工具">
          <p>数据工具提供完整的数据库运维能力：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>备份/恢复</strong>：手动备份 SQLite 数据库，随时恢复</li>
            <li><strong>自动备份</strong>：可配置间隔和保留份数</li>
            <li><strong>导入/导出</strong>：JSON 格式的条目导入导出</li>
            <li><strong>浏览器书签导入</strong>：从 Chrome/Edge 导入书签为网站条目</li>
            <li><strong>项目目录扫描</strong>：批量扫描工作区目录，自动识别项目并导入</li>
            <li><strong>健康检查/一致性检查</strong>：检查数据库完整性</li>
            <li><strong>优化</strong>：VACUUM 压缩数据库文件</li>
          </ul>
        </Section>

        <Section icon={<StickyNote className="h-4 w-4" />} title="快速便签">
          <p>便签功能让你快速记录文字而不离开 DeskHub：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>便签页面查看所有便签，按更新时间排序</li>
            <li>标题可选，内容为纯文本</li>
            <li>点击便签卡片即可编辑</li>
            <li>切换主题后便签样式自动适配</li>
          </ul>
        </Section>

        <Section icon={<Palette className="h-4 w-4" />} title="主题切换">
          <p>DeskHub 支持浅色和深色两种主题：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>点击左侧边栏底部的切换按钮（太阳/月亮图标）</li>
            <li>主题偏好会持久化保存，下次启动自动应用</li>
            <li>所有页面、弹窗、卡片都会跟随主题变化</li>
            <li>深色模式在暗光环境下更护眼</li>
          </ul>
        </Section>

        <Section icon={<Monitor className="h-4 w-4" />} title="系统托盘">
          <p>DeskHub 支持最小化到系统托盘：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>关闭窗口时自动隐藏到托盘（不会退出）</li>
            <li>左键点击托盘图标：显示/隐藏窗口</li>
            <li>右键点击托盘图标：显示菜单（显示/隐藏、退出）</li>
            <li>全局快捷键 <Kbd>Alt+Shift+Space</Kbd> 随时呼出/隐藏</li>
          </ul>
        </Section>

        <Section icon={<BookOpen className="h-4 w-4" />} title="入门建议">
          <ol className="list-decimal pl-4 space-y-1">
            <li>先把最常用的应用、项目和网站添加进来</li>
            <li>创建一个"一键上班"工作流：打开项目 → 启动开发命令 → 打开 GitHub</li>
            <li>用空间把相关条目组织起来</li>
            <li>养成用 <Kbd>Ctrl+K</Kbd> 命令面板的习惯——它会学习你的使用模式</li>
            <li>配置自动备份，保护你的数据</li>
          </ol>
        </Section>
      </div>

      <div className="mt-4 text-center text-xs text-[color:var(--text-soft)]">
        DeskHub v0.3.0 · 你的桌面控制台
      </div>
    </div>
  )
}
