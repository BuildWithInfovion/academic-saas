'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Role = { id: string; code: string; label: string };
type StaffUser = {
  id: string; email: string; phone?: string; isActive: boolean; createdAt: string;
  roles: { role: Role }[];
};
type Assignments = {
  classTeacherOf: { id: string; name: string; displayName?: string; level: number }[];
  subjectTeaching: {
    academicUnit: { id: string; name: string; displayName?: string };
    subject: { id: string; name: string; code?: string };
  }[];
};

const ALL_ROLE_CODES = ['super_admin', 'admin', 'principal', 'teacher', 'receptionist'];

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  principal: 'bg-indigo-100 text-indigo-700',
  teacher: 'bg-green-100 text-green-700',
  receptionist: 'bg-pink-100 text-pink-700',
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function DirectorStaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('all');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; phone?: string; password: string } | null>(null);

  // Profile panel
  const [profile, setProfile] = useState<StaffUser | null>(null);
  const [assignments, setAssignments] = useState<Assignments | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([apiFetch('/users'), apiFetch('/roles')]);
      const staffUsers = (usersRes as StaffUser[]).filter(
        (u) => !u.roles.every((ur) => ['parent', 'student'].includes(ur.role.code)),
      );
      setStaff(staffUsers);
      setRoles((rolesRes as Role[]).filter((r) => ALL_ROLE_CODES.includes(r.code)));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openProfile = async (user: StaffUser) => {
    setProfile(user);
    setAssignments(null);
    setLoadingAssignments(true);
    try {
      const res = await apiFetch(`/users/${user.id}/assignments`);
      setAssignments(res as Assignments);
    } catch { /* ignore */ }
    finally { setLoadingAssignments(false); }
  };

  const handleCreate = async () => {
    if (!email.trim() && !phone.trim()) return setError('Email or phone is required');
    if (!password.trim()) return setError('Password is required');
    setSubmitting(true); setError(null);
    try {
      const newUser = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
        }),
      }) as StaffUser;
      if (selectedRoleId) {
        await apiFetch(`/users/${newUser.id}/roles`, {
          method: 'POST',
          body: JSON.stringify({ roleId: selectedRoleId }),
        });
      }
      setCreatedCredentials({ email: email.trim() || undefined as any, phone: phone.trim() || undefined, password });
      setEmail(''); setPhone(''); setPassword(''); setSelectedRoleId('');
      await loadData();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (!confirm(`Delete user "${userEmail}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      showSuccess('User deleted');
      if (profile?.id === userId) setProfile(null);
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleAddRole = async () => {
    if (!profile || !newRoleId) return;
    setAddingRole(true);
    try {
      await apiFetch(`/users/${profile.id}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleId: newRoleId }),
      });
      showSuccess('Role assigned');
      setNewRoleId('');
      await loadData();
      const updated = (await apiFetch('/users') as StaffUser[]).find((u) => u.id === profile.id);
      if (updated) setProfile(updated);
    } catch (e: any) { setError(e.message); }
    finally { setAddingRole(false); }
  };

  const filteredStaff = filterRole === 'all'
    ? staff
    : staff.filter((u) => u.roles.some((ur) => ur.role.code === filterRole));

  const roleCounts = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r.code] = staff.filter((u) => u.roles.some((ur) => ur.role.code === r.code)).length;
    return acc;
  }, {});

  const subjectsByUnit = assignments?.subjectTeaching.reduce<Record<string, { unitName: string; subjects: string[] }>>((acc, s) => {
    const key = s.academicUnit.id;
    if (!acc[key]) acc[key] = { unitName: s.academicUnit.displayName || s.academicUnit.name, subjects: [] };
    acc[key].subjects.push(s.subject.name);
    return acc;
  }, {}) ?? {};

  const inp = 'w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 p-8 overflow-auto transition-all ${profile ? 'max-w-3xl' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
          <button onClick={() => { setShowCreate(true); setCreatedCredentials(null); setError(null); }}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
            + Add Staff
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-6">All staff accounts for this institution</p>

        {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
        {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

        {/* Role summary cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {roles.map((r) => (
            <div key={r.code} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => setFilterRole(filterRole === r.code ? 'all' : r.code)}>
              <p className="text-2xl font-bold text-gray-800">{roleCounts[r.code] ?? 0}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">{r.label}s</p>
              {filterRole === r.code && <div className="w-1.5 h-1.5 bg-black rounded-full mx-auto mt-1.5" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {filterRole === 'all' ? 'All Staff' : roles.find(r => r.code === filterRole)?.label + 's'}{' '}
              <span className="text-gray-400 font-normal">({filteredStaff.length})</span>
            </p>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
              <option value="all">All roles</option>
              {roles.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : filteredStaff.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No staff members yet. Add one above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Email / Phone</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Role</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStaff.map((u) => (
                  <tr key={u.id}
                    onClick={() => openProfile(u)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${profile?.id === u.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-5 py-3 text-gray-800 font-medium">
                      <div>{u.email || '—'}</div>
                      {u.phone && <div className="text-xs text-gray-400">{u.phone}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {u.roles.length === 0 ? (
                        <span className="text-gray-400 italic text-xs">No role assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((ur) => (
                            <span key={ur.role.id}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[ur.role.code] ?? 'bg-gray-100 text-gray-600'}`}>
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
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDelete(u.id, u.email || u.phone || u.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Profile panel */}
      {profile && (
        <div className="w-96 border-l border-gray-200 bg-white p-6 overflow-auto shrink-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-800">Staff Profile</h2>
            <button onClick={() => setProfile(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center text-white text-xl font-bold mb-3">
              {(profile.email || profile.phone || '?')[0].toUpperCase()}
            </div>
            <p className="font-semibold text-gray-800 text-sm break-all">{profile.email || '—'}</p>
            {profile.phone && <p className="text-xs text-gray-400 mt-0.5">{profile.phone}</p>}
            <span className={`mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${profile.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {profile.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-400 mb-1">Member Since</p>
              <p className="text-gray-700">{new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-400 mb-2">Assigned Roles</p>
              {profile.roles.length === 0 ? (
                <p className="text-gray-400 italic text-xs">No roles assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.roles.map((ur) => (
                    <span key={ur.role.id}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[ur.role.code] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ur.role.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-400 mb-2">Class Teacher Of</p>
              {loadingAssignments ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : assignments?.classTeacherOf.length === 0 ? (
                <p className="text-gray-400 italic text-xs">No class assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {assignments?.classTeacherOf.map((u) => (
                    <span key={u.id} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                      {u.displayName || u.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-400 mb-2">Teaching Subjects</p>
              {loadingAssignments ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : Object.keys(subjectsByUnit).length === 0 ? (
                <p className="text-gray-400 italic text-xs">No subjects assigned</p>
              ) : (
                <div className="space-y-2">
                  {Object.values(subjectsByUnit).map((entry) => (
                    <div key={entry.unitName}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{entry.unitName}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {entry.subjects.map((sub) => (
                          <span key={sub} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{sub}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Assign Additional Role</p>
              <div className="flex gap-2">
                <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg p-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-black">
                  <option value="">Select role...</option>
                  {roles
                    .filter((r) => !profile.roles.some((ur) => ur.role.id === r.id))
                    .map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <button onClick={handleAddRole} disabled={addingRole || !newRoleId}
                  className="bg-black text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                  {addingRole ? '...' : 'Add'}
                </button>
              </div>
            </div>

            <button onClick={() => handleDelete(profile.id, profile.email || profile.phone || profile.id)}
              className="w-full border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50 mt-2">
              Delete User
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            {createdCredentials ? (
              <div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-1 text-center">Staff Account Created</h2>
                <p className="text-xs text-gray-400 text-center mb-5">Share these credentials. Password will not be shown again.</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 font-mono text-sm mb-5">
                  {createdCredentials.email && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-sans mb-0.5">Email</p>
                      <p className="text-gray-800 font-medium">{createdCredentials.email}</p>
                    </div>
                  )}
                  {createdCredentials.phone && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-sans mb-0.5">Phone</p>
                      <p className="text-gray-800 font-medium">{createdCredentials.phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-sans mb-0.5">Password</p>
                    <p className="text-gray-800 font-bold tracking-wider">{createdCredentials.password}</p>
                  </div>
                </div>
                <button onClick={() => { setShowCreate(false); setCreatedCredentials(null); }}
                  className="w-full bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Add Staff Member</h2>
                <p className="text-xs text-gray-400 mb-5">Staff logs in with institution code + email/phone + password</p>
                {error && <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-xs">{error}</div>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                    <input type="email" className={inp} placeholder="teacher@school.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Phone (if no email)</label>
                    <input type="tel" className={inp} placeholder="9876543210"
                      value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Password *</label>
                    <div className="flex gap-2">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={inp}
                        placeholder="Enter or generate"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium whitespace-nowrap shrink-0">
                        Generate
                      </button>
                    </div>
                    {password && showPassword && (
                      <p className="mt-1 text-xs text-indigo-600 font-mono font-medium">{password}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
                    <select className={inp + ' bg-white'} value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
                      <option value="">No role (assign later)</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => { setShowCreate(false); setError(null); setEmail(''); setPhone(''); setPassword(''); setSelectedRoleId(''); }}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={submitting}
                    className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
