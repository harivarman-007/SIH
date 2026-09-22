/**
 * AccountDisabledScreen (Full-page takeover)
 * MUST #1: Driven strictly by API error code ACCOUNT_DISABLED.
 * Full-page notice with no navigation and only a "Sign Out" button.
 */
import React from 'react';
import { UserX, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const AccountDisabledScreen: React.FC = () => {
  const { logout, error } = useAuthStore();

  const handleSignOut = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-zinc-400">
          <UserX className="w-8 h-8 text-amber-500" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium uppercase tracking-wider mb-4">
          Account Status: Deactivated
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">
          Account Suspended
        </h1>

        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          {error || 'Your account has been deactivated or revoked by platform governance. You cannot access Intellifusion resources.'}
        </p>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-4 text-xs text-zinc-500 text-left mb-8 w-full">
          <p className="font-semibold text-zinc-300 mb-1">Administrative Notice:</p>
          <p>
            If you believe this is an error, contact your mine authority or Super Administrator to reactivate your credentials.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-semibold transition-colors shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default AccountDisabledScreen;
