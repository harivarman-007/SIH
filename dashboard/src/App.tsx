import React, { useState } from 'react';
import { PillNav, NavTab, UserRole } from './components/PillNav';
import AdvancedStats from './components/AdvancedStats';
import ObservationTable from './components/ObservationTable';
import MineMap from './components/MineMap';
import OcrQueueView from './components/OcrQueueView';
import AuditTrailView from './components/AuditTrailView';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [currentRole, setCurrentRole] = useState<UserRole>('mine_official');

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-black selection:text-white">
      {/* Monochromatic Pill Navigation */}
      <PillNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        pendingOcrCount={1}
        openHazardCount={7}
        userName="Rajesh Kumar"
        onLogout={() => {}}
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
            <span className="text-xs text-zinc-400">Role:</span>
            <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded bg-zinc-100 border border-zinc-300 text-zinc-800 font-medium">
              {currentRole.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Content Container */}
        <div className="mt-8">
          {activeTab === 'overview' && <AdvancedStats />}
          {activeTab === 'observations' && <ObservationTable />}
          {activeTab === 'map' && <MineMap />}
          {activeTab === 'ocr' && <OcrQueueView />}
          {activeTab === 'audit' && <AuditTrailView />}
        </div>
      </main>
    </div>
  );
}
