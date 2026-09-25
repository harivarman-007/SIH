import React, { useState } from 'react';
import { MineSitesManagementView } from './MineSitesManagementView';
import MineMap from './MineMap';
import { Layers, Compass } from 'lucide-react';

export const AdminMinesCombinedView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sites' | 'map'>('sites');

  return (
    <div className="space-y-6">
      {/* Top Tab Bar Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('sites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sites'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-blue-700" />
          <span>Mine Sites Management &amp; Provisioning</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'map'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="w-4 h-4 text-blue-700" />
          <span>Spatial GIS / CAD Map</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'sites' ? (
        <MineSitesManagementView onSwitchToMap={() => setActiveTab('map')} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 px-4 py-2.5 rounded-xl text-xs text-blue-900">
            <span>Viewing Interactive Multi-Seam Underground CAD &amp; Surface GIS Spatial Map</span>
            <button
              onClick={() => setActiveTab('sites')}
              className="font-bold underline hover:text-blue-950"
            >
              ← Back to Mine Sites Directory
            </button>
          </div>
          <MineMap role="super_admin" />
        </div>
      )}
    </div>
  );
};
