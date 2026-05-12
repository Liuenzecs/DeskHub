import { ITEM_TYPE_LABELS } from '../lib/item-utils'
import { cn } from '../lib/cn'
import type { ItemType } from '../types/items'

const TYPE_BADGE_STYLES: Record<ItemType, string> = {
  app: 'border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 text-[color:var(--accent-strong)]',
  project: 'border-purple-400/25 bg-purple-500/10 text-purple-600 dark:text-purple-400',
  url: 'border-green-500/25 bg-green-600/10 text-green-700 dark:text-green-400',
  folder: 'border-amber-500/25 bg-amber-600/10 text-amber-700 dark:text-amber-400',
  script: 'border-orange-500/25 bg-orange-600/10 text-orange-700 dark:text-orange-400',
  workflow: 'border-blue-400/25 bg-blue-500/10 text-blue-700 dark:text-blue-400',
}

interface TypeBadgeProps {
  type: ItemType
  className?: string
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-[0.03em]',
        TYPE_BADGE_STYLES[type],
        className,
      )}
    >
      {ITEM_TYPE_LABELS[type]}
    </span>
  )
}
