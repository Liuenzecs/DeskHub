import { ITEM_TYPE_LABELS } from '../lib/item-utils'
import { cn } from '../lib/cn'
import type { ItemType } from '../types/items'

const TYPE_BADGE_STYLES: Record<ItemType, string> = {
  app: 'border-[#c9def2] bg-[#E6F1FB] text-[#185FA5]',
  project: 'border-[#d8d4fb] bg-[#EEEDFE] text-[#534AB7]',
  url: 'border-[#d4e7bb] bg-[#EAF3DE] text-[#3B6D11]',
  folder: 'border-[#eddab7] bg-[#FAEEDA] text-[#854F0B]',
  script: 'border-[#f0d5cb] bg-[#FAECE7] text-[#993C1D]',
  workflow: 'border-[#d4dfef] bg-[#E8EEF9] text-[#264A7C]',
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
