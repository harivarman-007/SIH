/**
 * AuthProvider — Context provider wrapping application auth lifecycle.
 */
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { UserInfo } from '../../api/auth';

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  isLoading: boolean;
  sessionExpired: boolean;
  accountDisabled: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isLoading, sessionExpired, accountDisabled, initialize, logout } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        sessionExpired,
        accountDisabled,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
