import { CheckSquare, Copy, Edit3, ExternalLink, Square, Star, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { renderItemIcon } from '../lib/item-icons'
import { formatRelativeTimestamp, formatTimestamp, getItemTarget } from '../lib/item-utils'
import { TypeBadge } from './TypeBadge'
import type { DeskItem, SelectionInteraction } from '../types/items'

interface ResourceRowCardProps {
  item: DeskItem
  onLaunch: (item: DeskItem) => void
  onToggleFavorite: (item: DeskItem) => void
  onDuplicate?: (item: DeskItem) => void
  onEdit?: (item: DeskItem) => void
  onDelete?: (item: DeskItem) => void
  compactMeta?: boolean
  selectionMode?: boolean
  selected?: boolean
  onSelectChange?: (item: DeskItem, selected: boolean, interaction?: SelectionInteraction) => void
}

export function ResourceRowCard({
  item,
  onLaunch,
  onToggleFavorite,
  onDuplicate,
  onEdit,
  onDelete,
  compactMeta = false,
  selectionMode = false,
  selected = false,
  onSelectChange,
}: ResourceRowCardProps) {
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
        'group surface relative flex h-full cursor-pointer items-start gap-3 px-4 py-3 shadow-none transition hover:-translate-y-[1px] hover:border-[color:var(--border-strong)] hover:shadow-[0_12px_24px_rgba(15,23,42,0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]',
        selectionMode && selected && 'border-[color:var(--accent)] bg-[#f4f8fd] shadow-[0_12px_24px_rgba(55,138,221,0.08)]',
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
        <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-[color:var(--accent)]" />
      ) : null}

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

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
        {renderItemIcon(item.type, 'h-4.5 w-4.5', item.icon)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium tracking-[-0.02em] text-[color:var(--text)]">{item.name}</h3>
          <TypeBadge type={item.type} />
          {item.favorite ? (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              收藏
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-1 text-sm text-[color:var(--text-muted)]">{item.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--text-soft)]">
          <span className="max-w-[520px] truncate rounded-md bg-[color:var(--surface-muted)] px-2 py-1">
            {getItemTarget(item)}
          </span>
          <span>{compactMeta ? formatRelativeTimestamp(item.lastLaunchedAt) : formatTimestamp(item.lastLaunchedAt)}</span>
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
    </article>
  )
}
