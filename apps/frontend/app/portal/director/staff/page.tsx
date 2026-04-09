'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Role = { id: string; code: string; label: string };
type StaffUser = { id: string; email: string; isActive: boolean; createdAt: string; roles: { role: Role }[] };

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  principal: 'bg-indigo-100 text-indigo-700',
  teacher: 'bg-green-100 text-green-700',
  student: 'bg-yellow-100 text-yellow-700',
  parent: 'bg-orange-100 text-orange-700',
};

export default function DirectorStaffViewPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('all');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', roleId: '' });
  const [creating, setCreating] = useState(false);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const loadData = () => {
    setLoading(true);
    Promise.all([apiFetch('/users'), apiFetch('/roles')])
      .then(([users, rolesRes]) => { setStaff(users); setRoles(rolesRes); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password) return setError('Email and password are required');
    setCreating(true);
    setError(null);
    try {
      const newUser = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      if (form.roleId) {
        await apiFetch(`/users/${newUser.id}/roles`, {
          method: 'POST',
          body: JSON.stringify({ roleId: form.roleId }),
        });
      }
      showSuccess(`User ${form.email} created successfully`);
      setShowCreate(false);
      setForm({ email: '', password: '', roleId: '' });
      loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const filteredStaff = filterRole === 'all'
    ? staff
    : staff.filter((u) => u.roles.some((ur) => ur.role.code === filterRole));

  const roleCounts = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r.code] = staff.filter((u) => u.roles.some((ur) => ur.role.code === r.code)).length;
    return acc;
  }, {});

  const inp = 'border border-gray-300 rounded-lg p-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          + Create User
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">Manage all user accounts for this institution</p>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* Role summary cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {roles.filter((r) => r.code !== 'super_admin').map((r) => (
          <div key={r.code} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{roleCounts[r.code] ?? 0}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{r.label}s</p>
          </div>
        ))}
      </div>

      {/* Staff list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">All Users</h2>
            <p className="text-xs text-gray-400 mt-0.5">{filteredStaff.length} accounts</p>
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
          >
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 p-6">Loading...</p>
        ) : error && staff.length === 0 ? (
          <p className="text-sm text-red-500 p-6">{error}</p>
        ) : filteredStaff.length === 0 ? (
          <p className="text-sm text-gray-400 p-6">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Email</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Role</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStaff.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800">{u.email}</td>
                  <td className="px-5 py-3">
                    {u.roles.length === 0 ? (
                      <span className="text-gray-400 italic text-xs">No role</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((ur) => (
                          <span
                            key={ur.role.id}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_COLORS[ur.role.code] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {ur.role.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Create User Account</h2>
            <p className="text-xs text-gray-400 mb-5">New user can log in with institution code + email + password</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Email *</label>
                <input
                  type="email"
                  className={inp}
                  placeholder="user@school.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Password *</label>
                <input
                  type="password"
                  className={inp}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
                <select
                  className={inp}
                  value={form.roleId}
                  onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                >
                  <option value="">No role (assign later)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); setForm({ email: '', password: '', roleId: '' }); setError(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
