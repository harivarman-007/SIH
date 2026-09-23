import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  Building2,
  FileCheck2,
} from 'lucide-react';
import {
  fetchAttendance,
  createAttendance,
  fetchLabourRules,
  AttendanceItem,
  LabourRule,
  AttendanceCreatePayload,
} from '../api/labour';
import { useAuthStore } from '../store/authStore';

export const LabourRegisterView: React.FC = () => {
  const { user } = useAuthStore();
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [rules, setRules] = useState<LabourRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterViolation, setFilterViolation] = useState<'all' | 'violations' | 'overtime' | 'rest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New entry form state
  const [formData, setFormData] = useState<Partial<AttendanceCreatePayload>>({
    worker_id: '',
    worker_name: '',
    shift_date: new Date().toISOString().split('T')[0],
    shift_type: 'day',
    clock_in: '08:00',
    clock_out: '16:30',
    contractor_id: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [attData, rulesData] = await Promise.all([
        fetchAttendance({ limit: 100 }),
        fetchLabourRules().catch(() => null),
      ]);
      setAttendance(attData || []);
      if (rulesData) setRules(rulesData);
    } catch (err) {
      console.error('Failed to load labour register data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.worker_id || !formData.worker_name || !formData.shift_date || !formData.clock_in) {
      setFormError('Please fill in Worker ID, Worker Name, Shift Date, and Clock In time.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      // Build ISO clock in/out strings
      const dateStr = formData.shift_date;
      const clockInIso = new Date(`${dateStr}T${formData.clock_in}:00`).toISOString();
      const clockOutIso = formData.clock_out
        ? new Date(`${dateStr}T${formData.clock_out}:00`).toISOString()
        : undefined;

      const payload: AttendanceCreatePayload = {
        worker_id: formData.worker_id.trim(),
        worker_name: formData.worker_name.trim(),
        mine_site_id: user?.mine_site_id || '5f92941a-dbf7-4697-a3d7-1c101210523c',
        contractor_id: formData.contractor_id ? formData.contractor_id.trim() : null,
        shift_date: dateStr,
        shift_type: formData.shift_type || 'day',
        clock_in: clockInIso,
        clock_out: clockOutIso,
      };

      await createAttendance(payload);
      setShowModal(false);
      setFormData({
        worker_id: '',
        worker_name: '',
        shift_date: new Date().toISOString().split('T')[0],
        shift_type: 'day',
        clock_in: '08:00',
        clock_out: '16:30',
        contractor_id: '',
      });
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Failed to record attendance');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered rows
  const filteredAttendance = attendance.filter((item) => {
    // Violation filter
    if (filterViolation === 'violations' && !item.is_violation) return false;
    if (filterViolation === 'overtime' && (!item.is_violation || !item.violation_reason?.toLowerCase().includes('overtime') && item.overtime_hours <= 0)) {
      return false;
    }
    if (filterViolation === 'rest' && (!item.is_violation || !item.violation_reason?.toLowerCase().includes('rest'))) {
      return false;
    }

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = item.worker_name.toLowerCase().includes(q);
      const matchId = item.worker_id.toLowerCase().includes(q);
      const matchContractor = item.contractor_id?.toLowerCase().includes(q) || false;
      if (!matchName && !matchId && !matchContractor) return false;
    }

    return true;
  });

  const totalViolations = attendance.filter((a) => a.is_violation).length;
  const compliantCount = attendance.length - totalViolations;
  const complianceRate = attendance.length > 0 ? Math.round((compliantCount / attendance.length) * 100) : 100;

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Statutory Labour Register — Mines Act 1952 (Sections 28, 30 & 31)
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Labour Compliance & Attendance Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time statutory muster roll, shift limits verification, and automated overtime/rest violation tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium">
            <Clock className="size-3.5 text-blue-700" />
            <span>Mines Act Rules: 8h shift · 2h max OT · 16h rest</span>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Record Attendance</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Shift Entries</span>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">{attendance.length}</div>
          <div className="text-[11px] text-slate-500">Muster records across authorized colliery</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Compliant Shifts</span>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono">{compliantCount}</div>
          <div className="text-[11px] text-slate-500">
            {complianceRate}% statutory compliance rate
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Statutory Violations</span>
          <div className="text-2xl font-extrabold text-rose-700 font-mono">{totalViolations}</div>
          <div className="text-[11px] text-slate-500">Exceeding shift, OT, or rest limits</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Mines Act Thresholds</span>
          <div className="text-base font-bold text-slate-800 mt-1">
            {rules ? `${rules.max_shift_hours}h / ${rules.max_overtime_hours}h OT` : '8.0h / 2.0h OT'}
          </div>
          <div className="text-[11px] text-slate-500">
            Min {rules ? rules.min_rest_hours_between_shifts : 16}h rest mandatory
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Violation filter pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterViolation('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterViolation === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Shifts ({attendance.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterViolation('violations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterViolation === 'violations'
                ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="size-3 text-rose-600" />
            Violations Only ({totalViolations})
          </button>
          <button
            type="button"
            onClick={() => setFilterViolation('overtime')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterViolation === 'overtime'
                ? 'bg-amber-50 text-amber-700 shadow-2xs border border-amber-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overtime Breaches
          </button>
          <button
            type="button"
            onClick={() => setFilterViolation('rest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterViolation === 'rest'
                ? 'bg-indigo-50 text-indigo-700 shadow-2xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rest Violations
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search worker ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Attendance Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-blue-700" />
            <h2 className="text-sm font-bold text-slate-900">Muster Roll & Shift Entries</h2>
            <span className="text-xs text-slate-400">({filteredAttendance.length} records)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Worker Info</th>
                <th className="py-3 px-4">Shift Date & Type</th>
                <th className="py-3 px-4">Clock In / Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Overtime</th>
                <th className="py-3 px-4">Contractor / Dept</th>
                <th className="py-3 px-4">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-blue-700" />
                    Loading labour muster roll...
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No attendance records found matching the active criteria.
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((item) => {
                  const clockInFormatted = new Date(item.clock_in).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const clockOutFormatted = item.clock_out
                    ? new Date(item.clock_out).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Active Shift';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Worker Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.worker_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">ID: {item.worker_id}</div>
                      </td>

                      {/* Shift Date & Type */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{item.shift_date}</div>
                        <span
                          className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold uppercase ${
                            item.shift_type === 'night'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {item.shift_type} Shift
                        </span>
                      </td>

                      {/* Clock In / Out */}
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        <div>In: {clockInFormatted}</div>
                        <div className="text-slate-400">Out: {clockOutFormatted}</div>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono">{item.hours_worked.toFixed(1)}h</div>
                        <div className="text-[10px] text-slate-400">
                          {item.hours_worked > 8.0 ? 'Exceeds standard 8h' : 'Within shift cap'}
                        </div>
                      </td>

                      {/* Overtime */}
                      <td className="py-3.5 px-4 font-mono">
                        {item.overtime_hours > 0 ? (
                          <span
                            className={`font-semibold ${
                              item.overtime_hours > 2.0 ? 'text-rose-700 font-bold' : 'text-amber-700'
                            }`}
                          >
                            +{item.overtime_hours.toFixed(1)}h OT
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>

                      {/* Contractor / Dept */}
                      <td className="py-3.5 px-4">
                        {item.contractor_id ? (
                          <div className="flex items-center gap-1 text-slate-700">
                            <Building2 className="size-3 text-slate-400" />
                            <span>{item.contractor_id}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-medium">BCCL Direct Employee</span>
                        )}
                      </td>

                      {/* Compliance Status */}
                      <td className="py-3.5 px-4">
                        {item.is_violation ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <ShieldAlert className="size-3 text-rose-600" />
                              Statutory Violation
                            </span>
                            {item.violation_reason && (
                              <div
                                className="text-[10px] text-rose-600 mt-1 max-w-xs leading-tight font-medium"
                                title={item.violation_reason}
                              >
                                {item.violation_reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Compliant
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Attendance Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Shift Attendance</h3>
                <p className="text-xs text-slate-500">Muster register entry under Mines Act 1952</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAttendance} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Worker ID *</label>
                <input
                  type="text"
                  placeholder="e.g. W-1049"
                  value={formData.worker_id}
                  onChange={(e) => setFormData({ ...formData, worker_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Worker Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={formData.worker_name}
                  onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Date *</label>
                  <input
                    type="date"
                    value={formData.shift_date}
                    onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Type *</label>
                  <select
                    value={formData.shift_type}
                    onChange={(e) => setFormData({ ...formData, shift_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="day">Day Shift (08:00 - 16:30)</option>
                    <option value="night">Night Shift (20:00 - 04:30)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clock In Time *</label>
                  <input
                    type="time"
                    value={formData.clock_in}
                    onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clock Out Time</label>
                  <input
                    type="time"
                    value={formData.clock_out || ''}
                    onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contractor ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CONTR-ABC-ENG (Leave blank for direct employee)"
                  value={formData.contractor_id || ''}
                  onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
