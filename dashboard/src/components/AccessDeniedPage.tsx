/**
 * AccessDeniedPage (403 State)
 * Rendered inside the normal app layout (keeping sidebar intact) per design checkpoint.
 * Exact wording from RBAC spec §3/§25:
 *   "Access Denied"
 *   "You do not have permission to access this resource."
 */
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABELS } from '../types/permissions';

interface AccessDeniedPageProps {
  attemptedPath?: string;
  requiredRole?: string;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ attemptedPath, requiredRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const currentPath = attemptedPath || location.pathname;
  const userRoleLabel = user ? ROLE_LABELS[user.role] : 'Unknown Role';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-6 text-red-600 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-2">
        Access Denied
      </h1>

      <p className="text-base text-zinc-600 max-w-md mb-6 leading-relaxed">
        You do not have permission to access this resource.
      </p>

      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs text-zinc-500 font-mono mb-8 max-w-lg w-full text-left space-y-1">
        <div><span className="text-zinc-400">Path:</span> <span className="text-zinc-800">{currentPath}</span></div>
        <div><span className="text-zinc-400">Authenticated Role:</span> <span className="text-zinc-800 font-medium">{userRoleLabel}</span></div>
        {requiredRole && (
          <div><span className="text-zinc-400">Target Role Domain:</span> <span className="text-red-700 font-medium">{requiredRole}</span></div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-black text-white hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
