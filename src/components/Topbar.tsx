import { Database, Search } from 'lucide-react'
import type { WorkflowItem } from '../types/items'

interface TopbarProps {
  defaultWorkflow: WorkflowItem | null
  onOpenSearch: () => void
  onOpenDataTools: () => void
  onRunDefaultWorkflow: () => void
}

export function Topbar({
  defaultWorkflow,
  onOpenSearch,
  onOpenDataTools,
  onRunDefaultWorkflow,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-white/88 px-3 py-3 backdrop-blur-md lg:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <button
          className="flex flex-1 items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2.5 text-left transition hover:border-[color:var(--border-strong)] hover:bg-white"
          type="button"
          onClick={onOpenSearch}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[color:var(--text-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <Search className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Command Palette
            </span>
            <span className="block truncate text-sm text-[color:var(--text-muted)]">
              搜索应用、项目、网站、工作流和快捷动作
            </span>
          </span>
          <span className="ml-auto rounded-lg border border-[color:var(--border)] bg-white px-2 py-1 font-mono text-[10px] text-[color:var(--text-soft)]">
            Ctrl K
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--text)] transition hover:bg-[color:var(--bg)]"
            type="button"
            onClick={onOpenDataTools}
          >
            <Database className="h-4 w-4 text-[color:var(--text-muted)]" />
            数据工具
          </button>

          <button
            className={`inline-flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
              defaultWorkflow
                ? 'border-[#bfd998] bg-[#f4f9ec] text-[color:var(--text)] shadow-[0_10px_24px_rgba(99,153,34,0.10)]'
                : 'border-[color:var(--border-strong)] bg-white text-[color:var(--text)]'
            }`}
            type="button"
            onClick={onRunDefaultWorkflow}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                defaultWorkflow ? 'bg-[color:var(--ready)] shadow-[0_0_0_4px_rgba(99,153,34,0.12)]' : 'bg-[color:var(--text-soft)]'
              }`}
            />
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                一键上班模式
              </span>
              <span className="block text-sm font-medium">
                {defaultWorkflow ? defaultWorkflow.name : '设置默认工作流'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
