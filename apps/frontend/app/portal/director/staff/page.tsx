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

const ALL_ROLE_CODES = ['super_admin', 'admin', 'principal', 'teacher', 'receptionist', 'non_teaching_staff', 'accountant'];

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-ds-info-bg text-ds-info-text',
  principal: 'bg-indigo-100 text-indigo-700',
  teacher: 'bg-ds-success-bg text-ds-success-text',
  receptionist: 'bg-pink-100 text-pink-700',
  non_teaching_staff: 'bg-orange-100 text-orange-700',
  accountant: 'bg-teal-100 text-teal-700',
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// TLD must be 2+ chars (rejects abc@def.x, abc@test, etc.)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function validateStaffIdentity(email: string, phone: string): string | null {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  if (!trimmedEmail && !trimmedPhone) return 'Email or phone is required';
  if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
    return 'Enter a valid email address (e.g. name@school.com)';
  }
  if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
    return 'Enter a valid 10-digit phone number';
  }

  return null;
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
  const [resetResult, setResetResult] = useState<{ userId: string; newPassword: string } | null>(null);

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
    const validationError = validateStaffIdentity(email, phone);
    if (validationError) return setError(validationError);
    if (!password.trim()) return setError('Password is required');
    if (!selectedRoleId) return setError('Role is required. Please select a role for this staff member.');
    setSubmitting(true); setError(null);
    try {
      const newUser = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase() || undefined,
          phone: phone.trim() || undefined,
          password,
        }),
      }) as StaffUser;
      await apiFetch(`/users/${newUser.id}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleId: selectedRoleId }),
      });
      setCreatedCredentials({ email: email.trim().toLowerCase() || undefined as any, phone: phone.trim() || undefined, password });
      setEmail(''); setPhone(''); setPassword(''); setSelectedRoleId('');
      await loadData();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Generate a new random password for this user? Their current password will stop working immediately.')) return;
    try {
      const res = await apiFetch(`/auth/director/reset-staff-password/${userId}`, { method: 'POST' }) as { newPassword: string };
      setResetResult({ userId, newPassword: res.newPassword });
    } catch (e: any) { setError(e.message); }
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

  const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand';

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 p-8 overflow-auto transition-all ${profile ? 'max-w-3xl' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-ds-text1">Staff Management</h1>
          <button onClick={() => { setShowCreate(true); setCreatedCredentials(null); setError(null); }}
            className="btn-brand px-4 py-2 rounded-lg">
            + Add Staff
          </button>
        </div>
        <p className="text-sm text-ds-text3 mb-6">All staff accounts for this institution</p>

        {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
        {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

        {/* Role summary cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {roles.map((r) => (
            <div key={r.code} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4 text-center cursor-pointer hover:border-ds-border-strong transition-colors"
              onClick={() => setFilterRole(filterRole === r.code ? 'all' : r.code)}>
              <p className="text-2xl font-bold text-ds-text1">{roleCounts[r.code] ?? 0}</p>
              <p className="text-xs font-medium text-ds-text2 mt-1">{r.label}s</p>
              {filterRole === r.code && <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1.5" />}
            </div>
          ))}
        </div>

        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between">
            <p className="text-sm font-semibold text-ds-text1">
              {filterRole === 'all' ? 'All Staff' : roles.find(r => r.code === filterRole)?.label + 's'}{' '}
              <span className="text-ds-text3 font-normal">({filteredStaff.length})</span>
            </p>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="text-xs border border-ds-border rounded-lg px-2.5 py-1.5 bg-ds-surface focus:outline-none">
              <option value="all">All roles</option>
              {roles.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-ds-text3">Loading...</p>
          ) : filteredStaff.length === 0 ? (
            <p className="p-6 text-sm text-ds-text3">No staff members yet. Add one above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ds-bg2">
                <tr>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Email / Phone</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Role</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {filteredStaff.map((u) => (
                  <tr key={u.id}
                    onClick={() => openProfile(u)}
                    className={`cursor-pointer hover:bg-ds-bg2 transition-colors ${profile?.id === u.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-5 py-3 text-ds-text1 font-medium">
                      <div>{u.email || '—'}</div>
                      {u.phone && <div className="text-xs text-ds-text3">{u.phone}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {u.roles.length === 0 ? (
                        <span className="text-ds-text3 italic text-xs">No role assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((ur) => (
                            <span key={ur.role.id}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[ur.role.code] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                              {ur.role.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text2'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDelete(u.id, u.email || u.phone || u.id)}
                        className="text-xs text-red-500 hover:text-ds-error-text font-medium">
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
        <div className="w-96 border-l border-ds-border bg-ds-surface p-6 overflow-auto shrink-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-ds-text1">Staff Profile</h2>
            <button onClick={() => setProfile(null)} className="text-ds-text3 hover:text-ds-text2 text-lg leading-none">×</button>
          </div>

          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3">
              {(profile.email || profile.phone || '?')[0].toUpperCase()}
            </div>
            <p className="font-semibold text-ds-text1 text-sm break-all">{profile.email || '—'}</p>
            {profile.phone && <p className="text-xs text-ds-text3 mt-0.5">{profile.phone}</p>}
            <span className={`mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${profile.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text2'}`}>
              {profile.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="bg-ds-bg2 rounded-lg p-3">
              <p className="text-xs font-medium text-ds-text3 mb-1">Member Since</p>
              <p className="text-ds-text1">{new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="bg-ds-bg2 rounded-lg p-3">
              <p className="text-xs font-medium text-ds-text3 mb-2">Assigned Roles</p>
              {profile.roles.length === 0 ? (
                <p className="text-ds-text3 italic text-xs">No roles assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.roles.map((ur) => (
                    <span key={ur.role.id}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[ur.role.code] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                      {ur.role.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-ds-bg2 rounded-lg p-3">
              <p className="text-xs font-medium text-ds-text3 mb-2">Class Teacher Of</p>
              {loadingAssignments ? (
                <p className="text-xs text-ds-text3">Loading...</p>
              ) : assignments?.classTeacherOf.length === 0 ? (
                <p className="text-ds-text3 italic text-xs">No class assigned</p>
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

            <div className="bg-ds-bg2 rounded-lg p-3">
              <p className="text-xs font-medium text-ds-text3 mb-2">Teaching Subjects</p>
              {loadingAssignments ? (
                <p className="text-xs text-ds-text3">Loading...</p>
              ) : Object.keys(subjectsByUnit).length === 0 ? (
                <p className="text-ds-text3 italic text-xs">No subjects assigned</p>
              ) : (
                <div className="space-y-2">
                  {Object.values(subjectsByUnit).map((entry) => (
                    <div key={entry.unitName}>
                      <p className="text-[10px] font-semibold text-ds-text2 uppercase tracking-wider">{entry.unitName}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {entry.subjects.map((sub) => (
                          <span key={sub} className="px-2 py-0.5 bg-ds-success-bg text-ds-success-text rounded text-xs">{sub}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-ds-text2 mb-2">Assign Additional Role</p>
              <div className="flex gap-2">
                <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}
                  className="flex-1 border border-ds-border-strong rounded-lg p-2 text-xs bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                  <option value="">Select role...</option>
                  {roles
                    .filter((r) => !profile.roles.some((ur) => ur.role.id === r.id))
                    .map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <button onClick={handleAddRole} disabled={addingRole || !newRoleId}
                  className="btn-brand px-3 py-2 rounded-lg text-xs">
                  {addingRole ? '...' : 'Add'}
                </button>
              </div>
            </div>

            {/* Reset password result banner */}
            {resetResult?.userId === profile.id && (
              <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-4">
                <p className="text-xs font-semibold text-ds-warning-text uppercase tracking-wider mb-2">
                  New Password — Share with user immediately
                </p>
                <div className="flex items-center justify-between bg-ds-surface rounded-lg px-3 py-2 mb-2">
                  <span className="text-xs text-ds-text2">Temporary Password</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm tracking-widest">
                    {resetResult.newPassword}
                  </span>
                </div>
                <p className="text-xs text-ds-warning-text">Tell them to change it after logging in.</p>
                <button onClick={() => setResetResult(null)}
                  className="mt-2 text-xs text-ds-text3 hover:text-ds-text2 underline">
                  Dismiss
                </button>
              </div>
            )}

            <button onClick={() => handleResetPassword(profile.id)}
              className="w-full border border-ds-warning-border text-ds-warning-text py-2 rounded-lg text-sm font-medium hover:bg-ds-warning-bg transition-colors">
              Reset Password
            </button>

            <button onClick={() => handleDelete(profile.id, profile.email || profile.phone || profile.id)}
              className="w-full border border-ds-error-border text-ds-error-text py-2 rounded-lg text-sm font-medium hover:bg-ds-error-bg mt-1">
              Delete User
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-md p-6">
            {createdCredentials ? (
              <div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-ds-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-ds-text1 mb-1 text-center">Staff Account Created</h2>
                <p className="text-xs text-ds-text3 text-center mb-5">Share these credentials. Password will not be shown again.</p>
                <div className="bg-ds-bg2 rounded-xl p-4 space-y-3 font-mono text-sm mb-5">
                  {createdCredentials.email && (
                    <div>
                      <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Email</p>
                      <p className="text-ds-text1 font-medium">{createdCredentials.email}</p>
                    </div>
                  )}
                  {createdCredentials.phone && (
                    <div>
                      <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Phone</p>
                      <p className="text-ds-text1 font-medium">{createdCredentials.phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Password</p>
                    <p className="text-ds-text1 font-bold tracking-wider">{createdCredentials.password}</p>
                  </div>
                </div>
                <button onClick={() => { setShowCreate(false); setCreatedCredentials(null); }}
                  className="btn-brand w-full py-2.5 rounded-lg">
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-ds-text1 mb-1">Add Staff Member</h2>
                <p className="text-xs text-ds-text3 mb-5">Staff logs in with institution code + email/phone + password</p>
                {error && <div className="mb-3 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-xs">{error}</div>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Email</label>
                    <input type="email" className={inp} placeholder="teacher@school.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Phone (if no email)</label>
                    <input type="tel" className={inp} placeholder="9876543210"
                      value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  {!email.trim() && phone.trim() && (
                    <div className="flex items-start gap-2 bg-ds-warning-bg border border-ds-warning-border rounded-lg px-3 py-2.5">
                      <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--warning)' }}>
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <p className="text-xs text-ds-warning-text leading-relaxed">
                        Without an email address this staff member cannot use &ldquo;Forgot password?&rdquo; — they will need you to reset their password manually.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Password *</label>
                    <div className="flex gap-2">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={inp}
                        placeholder="Enter or generate"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}
                        className="px-3 py-2 bg-ds-bg2 hover:bg-ds-bg2 text-ds-text1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0">
                        Generate
                      </button>
                    </div>
                    {password && showPassword && (
                      <p className="mt-1 text-xs text-indigo-600 font-mono font-medium">{password}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Role <span className="text-red-500">*</span></label>
                    <select className={inp + ' bg-ds-surface'} value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
                      <option value="">Select role...</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => { setShowCreate(false); setError(null); setEmail(''); setPhone(''); setPassword(''); setSelectedRoleId(''); }}
                    className="flex-1 border border-ds-border-strong text-ds-text1 py-2.5 rounded-lg text-sm font-medium hover:bg-ds-bg2">
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={submitting}
                    className="btn-brand flex-1 py-2.5 rounded-lg">
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
