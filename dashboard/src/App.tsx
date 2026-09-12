import { useState, useEffect, useCallback } from 'react';
import { PillNav, NavTab, UserRole } from './components/PillNav';
import AdvancedStats from './components/AdvancedStats';
import ObservationTable from './components/ObservationTable';
import MineMap from './components/MineMap';
import OcrQueueView from './components/OcrQueueView';
import AuditTrailView from './components/AuditTrailView';
import { useAuthStore } from './store/authStore';
import { fetchKPIs, KPISummary } from './api/kpi';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const { user, isLoading, switchRole, logout, initialize } = useAuthStore();

  // KPI state lifted to App so PillNav badge counts are live
  const [kpis, setKpis] = useState<KPISummary | null>(null);

  // On mount: auto-login with default role
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh KPIs whenever user/token changes or every 30s
  const refreshKpis = useCallback(async () => {
    try {
      const data = await fetchKPIs();
      setKpis(data);
    } catch {
      // backend may be down — silently skip
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshKpis();
    const interval = setInterval(refreshKpis, 30_000);
    return () => clearInterval(interval);
  }, [user, refreshKpis]);

  const handleRoleChange = async (role: UserRole) => {
    await switchRole(role as 'inspector' | 'mine_official' | 'regulator');
    // Re-fetch KPIs with new role context
    setTimeout(refreshKpis, 300);
  };

  const currentRole: UserRole = (user?.role as UserRole) ?? 'mine_official';

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-400 tracking-wider uppercase font-medium">
            Connecting to Intellifusion API…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-black selection:text-white">
      {/* Monochromatic Pill Navigation */}
      <PillNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        pendingOcrCount={kpis ? 0 : 0} // OCR queue count set by OcrQueueView
        openHazardCount={kpis?.open_high_risk_count ?? 0}
        userName={user?.full_name ?? 'Loading…'}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto pt-24 pb-16 px-6 sm:px-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1">
              Sector 4 &bull; Jharia Coalfield
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-black">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'observations' && 'Hazards & Observations'}
              {activeTab === 'map' && 'Mine Spatial Map'}
              {activeTab === 'ocr' && 'OCR Review Queue'}
              {activeTab === 'audit' && 'Cryptographic Audit Trail'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Authenticated as:</span>
            <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded bg-zinc-100 border border-zinc-300 text-zinc-800 font-medium">
              {currentRole.replace('_', ' ')}
            </span>
            {user && (
              <span className="text-xs text-zinc-400 hidden sm:inline truncate max-w-[180px]">
                {user.full_name}
              </span>
            )}
          </div>
        </div>

        {/* Content Container */}
        <div className="mt-8">
          {activeTab === 'overview' && (
            <AdvancedStats kpiData={kpis} onRefresh={refreshKpis} />
          )}
          {activeTab === 'observations' && (
            <ObservationTable role={currentRole} onKpiRefresh={refreshKpis} />
          )}
          {activeTab === 'map' && (
            <MineMap role={currentRole} onKpiRefresh={refreshKpis} />
          )}
          {activeTab === 'ocr' && (
            <OcrQueueView role={currentRole} onRefreshCount={refreshKpis} />
          )}
          {activeTab === 'audit' && <AuditTrailView role={currentRole} />}
        </div>
      </main>
    </div>
  );
}
