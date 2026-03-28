import { Download, Heart, PencilLine, StarOff, Trash2 } from 'lucide-react'

interface SelectionToolbarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onFavorite: () => void
  onUnfavorite: () => void
  onBatchEdit: () => void
  onCopyJson: () => void
  onDelete: () => void
  onExport: () => void
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onFavorite,
  onUnfavorite,
  onBatchEdit,
  onCopyJson,
  onDelete,
  onExport,
}: SelectionToolbarProps) {
  const hasSelection = selectedCount > 0

  return (
    <section
      aria-label="批量管理工具栏"
      className="surface flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5fd] text-[color:var(--accent)]">
          <Heart className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-[-0.02em] text-[color:var(--text)]">
            已选择 {selectedCount} 个条目
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-soft)]">
            <span>当前筛选结果共 {totalCount} 项</span>
            <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 font-mono">
              Esc 退出
            </span>
            <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 font-mono">
              Ctrl/Cmd+A 全选
            </span>
            <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 font-mono">
              Delete 删除
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={onSelectAll}>
          全选当前筛选结果
        </button>
        <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={onClearSelection}>
          取消选择
        </button>
        <button
          className="btn-secondary gap-2 px-3 py-2 text-xs"
          disabled={!hasSelection}
          type="button"
          onClick={onFavorite}
        >
          <Heart className="h-3.5 w-3.5" />
          批量收藏
        </button>
        <button
          className="btn-secondary gap-2 px-3 py-2 text-xs"
          disabled={!hasSelection}
          type="button"
          onClick={onUnfavorite}
        >
          <StarOff className="h-3.5 w-3.5" />
          批量取消收藏
        </button>
        <button
          className="btn-secondary gap-2 px-3 py-2 text-xs"
          disabled={!hasSelection}
          type="button"
          onClick={onBatchEdit}
        >
          <PencilLine className="h-3.5 w-3.5" />
          批量编辑
        </button>
        <button
          className="btn-secondary gap-2 px-3 py-2 text-xs"
          disabled={!hasSelection}
          type="button"
          onClick={onExport}
        >
          <Download className="h-3.5 w-3.5" />
          导出所选
        </button>
        <button
          className="btn-secondary px-3 py-2 text-xs"
          disabled={!hasSelection}
          type="button"
          onClick={onCopyJson}
        >
          复制为 JSON
        </button>
        <button
          className="btn-danger gap-2 px-3.5 py-2 text-xs"
          disabled={!hasSelection}
          type="button"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          批量删除
        </button>
      </div>
    </section>
  )
}
