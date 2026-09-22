/**
 * ProtectedRoute — Ensures user is authenticated before accessing private route hierarchy.
 * MUST #1: If account is disabled (code ACCOUNT_DISABLED), renders AccountDisabledScreen.
 * Design Checkpoint: Simple centered spinner with "Loading…" text while verifying auth.
 * Open-redirect safe: preserves sanitized returnTo path.
 */
import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { AccountDisabledScreen } from '../AccountDisabledScreen';

export const ProtectedRoute: React.FC = () => {
  const { user, isLoading, accountDisabled } = useAuthStore();
  const location = useLocation();

  if (accountDisabled) {
    return <AccountDisabledScreen />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-500 tracking-wider font-medium">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    const returnPath = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnPath)}`} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
