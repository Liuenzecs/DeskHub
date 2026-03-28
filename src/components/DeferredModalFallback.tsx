interface DeferredModalFallbackProps {
  title: string
}

export function DeferredModalFallback({ title }: DeferredModalFallbackProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="surface w-full max-w-xl px-5 py-4">
        <div className="page-kicker">
          DeskHub
        </div>
        <div className="mt-2 text-sm text-[color:var(--text-muted)]">{title}</div>
      </div>
    </div>
  )
}
