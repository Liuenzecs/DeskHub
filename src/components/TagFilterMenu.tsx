import { Funnel, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../lib/cn'

interface TagFilterMenuProps {
  tags: string[]
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  onClear: () => void
}

export function TagFilterMenu({ tags, selectedTags, onToggleTag, onClear }: TagFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition',
          selectedTags.length
            ? 'border-[color:var(--accent)] bg-[#f4f8fd] text-[color:var(--accent)]'
            : 'border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]',
        )}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Funnel className="h-3.5 w-3.5" />
        标签
        {selectedTags.length ? (
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-[color:var(--accent)]">
            {selectedTags.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-label="标签筛选"
          className="absolute right-0 top-[calc(100%+8px)] z-20 w-72 rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
          id={panelId}
          role="dialog"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                标签筛选
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-soft)]">命中任一已选标签即显示</div>
            </div>
            <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 text-[10px] text-[color:var(--text-soft)]">
              {selectedTags.length} 已选
            </span>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              可用标签
            </div>
            {selectedTags.length ? (
              <button
                className="text-xs text-[color:var(--text-soft)] transition hover:text-[color:var(--text)]"
                type="button"
                onClick={onClear}
              >
                清空
              </button>
            ) : null}
          </div>

          {tags.length ? (
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag)

                return (
                  <button
                    key={tag}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition',
                      active
                        ? 'border-[color:var(--accent)] bg-[#f4f8fd] text-[color:var(--accent)]'
                        : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-white',
                    )}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                  >
                    {tag}
                    {active ? <X className="h-3 w-3" /> : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-[color:var(--text-muted)]">当前页面还没有标签。</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
