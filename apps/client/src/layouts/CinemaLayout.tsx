import { Link, Outlet } from 'react-router-dom';
import { isStaffRole } from '@cinemax/shared';
import { useAuth } from '../context/AuthContext';

export function CinemaLayout() {
  const { user, isLoading, logout } = useAuth();

  return (
    <div data-surface="cinema" className="min-h-screen font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-burgundy-700 to-burgundy-900 ring-1 ring-gold-500/40 font-display text-lg font-extrabold text-gold-400">
              C
            </span>
            <span className="font-display text-xl font-extrabold tracking-wider text-white">
              CINE<span className="text-gold-500">MAX</span>
            </span>
          </Link>

          <nav className="flex items-center gap-5 text-sm font-medium text-muted">
            <Link to="/" className="text-white transition-colors hover:text-gold-400">
              Now Playing
            </Link>
            <Link to="/coming-soon" className="text-white transition-colors hover:text-gold-400">
              Coming Soon
            </Link>
            {user && !isStaffRole(user.role) && (
              <Link to="/watchlist" className="text-white transition-colors hover:text-gold-400">
                My Watchlist
              </Link>
            )}

            {!isLoading && !user && (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-zinc-300 transition-colors hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-bold text-obsidian-950 transition-colors hover:bg-gold-400"
                >
                  Register
                </Link>
              </div>
            )}

            {!isLoading && user && (
              <div className="flex items-center gap-3">
                {isStaffRole(user.role) ? (
                  <Link
                    to="/admin"
                    className="rounded-lg border border-burgundy-700 bg-burgundy-900/70 px-3.5 py-1.5 text-xs font-semibold text-gold-400 hover:bg-burgundy-800"
                  >
                    Workspace ({user.role})
                  </Link>
                ) : (
                  <span className="rounded-full border border-white/10 bg-surface px-3 py-1 text-xs font-semibold text-gold-400 tabular-nums">
                    {user.name} · {user.points} pts
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-rose-500/40 hover:text-rose-300"
                >
                  Sign Out
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
