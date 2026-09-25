import React, { useState, useEffect, useMemo } from 'react';
import { fetchInspections, createInspection, fetchInspectionZones, ZoneOption } from '../api/inspections';
import { fetchUsers, UserInfo } from '../api/auth';
import { Inspection, InspectionStatus } from '../types/inspections';
import { usePermissions } from './providers/PermissionProvider';
import { useAuthStore } from '../store/authStore';
import { Permission } from '../types/permissions';
import { CalendarPlus, Clock, User, AlertCircle } from 'lucide-react';

export const InspectionsManagementView: React.FC = () => {
  const { can } = usePermissions();
  const { user } = useAuthStore();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectors, setInspectors] = useState<UserInfo[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [assignedInspectorId, setAssignedInspectorId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadInspections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInspections();
      setInspections(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load inspections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
    fetchUsers({ role: 'inspector' })
      .then((users) => {
        setInspectors(users);
        if (users.length > 0 && !assignedInspectorId) {
          setAssignedInspectorId(users[0].id);
        }
      })
      .catch(() => setInspectors([]));

    fetchInspectionZones(user?.mine_site_id ?? undefined)
      .then((zData) => {
        setZones(zData);
      })
      .catch(() => setZones([]));

    // Default scheduled date tomorrow 09:00
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow.setHours(9, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledFor(localTime);

    const due = new Date(tomorrow.getTime() + 8 * 3600 * 1000);
    const dueTime = new Date(due.getTime() - tzOffset).toISOString().slice(0, 16);
    setDueAt(dueTime);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Inspection title is required.');
      return;
    }
    if (!assignedInspectorId) {
      setFormError('Please select a field inspector.');
      return;
    }
    if (!scheduledFor) {
      setFormError('Scheduled date and time is required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const targetMineSiteId = user?.mine_site_id || '57064c56-5d0c-4efe-9854-e58a16032cfb';
    const computedDueAt = dueAt
      ? new Date(dueAt).toISOString()
      : new Date(new Date(scheduledFor).getTime() + 8 * 3600 * 1000).toISOString();

    try {
      await createInspection({
        mine_site_id: targetMineSiteId,
        zone_id: selectedZoneId || undefined,
        title: title.trim(),
        assigned_inspector_id: assignedInspectorId,
        scheduled_for: new Date(scheduledFor).toISOString(),
        due_at: computedDueAt,
        notes: notes.trim() || undefined,
      });

      setShowCreateModal(false);
      setTitle('');
      setSelectedZoneId('');
      setNotes('');
      await loadInspections();
    } catch (err: any) {
      setFormError(err.message || 'Failed to schedule inspection.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInspections = useMemo(() => {
    if (activeTab === 'all') return inspections;
    return inspections.filter((i) => (i.status || '').toLowerCase() === activeTab.toLowerCase());
  }, [inspections, activeTab]);

  const stats = useMemo(() => {
    return {
      total: inspections.length,
      scheduled: inspections.filter((i) => (i.status || '').toLowerCase() === 'scheduled').length,
      inProgress: inspections.filter((i) => (i.status || '').toLowerCase() === 'in_progress').length,
      completed: inspections.filter((i) => ['completed', 'submitted'].includes((i.status || '').toLowerCase())).length,
    };
  }, [inspections]);

  const getStatusBadge = (st: InspectionStatus | string) => {
    const s = (st || '').toLowerCase();
    switch (s) {
      case 'scheduled':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'in_progress':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'completed':
      case 'submitted':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-800 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-blue-800">
            Mine Safety Management / Field Audits
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Scheduled Mine Inspections</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan, assign, and review statutory underground and opencast safety inspections
          </p>
        </div>

        {can(Permission.INSPECTION_CREATE) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Schedule New Inspection</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Inspections</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Scheduled</span>
          <div className="text-2xl font-bold text-blue-700 mt-1">{stats.scheduled}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">In Progress</span>
          <div className="text-2xl font-bold text-amber-800 mt-1">{stats.inProgress}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.completed}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {['all', 'scheduled', 'in_progress', 'submitted', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-blue-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Inspections List */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading inspections...</div>
      ) : filteredInspections.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
          No inspections found for the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInspections.map((insp) => (
            <div
              key={insp.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 space-y-3 transition-all shadow-2xs hover:shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-800">{insp.code}</span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(insp.status)}`}>
                  {insp.status.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 leading-snug">{insp.title}</h3>

              {insp.notes && (
                <p className="text-xs text-slate-500 line-clamp-2">{insp.notes}</p>
              )}

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scheduled For:</span>
                    <span className="text-slate-800 font-medium">
                      {new Date(insp.scheduled_for).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Inspector:</span>
                    <span className="text-slate-800 font-medium truncate block">
                      {insp.assigned_inspector_name || 'Assigned Inspector'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">DGMS Statutory Protocol</span>
                <h2 className="text-lg font-bold text-zinc-950 mt-0.5">Schedule Field Inspection</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Inspection Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Monthly Underground Ventilation & Methane Check"
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Inspection Zone / Sector
                  </label>
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    <option value="">General Mine Site (All Zones)</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.zone_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Assign Inspector *
                  </label>
                  <select
                    value={assignedInspectorId}
                    onChange={(e) => setAssignedInspectorId(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    {inspectors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.full_name} ({i.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Scheduled Date &amp; Time *
                  </label>
                  <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          today.setHours(9, 0, 0, 0);
                          const tz = today.getTimezoneOffset() * 60000;
                          setScheduledFor(new Date(today.getTime() - tz).toISOString().slice(0, 16));
                        }}
                        className="text-[10px] text-blue-700 hover:text-blue-900 font-medium px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tmrw = new Date(Date.now() + 24 * 3600 * 1000);
                          tmrw.setHours(9, 0, 0, 0);
                          const tz = tmrw.getTimezoneOffset() * 60000;
                          setScheduledFor(new Date(tmrw.getTime() - tz).toISOString().slice(0, 16));
                        }}
                        className="text-[10px] text-zinc-600 hover:text-zinc-900 font-medium px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200"
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Notes &amp; Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mandatory check zones, equipment focus, or atmospheric sampling criteria..."
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Schedule Statutory Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
