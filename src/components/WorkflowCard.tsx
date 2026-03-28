import { CheckSquare, Copy, Edit3, ExternalLink, Square, Star, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { renderItemIcon } from '../lib/item-icons'
import {
  formatDelayMs,
  formatRelativeTimestamp,
  getWorkflowStepValue,
  WORKFLOW_STEP_LABELS,
} from '../lib/item-utils'
import type { SelectionInteraction, WorkflowItem } from '../types/items'

interface WorkflowCardProps {
  item: WorkflowItem
  isDefault?: boolean
  onLaunch: (item: WorkflowItem) => void
  onToggleFavorite: (item: WorkflowItem) => void
  onDuplicate?: (item: WorkflowItem) => void
  onEdit?: (item: WorkflowItem) => void
  onDelete?: (item: WorkflowItem) => void
  onSetDefault?: (item: WorkflowItem) => void
  selectionMode?: boolean
  selected?: boolean
  onSelectChange?: (item: WorkflowItem, selected: boolean, interaction?: SelectionInteraction) => void
}

export function WorkflowCard({
  item,
  isDefault = false,
  onLaunch,
  onToggleFavorite,
  onDuplicate,
  onEdit,
  onDelete,
  onSetDefault,
  selectionMode = false,
  selected = false,
  onSelectChange,
}: WorkflowCardProps) {
  const previewSteps = item.steps.slice(0, 4)

  const handlePrimaryClick = (interaction?: SelectionInteraction) => {
    if (selectionMode) {
      onSelectChange?.(item, !selected, interaction)
      return
    }

    onLaunch(item)
  }

  return (
    <article
      aria-selected={selectionMode ? selected : undefined}
      className={cn(
        'surface group relative flex h-full cursor-pointer flex-col gap-4 px-4 py-4 transition hover:-translate-y-[1px] hover:border-[color:var(--border-strong)] hover:shadow-[0_14px_28px_rgba(15,23,42,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]',
        selectionMode && selected && 'border-[color:var(--accent)] bg-[#f4f8fd] shadow-[0_14px_28px_rgba(55,138,221,0.08)]',
      )}
      role="button"
      tabIndex={0}
      onClick={(event) =>
        handlePrimaryClick({
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
        })
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handlePrimaryClick({
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          })
        }
      }}
    >
      {selectionMode && selected ? (
        <span className="absolute inset-y-3 left-1 w-1 rounded-full bg-[color:var(--accent)]" />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {selectionMode ? (
            <button
              aria-label={selected ? `取消选择 ${item.name}` : `选择 ${item.name}`}
              aria-pressed={selected}
              className="mt-1 rounded-md text-[color:var(--accent)]"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelectChange?.(item, !selected, {
                  shiftKey: event.shiftKey,
                  ctrlKey: event.ctrlKey,
                  metaKey: event.metaKey,
                })
              }}
            >
              {selected ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
            </button>
          ) : null}

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8EEF9] text-[#264A7C]">
            {renderItemIcon('workflow', 'h-4.5 w-4.5', item.icon)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium tracking-[-0.02em] text-[color:var(--text)]">{item.name}</h3>
              <span className="rounded-md bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-muted)]">
                {item.steps.length} 步
              </span>
              {isDefault ? (
                <span className="rounded-md bg-[#EAF3DE] px-2 py-0.5 text-[10px] font-medium text-[#3B6D11]">
                  默认
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              {item.description || '把一组固定动作收成一个可以一键启动的工作链。'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {!selectionMode ? (
            <>
              <button
                aria-label={item.favorite ? `取消收藏 ${item.name}` : `收藏 ${item.name}`}
                aria-pressed={item.favorite}
                className={cn(
                  'btn-icon',
                  item.favorite &&
                    'border-amber-200 bg-amber-50 text-amber-500 hover:border-amber-300 hover:text-amber-600',
                )}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleFavorite(item)
                }}
              >
                <Star className="h-4 w-4" fill={item.favorite ? 'currentColor' : 'none'} />
              </button>
              {onEdit ? (
                <button
                  aria-label={`编辑 ${item.name}`}
                  className="btn-icon"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(item)
                  }}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              ) : null}
              {onDuplicate ? (
                <button
                  aria-label={`复制 ${item.name}`}
                  className="btn-icon"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDuplicate(item)
                  }}
                >
                  <Copy className="h-4 w-4" />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  aria-label={`删除 ${item.name}`}
                  className="btn-icon"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(item)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </>
          ) : null}
          <button
            aria-label={`启动 ${item.name}`}
            className="btn-icon"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (selectionMode) {
                onSelectChange?.(item, !selected, {
                  shiftKey: event.shiftKey,
                  ctrlKey: event.ctrlKey,
                  metaKey: event.metaKey,
                })
                return
              }
              onLaunch(item)
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[linear-gradient(180deg,#fafaf8_0%,#f3f3f0_100%)] px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            步骤链
          </div>
          {item.steps.length > previewSteps.length ? (
            <div className="text-[11px] text-[color:var(--text-soft)]">+{item.steps.length - previewSteps.length} 步</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {previewSteps.map((step, index) => (
            <div key={step.id} className="contents">
              <div className="min-w-0 rounded-xl border border-[color:var(--border)] bg-white px-2.5 py-2 text-[11px] text-[color:var(--text-muted)] shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    {index + 1}
                  </span>
                  <span className="font-medium text-[color:var(--text)]">{WORKFLOW_STEP_LABELS[step.type]}</span>
                </div>
                <div className="max-w-[220px] truncate">{getWorkflowStepValue(step)}</div>
                {step.note || step.delayMs > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {step.note ? (
                      <span className="rounded-md bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-[10px]">
                        {step.note}
                      </span>
                    ) : null}
                    {step.delayMs > 0 ? (
                      <span className="rounded-md bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-[10px]">
                        延迟 {formatDelayMs(step.delayMs)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {index < previewSteps.length - 1 ? <span className="text-[color:var(--text-soft)]">→</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="text-xs text-[color:var(--text-soft)]">最近执行：{formatRelativeTimestamp(item.lastLaunchedAt)}</div>
        {!selectionMode ? (
          <div className="flex items-center gap-1">
            {onSetDefault ? (
              <button
                className="btn-secondary px-3 py-2 text-xs"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onSetDefault(item)
                }}
              >
                {isDefault ? '取消默认' : '设为默认'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
