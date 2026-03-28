import { NavLink } from 'react-router-dom'
import { NAV_SECTIONS } from '../lib/navigation'
import { cn } from '../lib/cn'

export function Sidebar() {
  return (
    <aside className="border-b border-[color:var(--border)] bg-[#f3f3f0]/95 backdrop-blur-sm lg:sticky lg:top-0 lg:min-h-screen lg:w-[228px] lg:border-b-0 lg:border-r">
      <div className="border-b border-[color:var(--border)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.03em] text-[color:var(--text)]">
              DeskHub
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Desktop Control Center
            </div>
          </div>
          <span className="rounded-full border border-[color:var(--border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            Beta
          </span>
        </div>
      </div>

      <div className="grid gap-4 px-2 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
              {section.title}
            </div>
            <nav className="grid gap-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition',
                      isActive
                        ? 'bg-white text-[color:var(--text)] shadow-[0_8px_20px_rgba(15,23,42,0.04)]'
                        : 'text-[color:var(--text-muted)] hover:bg-white/75 hover:text-[color:var(--text)]',
                    )
                  }
                  end={item.end}
                  to={item.to}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-[color:var(--accent)]" />
                      ) : null}
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg transition',
                          isActive ? 'bg-[#eef5fd] text-[color:var(--accent)]' : 'bg-white/65 text-[color:var(--text-soft)]',
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-auto hidden border-t border-[color:var(--border)] px-4 py-3 lg:flex lg:items-center lg:gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[color:var(--accent-strong)] text-[11px] font-semibold text-[#dcecff] shadow-[0_10px_18px_rgba(24,95,165,0.16)]">
          DH
        </div>
        <div>
          <div className="text-xs font-medium text-[color:var(--text)]">DeskHub Console</div>
          <div className="text-[11px] text-[color:var(--text-soft)]">Focus on launch speed</div>
        </div>
      </div>
    </aside>
  )
}
