/**
 * PermissionGuard — Wraps UI elements and action buttons (Spec §17).
 * Hides or displays fallback if current authenticated user lacks required permission.
 */
import React from 'react';
import { usePermissions } from '../providers/PermissionProvider';
import { Permission } from '../../types/permissions';

interface PermissionGuardProps {
  requires: Permission | string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requires,
  fallback = null,
  children,
}) => {
  const { can } = usePermissions();

  if (!can(requires)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGuard;
