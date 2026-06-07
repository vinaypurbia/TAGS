import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type UserRole = 'admin' | 'manager' | 'associate' | 'cashier' | 'delivery_boy';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  allowedModules?: string[];  // null/undefined = all modules (admin/manager)
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
  isDeliveryBoy: boolean;
  canAccessAdmin: boolean;
  canAccessPOS: boolean;
  allowedModules: string[] | null;  // null = all access
  canAccess: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, isLoading: true,
  login: () => {}, logout: () => {},
  isAdmin: false, isManager: false, isAssociate: false, isCashier: false, isDeliveryBoy: false,
  canAccessAdmin: false, canAccessPOS: false,
  allowedModules: null,
  canAccess: () => true,
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
    setIsLoading(false); // Fresh login — no verification needed, clear loading immediately
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
  const isDeliveryBoy = user?.role === 'delivery_boy';
  const canAccessAdmin = isAdmin || isManager;
  const canAccessPOS = !!user && !isDeliveryBoy;  // delivery_boy has their own /driver panel

  // null means all access (admin/manager) — array means restricted
  const allowedModules: string[] | null = isAdmin
    ? null
    : (user?.allowedModules && user.allowedModules.length > 0)
    ? user.allowedModules
    : null;

  const canAccess = (module: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;           // admin sees everything
    if (!allowedModules) return true;   // no restrictions set
    return allowedModules.includes(module);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAdmin, isManager, isAssociate, isCashier, isDeliveryBoy, canAccessAdmin, canAccessPOS, allowedModules, canAccess }}>
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
