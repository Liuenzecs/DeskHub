interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="surface flex min-h-48 flex-col items-start justify-center gap-4 px-5 py-6 text-left">
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--surface-muted)]">
          <span className="absolute h-5 w-5 rounded-full border border-[color:var(--border-strong)] bg-white" />
          <span className="absolute h-7 w-7 rounded-full border border-dashed border-[color:var(--border)]" />
        </div>
        <div className="h-10 w-px bg-[color:var(--border)]" />
        <div className="grid gap-1">
          <div className="h-2.5 w-20 rounded-full bg-[color:var(--surface-muted)]" />
          <div className="h-2.5 w-12 rounded-full bg-[color:var(--surface-muted)]" />
        </div>
      </div>
      <div>
        <div className="page-kicker">DeskHub Empty State</div>
        <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text)]">{title}</h3>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button className="btn-secondary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
