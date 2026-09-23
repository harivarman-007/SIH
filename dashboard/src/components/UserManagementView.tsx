import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { fetchUsers, adminCreateUser, UserInfo, AuthRole } from '../api/auth';
import { usePermissions } from './providers/PermissionProvider';
import { Permission } from '../types/permissions';

export const UserManagementView: React.FC = () => {
  const { can } = usePermissions();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provision modal
  const [showModal, setShowModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthRole>('inspector');
  const [mineSiteId, setMineSiteId] = useState('11111111-1111-1111-1111-111111111111');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load user list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setFormError('All fields are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await adminCreateUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        mine_site_id: role === 'super_admin' ? undefined : mineSiteId,
      });

      setFormSuccess(`User ${email} provisioned successfully!`);
      setShowModal(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('inspector');
      loadUsers();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === 'string' ? detail : err.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'super_admin':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'corporate_management':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'mine_official':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'inspector':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'contractor':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'regulator':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            System Administration / Identity & Access Governance
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">User & Role Provisioning Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authenticated personnel, role boundaries, and site-level access grants
          </p>
        </div>

        {can(Permission.USER_CREATE) && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start lg:self-auto"
          >
            <UserPlus className="size-3.5" />
            <span>Provision New User</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {formSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            System User Directory ({users.length})
          </h3>
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Refresh directory"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin text-blue-700" />
            <span>Loading user directory...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Mine Site Scope</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const initial = (u.full_name?.replace(/[^a-zA-Z]/g, '').slice(0, 1) || 'U').toUpperCase();
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
                        <div className="size-6 rounded-full bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {initial}
                        </div>
                        <span>{u.full_name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${getRoleBadge(u.role)}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {u.mine_site_id ? u.mine_site_id.slice(0, 8) + '...' : 'Global / Corporate'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Security Provisioning</span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">Provision System Account</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@mine.in"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-blue-700 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Temporary Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-blue-700 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AuthRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white transition-colors"
                >
                  <option value="inspector">Safety Inspector (Field Mobility)</option>
                  <option value="mine_official">Mine Manager / Safety Officer</option>
                  <option value="contractor">Remediation Contractor</option>
                  <option value="regulator">Regulatory Authority (DGMS)</option>
                  <option value="corporate_management">Corporate HQ Management</option>
                  <option value="super_admin">System Super Admin</option>
                </select>
              </div>

              {role !== 'super_admin' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mine Site Jurisdiction ID</label>
                  <input
                    type="text"
                    value={mineSiteId}
                    onChange={(e) => setMineSiteId(e.target.value)}
                    placeholder="UUID or mine identifier"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-blue-700 focus:bg-white transition-colors"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Provisioning…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
