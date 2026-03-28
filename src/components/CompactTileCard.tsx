import { Copy, Edit3, ExternalLink, Star, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { renderItemIcon } from '../lib/item-icons'
import { TypeBadge } from './TypeBadge'
import type { DeskItem } from '../types/items'

interface CompactTileCardProps {
  item: DeskItem
  onLaunch: (item: DeskItem) => void
  onToggleFavorite: (item: DeskItem) => void
  onDuplicate?: (item: DeskItem) => void
  onEdit?: (item: DeskItem) => void
  onDelete?: (item: DeskItem) => void
}

export function CompactTileCard({
  item,
  onLaunch,
  onToggleFavorite,
  onDuplicate,
  onEdit,
  onDelete,
}: CompactTileCardProps) {
  return (
    <article
      className="group relative flex min-h-[132px] cursor-pointer flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:bg-[#fcfcfb] hover:shadow-[0_14px_28px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
      role="button"
      tabIndex={0}
      onClick={() => onLaunch(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onLaunch(item)
        }
      }}
    >
      <button
        aria-label={item.favorite ? `取消收藏 ${item.name}` : `收藏 ${item.name}`}
        aria-pressed={item.favorite}
        className={cn(
          'absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border transition',
          item.favorite
            ? 'border-amber-200 bg-amber-50 text-amber-500'
            : 'border-transparent bg-transparent text-[color:var(--text-soft)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite(item)
        }}
      >
        <Star className="h-4 w-4" fill={item.favorite ? 'currentColor' : 'none'} />
      </button>

      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="flex items-center gap-1">
          {onEdit ? (
            <button
              aria-label={`编辑 ${item.name}`}
              className="btn-icon h-7 w-7"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(item)
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDuplicate ? (
            <button
              aria-label={`复制 ${item.name}`}
              className="btn-icon h-7 w-7"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDuplicate(item)
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label={`删除 ${item.name}`}
              className="btn-icon h-7 w-7"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(item)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]">
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
        {renderItemIcon(item.type, 'h-4.5 w-4.5', item.icon)}
      </div>

      <div className="mt-auto grid gap-2">
        <div className="line-clamp-2 text-sm font-medium leading-5 tracking-[-0.02em] text-[color:var(--text)]">
          {item.name}
        </div>
        <TypeBadge type={item.type} />
      </div>
    </article>
  )
}
