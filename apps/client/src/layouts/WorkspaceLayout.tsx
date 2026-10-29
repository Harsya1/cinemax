import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManagement = user?.role === 'admin' || user?.role === 'manager';
  const canAccessOperations =
    user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cashier';
  const canAccessStudios = canAccessOperations || user?.role === 'cleaner';

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  function navClass({ isActive }: { isActive: boolean }) {
    return isActive
      ? 'block rounded-lg bg-burgundy-800 px-3 py-2 font-medium text-white'
      : 'block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100';
  }

  return (
    <div data-surface="workspace" className="flex min-h-screen font-sans antialiased">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-burgundy-800 font-display text-sm font-bold text-gold-400">
            CX
          </span>
          <div>
            <p className="font-display text-base font-bold tracking-wide text-slate-900">
              CINEMAX
            </p>
            <p className="text-[11px] font-medium text-slate-500">Operations & POS</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3 text-sm">
          <NavLink to="/admin" end className={navClass}>
            Dashboard Overview
          </NavLink>

          {isManagement && (
            <>
              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Administration
              </div>
              <NavLink to="/admin/users" className={navClass}>
                Users & Staff
              </NavLink>
              <NavLink to="/admin/audit-logs" className={navClass}>
                Audit Logs
              </NavLink>
            </>
          )}

          {(canAccessOperations || canAccessStudios) && (
            <>
              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cinema Operations
              </div>
              {canAccessOperations && (
                <NavLink to="/admin/movies" className={navClass}>
                  Browse TMDb Movies
                </NavLink>
              )}
              {canAccessStudios && (
                <NavLink to="/admin/studios" className={navClass}>
                  Studios & Seat Map
                </NavLink>
              )}
              {canAccessOperations && (
                <NavLink to="/admin/showtimes" className={navClass}>
                  Showtimes Schedule
                </NavLink>
              )}
              {canAccessOperations && (
                <NavLink to="/pos/ticket" className={navClass}>
                  Ticket POS
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="space-y-2 border-t border-slate-200 p-4">
          <Link
            to="/"
            className="block rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Public Website
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="font-display text-lg font-bold text-slate-900">
            CINEMAX Workspace
          </h1>

          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">{user.email}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-gold-600 ring-1 ring-amber-200">
                {user.role}
              </span>
            </div>
          )}
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
