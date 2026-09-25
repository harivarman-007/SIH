import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  Users,
  FileCheck2,
  UserPlus,
  Check,
} from 'lucide-react';
import {
  fetchAttendance,
  createAttendance,
  bulkCreateAttendance,
  fetchWorkers,
  createWorker,
  updateWorker,
  fetchLabourRules,
  AttendanceItem,
  WorkerItem,
  LabourRule,
  AttendanceCreatePayload,
  AttendanceBulkPayload,
  WorkerCreatePayload,
} from '../api/labour';
import { useAuthStore } from '../store/authStore';

export const LabourRegisterView: React.FC = () => {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'mine_official' || user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<'attendance' | 'workers'>('attendance');

  // Attendance state
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [rules, setRules] = useState<LabourRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterViolation, setFilterViolation] = useState<'all' | 'violations' | 'overtime' | 'rest'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Workers state
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerStatusFilter, setWorkerStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Single attendance modal
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerPickerQuery, setWorkerPickerQuery] = useState('');
  const [singleShiftDate, setSingleShiftDate] = useState(new Date().toISOString().split('T')[0]);
  const [singleShiftType, setSingleShiftType] = useState('day');
  const [singleClockIn, setSingleClockIn] = useState('08:00');
  const [singleClockOut, setSingleClockOut] = useState('16:30');
  const [submittingSingle, setSubmittingSingle] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Bulk attendance modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkShiftDate, setBulkShiftDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkShiftType, setBulkShiftType] = useState('day');
  const [bulkClockIn, setBulkClockIn] = useState('08:00');
  const [bulkClockOut, setBulkClockOut] = useState('16:30');
  const [bulkWorkerSearch, setBulkWorkerSearch] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Create worker modal
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [newBadge, setNewBadge] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('General Miner');
  const [newContractorId, setNewContractorId] = useState('');
  const [submittingWorker, setSubmittingWorker] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attData, workersData, rulesData] = await Promise.all([
        fetchAttendance({ limit: 150 }),
        fetchWorkers({ limit: 300 }),
        fetchLabourRules().catch(() => null),
      ]);
      setAttendance(attData || []);
      setWorkers(workersData || []);
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

  // ---------------------------------------------------------------------------
  // Handlers: Single Attendance
  // ---------------------------------------------------------------------------
  const handleCreateSingleAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) {
      setSingleError('Please select a worker from the master directory.');
      return;
    }

    setSubmittingSingle(true);
    setSingleError(null);
    try {
      const clockInIso = new Date(`${singleShiftDate}T${singleClockIn}:00`).toISOString();
      const clockOutIso = singleClockOut
        ? new Date(`${singleShiftDate}T${singleClockOut}:00`).toISOString()
        : undefined;

      const payload: AttendanceCreatePayload = {
        worker_id: selectedWorkerId,
        shift_date: singleShiftDate,
        shift_type: singleShiftType,
        clock_in: clockInIso,
        clock_out: clockOutIso,
      };

      await createAttendance(payload);
      setShowSingleModal(false);
      setSelectedWorkerId('');
      setWorkerPickerQuery('');
      await loadData();
    } catch (err: any) {
      setSingleError(err.response?.data?.detail || err.message || 'Failed to record attendance');
    } finally {
      setSubmittingSingle(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Bulk Attendance
  // ---------------------------------------------------------------------------
  const handleCreateBulkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkSelectedIds.length === 0) {
      setBulkError('Please select at least one worker to log shift attendance.');
      return;
    }

    setSubmittingBulk(true);
    setBulkError(null);
    try {
      const clockInIso = new Date(`${bulkShiftDate}T${bulkClockIn}:00`).toISOString();
      const clockOutIso = bulkClockOut
        ? new Date(`${bulkShiftDate}T${bulkClockOut}:00`).toISOString()
        : undefined;

      const payload: AttendanceBulkPayload = {
        worker_ids: bulkSelectedIds,
        mine_site_id: user?.mine_site_id || workers[0]?.mine_site_id || '5f92941a-dbf7-4697-a3d7-1c101210523c',
        shift_date: bulkShiftDate,
        shift_type: bulkShiftType,
        clock_in: clockInIso,
        clock_out: clockOutIso,
      };

      await bulkCreateAttendance(payload);
      setShowBulkModal(false);
      setBulkSelectedIds([]);
      await loadData();
    } catch (err: any) {
      setBulkError(err.response?.data?.detail || err.message || 'Failed to record bulk attendance');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const toggleBulkWorker = (id: string) => {
    setBulkSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllActive = () => {
    const activeIds = workers.filter((w) => w.is_active).map((w) => w.id);
    if (bulkSelectedIds.length === activeIds.length) {
      setBulkSelectedIds([]);
    } else {
      setBulkSelectedIds(activeIds);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Register Worker
  // ---------------------------------------------------------------------------
  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBadge.trim() || !newName.trim()) {
      setWorkerError('Please provide a unique Badge Number and Full Name.');
      return;
    }

    setSubmittingWorker(true);
    setWorkerError(null);
    try {
      const payload: WorkerCreatePayload = {
        badge_number: newBadge.trim(),
        name: newName.trim(),
        role: newRole.trim() || 'General Miner',
        contractor_id: newContractorId.trim() || null,
        mine_site_id: user?.mine_site_id || '5f92941a-dbf7-4697-a3d7-1c101210523c',
        is_active: true,
      };

      await createWorker(payload);
      setShowWorkerModal(false);
      setNewBadge('');
      setNewName('');
      setNewRole('General Miner');
      setNewContractorId('');
      await loadData();
    } catch (err: any) {
      setWorkerError(err.response?.data?.detail || err.message || 'Failed to register worker');
    } finally {
      setSubmittingWorker(false);
    }
  };

  const handleToggleWorkerStatus = async (worker: WorkerItem) => {
    try {
      await updateWorker(worker.id, { is_active: !worker.is_active });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update worker status');
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered lists
  // ---------------------------------------------------------------------------
  const filteredAttendance = attendance.filter((item) => {
    if (filterViolation === 'violations' && !item.is_violation) return false;
    if (filterViolation === 'overtime' && (!item.is_violation || !item.violation_reason?.toLowerCase().includes('overtime') && item.overtime_hours <= 0)) {
      return false;
    }
    if (filterViolation === 'rest' && (!item.is_violation || !item.violation_reason?.toLowerCase().includes('rest'))) {
      return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = item.worker_name.toLowerCase().includes(q);
      const matchBadge = item.worker_badge_number?.toLowerCase().includes(q);
      const matchRole = item.worker_role?.toLowerCase().includes(q);
      const matchContractor = item.contractor_name?.toLowerCase().includes(q);
      if (!matchName && !matchBadge && !matchRole && !matchContractor) return false;
    }

    return true;
  });

  const filteredWorkers = workers.filter((w) => {
    if (workerStatusFilter === 'active' && !w.is_active) return false;
    if (workerStatusFilter === 'inactive' && w.is_active) return false;

    if (workerSearch) {
      const q = workerSearch.toLowerCase();
      const matchName = w.name.toLowerCase().includes(q);
      const matchBadge = w.badge_number.toLowerCase().includes(q);
      const matchRole = w.role.toLowerCase().includes(q);
      if (!matchName && !matchBadge && !matchRole) return false;
    }

    return true;
  });

  const totalViolations = attendance.filter((a) => a.is_violation).length;
  const compliantCount = attendance.length - totalViolations;
  const complianceRate = attendance.length > 0 ? Math.round((compliantCount / attendance.length) * 100) : 100;
  const overtimeCount = attendance.filter((a) => a.is_violation && a.violation_reason?.toLowerCase().includes('overtime')).length;
  const restCount = attendance.filter((a) => a.is_violation && a.violation_reason?.toLowerCase().includes('rest')).length;

  const selectedWorkerObj = workers.find((w) => w.id === selectedWorkerId);

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
            Decoupled worker identity directory, statutory muster roll, and automated overtime/rest violation tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium">
            <Clock className="size-3.5 text-blue-700" />
            <span>
              Mines Act Rules: {rules?.max_shift_hours ?? 8}h shift · {rules?.max_overtime_hours ?? 2}h max OT · {rules?.min_rest_hours_between_shifts ?? 16}h rest
            </span>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'attendance'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileCheck2 className="size-3.5" />
          <span>Statutory Muster Roll</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'attendance' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {attendance.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'workers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="size-3.5" />
          <span>Worker Master Directory</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'workers' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {workers.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MUSTER ROLL ATTENDANCE REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <>
          {/* Statutory Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Shifts Logged</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{attendance.length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Recorded muster entries</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Workers</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {new Set(attendance.map((a) => a.worker_id)).size}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Colliery workforce deployed</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Overtime Breaches</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{overtimeCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">&gt; 2h statutory overtime ceiling</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Rest Breaches</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{restCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">&lt; 16h rest interval between shifts</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Compliance Rate</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{complianceRate}%</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Mines Act compliant shifts</div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[240px]">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search worker name, badge, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Violation Filter Chips */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setFilterViolation('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterViolation === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({attendance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterViolation('violations')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterViolation === 'violations' ? 'bg-rose-500 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  All Violations ({totalViolations})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterViolation('overtime')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterViolation === 'overtime' ? 'bg-rose-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  OT Breach ({overtimeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterViolation('rest')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterViolation === 'rest' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rest Breach ({restCount})
                </button>
              </div>
            </div>

            {canEdit ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkError(null);
                    setShowBulkModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Users className="size-3.5 text-blue-700" />
                  <span>Bulk Shift Logging</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSingleError(null);
                    setShowSingleModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>Log Shift Entry</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
                <ShieldAlert className="size-3.5 text-blue-700" />
                <span>Statutory Read-Only Access (DGMS / Regulatory Audit)</span>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Worker Identity</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Shift Date & Type</th>
                    <th className="py-3 px-4">Clock In / Out</th>
                    <th className="py-3 px-4">Hours / Overtime</th>
                    <th className="py-3 px-4">Contractor / Direct</th>
                    <th className="py-3 px-4">Compliance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-blue-700" />
                        Loading labour muster roll...
                      </td>
                    </tr>
                  )}

                  {!loading && filteredAttendance.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileCheck2 className="size-8 mx-auto mb-2 text-slate-300" />
                        No shift attendance records match the selected filter.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredAttendance.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {item.worker_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{item.worker_name}</div>
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {item.worker_badge_number}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-700 font-medium">
                            {item.worker_role || 'Colliery Miner'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="text-slate-900">{item.shift_date.split('T')[0]}</div>
                            <span className="capitalize text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              {item.shift_type} Shift
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-800">
                            {new Date(item.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {item.clock_out
                              ? new Date(item.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : <span className="text-amber-600 font-sans italic">Ongoing</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{item.hours_worked.toFixed(1)}h</span>
                            {item.overtime_hours > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                item.overtime_hours > (rules?.max_overtime_hours ?? 2)
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}>
                                +{item.overtime_hours.toFixed(1)}h OT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.contractor_name ? (
                            <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 font-medium">
                              {item.contractor_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium">Direct Employee</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.is_violation ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px]">
                              <ShieldAlert className="size-3 text-rose-600 shrink-0" />
                              <span title={item.violation_reason || 'Statutory Breach'}>
                                {item.violation_reason?.includes('rest')
                                  ? 'Rest Breach (<16h)'
                                  : item.violation_reason?.includes('exceeds')
                                  ? 'Shift Limit Breach'
                                  : 'Overtime Breach'}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                              <span>Compliant</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WORKER MASTER DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[260px]">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by worker name, badge #, or role..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    workerStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({workers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    workerStatusFilter === 'active' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Active ({workers.filter((w) => w.is_active).length})
                </button>
                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('inactive')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    workerStatusFilter === 'inactive' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Inactive ({workers.filter((w) => !w.is_active).length})
                </button>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setWorkerError(null);
                  setShowWorkerModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <UserPlus className="size-3.5" />
                <span>Register New Worker</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Badge Number</th>
                    <th className="py-3 px-4">Worker Full Name</th>
                    <th className="py-3 px-4">Designation / Role</th>
                    <th className="py-3 px-4">Employment Category</th>
                    <th className="py-3 px-4">Status</th>
                    {canEdit && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredWorkers.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 6 : 5} className="py-12 text-center text-slate-400">
                        <Users className="size-8 mx-auto mb-2 text-slate-300" />
                        No workers found matching your filter criteria.
                      </td>
                    </tr>
                  )}

                  {filteredWorkers.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {w.badge_number}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {w.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{w.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{w.role}</td>
                      <td className="py-3 px-4">
                        {w.contractor_name ? (
                          <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 font-medium">
                            Contracted: {w.contractor_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                            Direct Colliery Employee
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {w.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            Deactivated
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleWorkerStatus(w)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                              w.is_active
                                ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {w.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SINGLE SHIFT ATTENDANCE WITH WORKER PICKER */}
      {/* ========================================================================= */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">Record Shift Attendance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSingleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleAttendance} className="p-5 overflow-y-auto space-y-4 text-xs">
              {singleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-rose-600" />
                  <span>{singleError}</span>
                </div>
              )}

              {/* Worker Picker (Type-Ahead Search) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Worker Selection (from Master Directory) *
                </label>
                {selectedWorkerObj ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/60">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        {selectedWorkerObj.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{selectedWorkerObj.name}</div>
                        <div className="text-[10px] text-slate-500">
                          Badge: <span className="font-mono font-bold text-slate-700">{selectedWorkerObj.badge_number}</span> · {selectedWorkerObj.role}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWorkerId('')}
                      className="text-xs text-blue-700 hover:underline font-semibold"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search worker by name or badge #..."
                        value={workerPickerQuery}
                        onChange={(e) => setWorkerPickerQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                      {workers
                        .filter((w) => w.is_active)
                        .filter((w) =>
                          workerPickerQuery
                            ? w.name.toLowerCase().includes(workerPickerQuery.toLowerCase()) ||
                              w.badge_number.toLowerCase().includes(workerPickerQuery.toLowerCase())
                            : true
                        )
                        .map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWorkerId(w.id)}
                            className="w-full text-left p-2.5 hover:bg-blue-50/50 flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">{w.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {w.badge_number} · {w.role}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Select
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Shift Date & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Shift Date *
                  </label>
                  <input
                    type="date"
                    value={singleShiftDate}
                    onChange={(e) => setSingleShiftDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Shift Type *
                  </label>
                  <select
                    value={singleShiftType}
                    onChange={(e) => setSingleShiftType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                  </select>
                </div>
              </div>

              {/* Clock In / Out */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Clock In Time *
                  </label>
                  <input
                    type="time"
                    value={singleClockIn}
                    onChange={(e) => setSingleClockIn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Clock Out Time
                  </label>
                  <input
                    type="time"
                    value={singleClockOut}
                    onChange={(e) => setSingleClockOut(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSingle}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
                >
                  {submittingSingle && <RefreshCw className="size-3.5 animate-spin" />}
                  <span>Save Attendance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BULK SHIFT ATTENDANCE LOGGING */}
      {/* ========================================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">Bulk Shift Logging (Crew Muster)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBulkAttendance} className="p-5 overflow-y-auto space-y-4 text-xs">
              {bulkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-rose-600" />
                  <span>{bulkError}</span>
                </div>
              )}

              {/* Shift Configuration */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Shift Date</label>
                  <input
                    type="date"
                    value={bulkShiftDate}
                    onChange={(e) => setBulkShiftDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Shift Type</label>
                  <select
                    value={bulkShiftType}
                    onChange={(e) => setBulkShiftType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Clock In</label>
                  <input
                    type="time"
                    value={bulkClockIn}
                    onChange={(e) => setBulkClockIn(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Clock Out</label>
                  <input
                    type="time"
                    value={bulkClockOut}
                    onChange={(e) => setBulkClockOut(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Crew Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Select Shift Crew ({bulkSelectedIds.length} workers selected)
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllActive}
                    className="text-xs text-blue-700 hover:underline font-semibold"
                  >
                    {bulkSelectedIds.length === workers.filter((w) => w.is_active).length
                      ? 'Deselect All'
                      : 'Select All Active'}
                  </button>
                </div>

                <div className="relative mb-2">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search crew by name or badge..."
                    value={bulkWorkerSearch}
                    onChange={(e) => setBulkWorkerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {workers
                    .filter((w) => w.is_active)
                    .filter((w) =>
                      bulkWorkerSearch
                        ? w.name.toLowerCase().includes(bulkWorkerSearch.toLowerCase()) ||
                          w.badge_number.toLowerCase().includes(bulkWorkerSearch.toLowerCase())
                        : true
                    )
                    .map((w) => {
                      const isSelected = bulkSelectedIds.includes(w.id);
                      return (
                        <div
                          key={w.id}
                          onClick={() => toggleBulkWorker(w.id)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`size-4 rounded border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="size-3" />}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{w.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {w.badge_number} · {w.role}
                              </div>
                            </div>
                          </div>
                          {w.contractor_name && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              {w.contractor_name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk || bulkSelectedIds.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingBulk && <RefreshCw className="size-3.5 animate-spin" />}
                  <span>Log Attendance for {bulkSelectedIds.length} Workers</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REGISTER NEW WORKER IN MASTER DIRECTORY */}
      {/* ========================================================================= */}
      {showWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">Register Worker in Master Directory</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterWorker} className="p-5 space-y-3.5 text-xs">
              {workerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-rose-600" />
                  <span>{workerError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Badge Number / Worker ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. WRK-201 or 10452"
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Worker Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Kumar Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Designation / Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600"
                >
                  <option value="General Miner">General Miner</option>
                  <option value="Drill Operator">Drill Operator</option>
                  <option value="Loader Operator">Loader Operator</option>
                  <option value="Haulage Truck Driver">Haulage Truck Driver</option>
                  <option value="Blasting Sirdar">Blasting Sirdar</option>
                  <option value="Colliery Electrician">Colliery Electrician</option>
                  <option value="Ventilation Officer">Ventilation Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Employment Category
                </label>
                <input
                  type="text"
                  placeholder="Leave blank for Direct Employee, or enter Contractor UUID"
                  value={newContractorId}
                  onChange={(e) => setNewContractorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-600 font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWorkerModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWorker}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
                >
                  {submittingWorker && <RefreshCw className="size-3.5 animate-spin" />}
                  <span>Save Worker</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
