import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type UserRole = 'admin' | 'manager' | 'associate' | 'cashier';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isAssociate: boolean;
  isCashier: boolean;
  canAccessAdmin: boolean;
  canAccessPOS: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, isLoading: true,
  login: () => {}, logout: () => {},
  isAdmin: false, isManager: false, isAssociate: false, isCashier: false,
  canAccessAdmin: false, canAccessPOS: false,
});

const TOKEN_KEY = 'tags_token';
const USER_KEY = 'tags_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Defined with useCallback BEFORE the useEffect that uses them,
  // so references are stable across renders — this prevents the idle
  // timer in AdminPanel from misfiring on every re-render.
  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => { clearSession(); }, [clearSession]);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        fetch('/api/business?module=auth&action=verify', {
          headers: { Authorization: `Bearer ${savedToken}` }
        })
          .then(r => r.json())
          .then(data => { if (!data.valid) clearSession(); })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      } catch {
        clearSession();
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [clearSession]);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAssociate = user?.role === 'associate';
  const isCashier = user?.role === 'cashier';
  const canAccessAdmin = isAdmin || isManager;
  const canAccessPOS = !!user;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAdmin, isManager, isAssociate, isCashier, canAccessAdmin, canAccessPOS }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
