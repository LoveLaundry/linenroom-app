import { NavLink, Outlet } from 'react-router-dom'
import { appConfig } from '../config/app'
import { useAuth } from '../auth/AuthContext'
import clsx from 'clsx'

export function AppShell() {
  const { user, signOut } = useAuth()
  const scope = user?.clientName ?? user?.laundry

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appConfig.title}</p>
            {scope ? <p className="truncate text-xs text-slate-500">{scope}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{user?.role}</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
              aria-label="Sign out"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {appConfig.nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/70',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
