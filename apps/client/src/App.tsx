import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import {
  CustomerProtectedRoute,
  GuestOnlyRoute,
  StaffProtectedRoute,
} from './components/RouteGuards';
import { CinemaLayout } from './layouts/CinemaLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { LandingPage } from './pages/public/LandingPage';
import { ComingSoonPage } from './pages/public/ComingSoonPage';
import { MovieDetailsPage } from './pages/public/MovieDetailsPage';
import { WatchlistPage } from './pages/public/WatchlistPage';
import { BookingPage } from './pages/public/BookingPage';
import { PaymentPage } from './pages/public/PaymentPage';
import { ProfilePage } from './pages/public/ProfilePage';
import { CustomerLoginPage } from './pages/auth/CustomerLoginPage';
import { CustomerRegisterPage } from './pages/auth/CustomerRegisterPage';
import { StaffLoginPage } from './pages/auth/StaffLoginPage';
import { WorkspaceDashboardPage } from './pages/admin/WorkspaceDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminStudiosPage } from './pages/admin/AdminStudiosPage';
import { AdminTmdbBrowserPage } from './pages/admin/AdminTmdbBrowserPage';
import { AdminShowtimesPage } from './pages/admin/AdminShowtimesPage';
import { TicketPosPage } from './pages/admin/TicketPosPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Cinema Dark Surface */}
          <Route element={<CinemaLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/coming-soon" element={<ComingSoonPage />} />
            <Route path="/movie/:id" element={<MovieDetailsPage />} />
            <Route path="/booking/:showtimeId" element={<BookingPage />} />
            <Route path="/payment/:bookingCode" element={<PaymentPage />} />

            <Route element={<CustomerProtectedRoute />}>
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            <Route element={<GuestOnlyRoute surface="cinema" />}>
              <Route path="/login" element={<CustomerLoginPage />} />
              <Route path="/register" element={<CustomerRegisterPage />} />
            </Route>
          </Route>

          {/* Staff & Admin Light Workspace Surface */}
          <Route element={<GuestOnlyRoute surface="workspace" />}>
            <Route path="/admin/login" element={<StaffLoginPage />} />
          </Route>

          <Route element={<StaffProtectedRoute />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/admin" element={<WorkspaceDashboardPage />} />

              <Route element={<StaffProtectedRoute allowedRoles={['admin', 'manager']} />}>
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              </Route>

              <Route
                element={
                  <StaffProtectedRoute
                    allowedRoles={['admin', 'manager', 'cashier', 'cleaner']}
                  />
                }
              >
                <Route path="/admin/studios" element={<AdminStudiosPage />} />
              </Route>

              <Route
                element={
                  <StaffProtectedRoute allowedRoles={['admin', 'manager', 'cashier']} />
                }
              >
                <Route path="/admin/movies" element={<AdminTmdbBrowserPage />} />
                <Route path="/admin/showtimes" element={<AdminShowtimesPage />} />
                <Route path="/pos/ticket" element={<TicketPosPage />} />
              </Route>
            </Route>
          </Route>

          {/* Legacy Plan 01 preview redirect */}
          <Route path="/workspace-preview" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
