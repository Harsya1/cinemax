import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginInput, RegisterInput } from '@cinemax/shared';
import { apiRequest } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginCustomer: (input: LoginInput) => Promise<AuthUser>;
  registerCustomer: (input: RegisterInput) => Promise<AuthUser>;
  loginStaff: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const me = await apiRequest<AuthUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const loginCustomer = useCallback(async (input: LoginInput) => {
    const loggedIn = await apiRequest<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const registerCustomer = useCallback(async (input: RegisterInput) => {
    const registered = await apiRequest<AuthUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setUser(registered);
    return registered;
  }, []);

  const loginStaff = useCallback(async (input: LoginInput) => {
    const loggedIn = await apiRequest<AuthUser>('/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    await apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }).catch(
      () => null,
    );
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      loginCustomer,
      registerCustomer,
      loginStaff,
      logout,
      refreshSession,
    }),
    [user, isLoading, loginCustomer, registerCustomer, loginStaff, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
