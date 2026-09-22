/**
 * PermissionProvider & usePermissions() hook (MUST #5).
 * Exposes `can(permission)` checking server-derived permissions list, plus resource scope.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Permission } from '../../types/permissions';

interface PermissionContextType {
  permissions: string[];
  scope: Record<string, any>;
  can: (permission: Permission | string) => boolean;
  hasAll: (perms: (Permission | string)[]) => boolean;
  hasAny: (perms: (Permission | string)[]) => boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissions, scope } = useAuthStore();

  const permSet = useMemo(() => new Set(permissions), [permissions]);

  const can = (permission: Permission | string): boolean => {
    return permSet.has(permission);
  };

  const hasAll = (perms: (Permission | string)[]): boolean => {
    return perms.every((p) => permSet.has(p));
  };

  const hasAny = (perms: (Permission | string)[]): boolean => {
    return perms.some((p) => permSet.has(p));
  };

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        scope,
        can,
        hasAll,
        hasAny,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export function usePermissions(): PermissionContextType {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}
