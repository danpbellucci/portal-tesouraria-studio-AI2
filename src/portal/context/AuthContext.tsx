// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, SystemModule, PermissionAction } from '../types/treasury';
import { ApiClient } from '../services/api';

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isSetupRequired: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupAdmin: (email: string, name: string, password: string) => Promise<void>;
  activateAccount: (email: string, password: string) => Promise<void>;
  hasPermission: (module: SystemModule, action: PermissionAction) => boolean;
  refreshStatus: () => Promise<void>;
}

// Keep one context instance across hot reloads so the provider and consumers always match.
const g = globalThis as any;
const AuthContext: React.Context<AuthContextType | undefined> =
  g.__eloparAuthContext ?? (g.__eloparAuthContext = createContext<AuthContextType | undefined>(undefined));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = async () => {
    try {
      setIsLoading(true);
      const data = await ApiClient.request('/api/auth/status');
      setIsSetupRequired(!!data.isSetupRequired);
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();

    const handleExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await ApiClient.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.session?.token) {
      ApiClient.setToken(data.session.token);
      setUser(data.user);
    }
  };

  const logout = async () => {
    try {
      await ApiClient.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      ApiClient.clearToken();
      setUser(null);
    }
  };

  const setupAdmin = async (email: string, name: string, password: string) => {
    const data = await ApiClient.request('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ email, name, password })
    });

    if (data.session?.token) {
      ApiClient.setToken(data.session.token);
      setUser(data.user);
      setIsSetupRequired(false);
    }
  };

  const activateAccount = async (email: string, password: string) => {
    await ApiClient.request('/api/auth/activate', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword: password })
    });
  };

  const hasPermission = (module: SystemModule, action: PermissionAction): boolean => {
    if (!user) return false;
    if (user.isSystemAdmin) return true;
    const perms = user.permissions?.[module];
    if (!perms || !Array.isArray(perms)) return false;
    return perms.includes(action) || perms.includes('admin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isSetupRequired,
        isLoading,
        login,
        logout,
        setupAdmin,
        activateAccount,
        hasPermission,
        refreshStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
