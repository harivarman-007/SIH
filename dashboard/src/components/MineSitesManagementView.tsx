import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Power,
  Layers,
  Compass,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  fetchAdminMineSites,
  createAdminMineSite,
  updateAdminMineSite,
  MineSiteRecord,
} from '../api/admin';

interface Props {
  onSwitchToMap?: () => void;
}

export const MineSitesManagementView: React.FC<Props> = ({ onSwitchToMap }) => {
  const [mineSites, setMineSites] = useState<MineSiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addLocation, setAddLocation] = useState('');
  const [addLat, setAddLat] = useState('');
  const [addLng, setAddLng] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Modal State
  const [editingSite, setEditingSite] = useState<MineSiteRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadSites = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminMineSites();
      setMineSites(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch mine sites.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const handleOpenAdd = () => {
    setAddName('');
    setAddLocation('');
    setAddLat('');
    setAddLng('');
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addLocation.trim()) {
      setAddError('Colliery name and location are required.');
      return;
    }

    setSubmittingAdd(true);
    setAddError(null);
    try {
      const latVal = addLat ? parseFloat(addLat) : undefined;
      const lngVal = addLng ? parseFloat(addLng) : undefined;
      await createAdminMineSite({
        name: addName.trim(),
        location_name: addLocation.trim(),
        lat: latVal,
        lng: lngVal,
      });
      setShowAddModal(false);
      await loadSites();
    } catch (err: any) {
      setAddError(err?.response?.data?.detail || err.message || 'Failed to create mine site.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleOpenEdit = (site: MineSiteRecord) => {
    setEditingSite(site);
    setEditName(site.name);
    setEditLocation(site.location_name);
    setEditLat(site.lat !== null && site.lat !== undefined ? String(site.lat) : '');
    setEditLng(site.lng !== null && site.lng !== undefined ? String(site.lng) : '');
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;
    if (!editName.trim() || !editLocation.trim()) {
      setEditError('Colliery name and location are required.');
      return;
    }

    setSubmittingEdit(true);
    setEditError(null);
    try {
      const latVal = editLat ? parseFloat(editLat) : undefined;
      const lngVal = editLng ? parseFloat(editLng) : undefined;
      await updateAdminMineSite(editingSite.id, {
        name: editName.trim(),
        location_name: editLocation.trim(),
        lat: latVal,
        lng: lngVal,
      });
      setEditingSite(null);
      await loadSites();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || err.message || 'Failed to update mine site.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleActive = async (site: MineSiteRecord) => {
    const nextState = !site.is_active;
    const actionLabel = nextState ? 'Reactivate' : 'Deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} "${site.name}"?`)) {
      return;
    }

    try {
      await updateAdminMineSite(site.id, { is_active: nextState });
      await loadSites();
    } catch (err: any) {
      alert(err?.response?.data?.detail || err.message || `Failed to ${actionLabel.toLowerCase()} site.`);
    }
  };

  const filteredSites = useMemo(() => {
    return mineSites.filter((site) => {
      const matchesSearch =
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? site.is_active
          : !site.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [mineSites, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = mineSites.length;
    const active = mineSites.filter((s) => s.is_active).length;
    const inactive = total - active;
    const totalZones = mineSites.reduce((acc, s) => acc + (s.zones_count || 0), 0);
    return { total, active, inactive, totalZones };
  }, [mineSites]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-blue-800">
            System Administration / Provisioning
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Mine Sites Directory & Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision new colliery sites, calibrate GIS spatial coordinates, and regulate operational active status
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onSwitchToMap && (
            <button
              onClick={onSwitchToMap}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
            >
              <Compass className="w-4 h-4 text-blue-700" />
              <span>Interactive GIS Map</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Mine Site</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sites</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Active Collieries</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Deactivated</span>
          <div className="text-2xl font-bold text-slate-600 mt-1">{stats.inactive}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Total Work Zones</span>
          <div className="text-2xl font-bold text-blue-800 mt-1">{stats.totalZones}</div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={loadSites} className="font-semibold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative min-w-[280px] flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by mine name, coalfield location, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({mineSites.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Deactivated ({stats.inactive})
            </button>
          </div>
        </div>

        <button
          onClick={loadSites}
          className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sites Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading && mineSites.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading registered mine sites...</div>
        ) : filteredSites.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No mine sites found matching the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Colliery Name</th>
                  <th className="py-3.5 px-4">Location / Coalfield</th>
                  <th className="py-3.5 px-4">GIS Coordinates</th>
                  <th className="py-3.5 px-4">Operational Zones</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{site.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{site.id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{site.location_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {site.lat !== null && site.lat !== undefined && site.lng !== null && site.lng !== undefined ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {site.lat.toFixed(4)}° N, {site.lng.toFixed(4)}° E
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not calibrated</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 font-semibold">
                        <Layers className="w-3 h-3" />
                        {site.zones_count || 1} Zone(s)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {site.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(site)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(site)}
                          className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-colors flex items-center gap-1 ${
                            site.is_active
                              ? 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{site.is_active ? 'Deactivate' : 'Reactivate'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD MINE SITE */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Provision New Colliery Site</h3>
                <p className="text-xs text-slate-500">
                  Register a statutory mine site and calibrate its surface/underground spatial coordinates
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mine Site / Colliery Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Moonidih Underground Mine (BCCL)"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Location / Region / Coalfield *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jharia Coalfield, Dhanbad, Jharkhand"
                  value={addLocation}
                  onChange={(e) => setAddLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Latitude (° N)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 23.7388"
                    value={addLat}
                    onChange={(e) => setAddLat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Longitude (° E)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 86.3533"
                    value={addLng}
                    onChange={(e) => setAddLng(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {submittingAdd ? 'Provisioning...' : 'Provision Mine Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT MINE SITE */}
      {/* ========================================================================= */}
      {editingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Colliery Details</h3>
                <p className="text-xs text-slate-500">
                  Update statutory metadata and GIS coordinates for {editingSite.name}
                </p>
              </div>
              <button
                onClick={() => setEditingSite(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mine Site / Colliery Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Location / Region / Coalfield *
                </label>
                <input
                  type="text"
                  required
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Latitude (° N)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Longitude (° E)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSite(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
