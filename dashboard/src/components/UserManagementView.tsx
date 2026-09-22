import React, { useState, useEffect } from 'react';
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
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to provision user.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (r: AuthRole) => {
    switch (r) {
      case 'super_admin':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'corporate_management':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'mine_official':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'inspector':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'contractor':
        return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      case 'regulator':
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
            System Administration / Identity & Access Governance
          </div>
          <h1 className="text-2xl font-black text-white mt-1">User & Role Provisioning Console</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage authenticated personnel, role boundaries, and site-level access grants
          </p>
        </div>

        {can(Permission.USER_CREATE) && (
          <button
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setShowModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <span>👤</span>
            <span>Provision New User</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {formSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
          {formSuccess}
        </div>
      )}

      {/* Users Table */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            System User Directory ({users.length})
          </h3>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="text-xs text-zinc-400 hover:text-white"
          >
            ⟳ Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-400 text-xs">Loading user directory...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Mine Site Scope</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300 font-bold">
                        {u.full_name?.charAt(0) || 'U'}
                      </div>
                      <span>{u.full_name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300 font-mono">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${getRoleBadge(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                      {u.mine_site_id ? u.mine_site_id.slice(0, 8) + '...' : 'Global / Corporate'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Active</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase text-amber-500">Security Provisioning</span>
              <h2 className="text-lg font-bold text-white mt-0.5">Provision System Account</h2>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@intellifusion.io"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    System Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AuthRole)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="inspector">Field Safety Inspector</option>
                    <option value="contractor">Remediation Contractor</option>
                    <option value="mine_official">Mine Manager / Official</option>
                    <option value="corporate_management">Corporate Manager</option>
                    <option value="regulator">DGMS Regulatory Authority</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Assigned Mine Site ID
                  </label>
                  <input
                    type="text"
                    value={mineSiteId}
                    onChange={(e) => setMineSiteId(e.target.value)}
                    placeholder="UUID or leave default"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs disabled:opacity-50"
                >
                  {submitting ? 'Provisioning...' : 'Provision User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
