/**
 * RoleGuard — Enforces whole-prefix role authorization (MUST #3).
 * When user accesses a foreign role domain, renders in-layout AccessDeniedPage
 * and reports denial best-effort to backend audit via POST /auth/access-denied (MUST #6).
 */
import React, { useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { AuthRole, reportAccessDenied } from '../../api/auth';
import { AccessDeniedPage } from '../AccessDeniedPage';

interface RoleGuardProps {
  allowedRoles: AuthRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  const isAllowed = user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (!isAllowed) {
      // MUST #6: Report access denial best-effort to backend
      reportAccessDenied(location.pathname);
    }
  }, [isAllowed, location.pathname]);

  if (!isAllowed) {
    return (
      <AccessDeniedPage
        attemptedPath={location.pathname}
        requiredRole={allowedRoles.join(' or ')}
      />
    );
  }

  return <Outlet />;
};

export default RoleGuard;
