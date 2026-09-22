import React, { useState, useEffect, useMemo } from 'react';
import { fetchInspections, createInspection } from '../api/inspections';
import { fetchUsers, UserInfo } from '../api/auth';
import { Inspection, InspectionStatus } from '../types/inspections';
import { usePermissions } from './providers/PermissionProvider';
import { Permission } from '../types/permissions';

export const InspectionsManagementView: React.FC = () => {
  const { can } = usePermissions();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectors, setInspectors] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [mineSiteId] = useState('11111111-1111-1111-1111-111111111111');
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
    try {
      await createInspection({
        mine_site_id: mineSiteId,
        title: title.trim(),
        assigned_inspector_id: assignedInspectorId,
        scheduled_for: new Date(scheduledFor).toISOString(),
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });

      setShowCreateModal(false);
      setTitle('');
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
    return inspections.filter((i) => i.status === activeTab);
  }, [inspections, activeTab]);

  const stats = useMemo(() => {
    return {
      total: inspections.length,
      scheduled: inspections.filter((i) => i.status === 'scheduled').length,
      inProgress: inspections.filter((i) => i.status === 'in_progress').length,
      completed: inspections.filter((i) => i.status === 'completed' || i.status === 'submitted').length,
    };
  }, [inspections]);

  const getStatusBadge = (st: InspectionStatus) => {
    switch (st) {
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'in_progress':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'completed':
      case 'submitted':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'cancelled':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 backdrop-blur-xl">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Mine Safety Management / Field Audits
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Scheduled Mine Inspections</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Plan, assign, and review statutory underground and opencast safety inspections
          </p>
        </div>

        {can(Permission.INSPECTION_CREATE) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <span>📅</span>
            <span>Schedule New Inspection</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400 uppercase">Total Inspections</span>
          <div className="text-2xl font-black text-white mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <span className="text-xs font-semibold text-blue-400 uppercase">Scheduled</span>
          <div className="text-2xl font-black text-blue-400 mt-1">{stats.scheduled}</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <span className="text-xs font-semibold text-amber-400 uppercase">In Progress</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.inProgress}</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <span className="text-xs font-semibold text-emerald-400 uppercase">Completed</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.completed}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        {['all', 'scheduled', 'in_progress', 'submitted', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Inspections List */}
      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-sm">Loading inspections...</div>
      ) : filteredInspections.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800 text-zinc-500 text-sm">
          No inspections found for the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInspections.map((insp) => (
            <div
              key={insp.id}
              className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 space-y-3 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">{insp.code}</span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(insp.status)}`}>
                  {insp.status.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white leading-snug">{insp.title}</h3>

              {insp.notes && (
                <p className="text-xs text-zinc-400 line-clamp-2">{insp.notes}</p>
              )}

              <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Scheduled For:</span>
                  <span className="text-zinc-200 font-medium">
                    {new Date(insp.scheduled_for).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Inspector:</span>
                  <span className="text-zinc-200 font-medium truncate block">
                    {insp.assigned_inspector_name || 'Assigned Inspector'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div>
              <span className="text-xs font-bold uppercase text-amber-500">DGMS Compliance Protocol</span>
              <h2 className="text-lg font-bold text-white mt-0.5">Schedule Field Inspection</h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Inspection Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Monthly Underground Ventilation & Methane Check"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Assign Inspector *
                  </label>
                  <select
                    value={assignedInspectorId}
                    onChange={(e) => setAssignedInspectorId(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {inspectors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.full_name} ({i.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Scheduled Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Notes & Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mandatory check zones, equipment focus, or atmospheric sampling criteria..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Schedule & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
