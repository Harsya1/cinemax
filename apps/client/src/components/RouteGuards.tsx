import { Navigate, Outlet } from 'react-router-dom';
import { isStaffRole, type UserRole } from '@cinemax/shared';
import { useAuth } from '../context/AuthContext';

function LoadingScreen({ surface }: { surface: 'cinema' | 'workspace' }) {
  return (
    <div
      data-surface={surface}
      className="flex min-h-screen items-center justify-center text-sm font-medium text-muted"
    >
      Memuat sesi CINEMAX...
    </div>
  );
}

export function GuestOnlyRoute({ surface = 'cinema' }: { surface?: 'cinema' | 'workspace' }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen surface={surface} />;
  if (user) {
    return <Navigate to={isStaffRole(user.role) ? '/admin' : '/'} replace />;
  }
  return <Outlet />;
}

export function CustomerProtectedRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen surface="cinema" />;
  if (!user) return <Navigate to="/login" replace />;
  if (isStaffRole(user.role)) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

export function StaffProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen surface="workspace" />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isStaffRole(user.role)) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="font-display text-lg font-bold">403 — Akses Dibatasi</p>
        <p className="mt-1 text-sm text-rose-700">
          Role akun Anda ({user.role}) tidak memiliki izin untuk membuka halaman ini.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
