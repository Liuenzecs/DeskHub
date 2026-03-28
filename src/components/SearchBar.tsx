import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  resultCount?: number
  actions?: ReactNode
}

export function SearchBar({
  value,
  onChange,
  placeholder = '按名称、标签、描述或类型筛选',
  resultCount,
  actions,
}: SearchBarProps) {
  return (
    <section
      aria-label="页面筛选"
      className="surface flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
      role="search"
    >
      <label className="relative flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]"
        />
        <input
          aria-label="筛选条目"
          className="field pl-10 pr-10"
          placeholder={placeholder}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            aria-label="清空筛选"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--text-soft)] transition hover:bg-black/5 hover:text-[color:var(--text)]"
            type="button"
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
        <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-muted)]">
          当前页筛选
        </span>
        {typeof resultCount === 'number' ? (
          <span className="rounded-lg border border-[color:var(--border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-muted)]">
            {resultCount} 条结果
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </section>
  )
}
