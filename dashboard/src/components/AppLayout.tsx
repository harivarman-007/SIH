/**
 * AppLayout — Primary application shell holding responsive Sidebar, header, and <Outlet />.
 * SHOULD #9: Surfaces RBAC spec section 25 "Access Restricted" alert toast on 403.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, ShieldAlert, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AlertBell } from './AlertBell';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABELS } from '../types/permissions';
import { fetchKPIs, KPISummary } from '../api/kpi';
import { registerForbiddenHandler } from '../api/client';

export const AppLayout: React.FC = () => {
  const { user } = useAuthStore();
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [kpis, setKpis] = useState<KPISummary | null>(null);
  const [forbiddenToast, setForbiddenToast] = useState<string | null>(null);

  const refreshKpis = useCallback(async () => {
    try {
      const data = await fetchKPIs();
      setKpis(data);
    } catch {
      setKpis(null);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshKpis();
    const interval = setInterval(refreshKpis, 30_000);
    return () => clearInterval(interval);
  }, [user, refreshKpis]);

  // SHOULD #9: Register 403 Forbidden handler
  useEffect(() => {
    registerForbiddenHandler((msg) => {
      setForbiddenToast(msg || 'Access Restricted: You do not have permission to perform this action.');
      setTimeout(() => setForbiddenToast(null), 5000);
    });
  }, []);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return window.innerWidth < 1024;
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const currentRole = user?.role || 'mine_official';

  return (
    <div className="min-h-screen bg-white text-zinc-950 flex">
      {/* Dynamic Sidebar */}
      <Sidebar
        kpis={kpis}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        isCollapsed={isCollapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* Main Content Area — Smoothly adjusts padding to match sidebar state */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isCollapsed ? 'md:pl-16' : 'md:pl-60'
        }`}
      >
        {/* Top Header Bar */}
        <header className="h-16 border-b border-zinc-200 bg-white/95 sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsOpenMobile((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 truncate">
                {currentRole === 'corporate_management'
                  ? 'Enterprise Multi-Mine Oversight • Central Command'
                  : 'Sector 4 • Jharia Coalfield Operations'}
              </span>
              <span className="text-sm font-semibold text-zinc-900 truncate">
                Intellifusion Operations Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <AlertBell role={currentRole} />

            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-200 pl-3">
              <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded bg-zinc-100 border border-zinc-300 text-zinc-800 font-medium">
                {ROLE_LABELS[currentRole]}
              </span>
              {user && (
                <span className="text-xs text-zinc-500 font-medium hidden md:inline truncate max-w-[140px]">
                  {user.full_name}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Floating 403 Toast (SHOULD #9) */}
        {forbiddenToast && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md bg-zinc-900 text-white p-4 rounded-xl shadow-2xl border border-red-500/40 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-red-200 mb-0.5">Access Restricted</p>
              <p className="text-zinc-300">{forbiddenToast}</p>
            </div>
            <button
              onClick={() => setForbiddenToast(null)}
              className="text-zinc-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Page Content Container */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
