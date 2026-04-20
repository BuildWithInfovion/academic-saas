'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Role = { id: string; code: string; label: string };
type StaffUser = {
  id: string; email?: string; phone?: string; isActive: boolean; createdAt: string;
  roles: { role: Role }[];
};
type Assignments = {
  classTeacherOf: { id: string; name: string; displayName?: string; level: number }[];
  subjectTeaching: {
    academicUnit: { id: string; name: string; displayName?: string };
    subject: { id: string; name: string; code?: string };
  }[];
};

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-ds-info-bg text-ds-info-text',
  principal: 'bg-indigo-100 text-indigo-700',
  teacher: 'bg-ds-success-bg text-ds-success-text',
  receptionist: 'bg-pink-100 text-pink-700',
  non_teaching_staff: 'bg-orange-100 text-orange-700',
};

const STAFF_ROLE_CODES = ['super_admin', 'admin', 'principal', 'teacher', 'receptionist', 'non_teaching_staff'];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<StaffUser | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Role management
  const [newRoleId, setNewRoleId] = useState('');
  const [addingRole, setAddingRole] = useState(false);

  // Password reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState<{ username: string; password: string } | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const load = async () => {
    try {
      const [usersRes, rolesRes, assignRes] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/roles'),
        apiFetch(`/users/${id}/assignments`),
      ]);
      const found = (usersRes as StaffUser[]).find((u) => u.id === id);
      if (!found) throw new Error('Staff member not found');
      setUser(found);
      setAllRoles((rolesRes as Role[]).filter((r) => STAFF_ROLE_CODES.includes(r.code)));
      setAssignments(assignRes as Assignments);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) void load(); }, [id]);

  const handleAddRole = async () => {
    if (!user || !newRoleId) return;
    setAddingRole(true);
    try {
      await apiFetch(`/users/${user.id}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleId: newRoleId }),
      });
      showSuccess('Role assigned');
      setNewRoleId('');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setAddingRole(false); }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(`Delete "${user.email || user.phone}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' });
      router.push('/dashboard/staff');
    } catch (e: any) { setError(e.message); }
  };

  const openReset = () => {
    setNewPwd(generatePassword());
    setResetDone(null);
    setShowResetModal(true);
  };

  const handleReset = async () => {
    if (!user || !newPwd) return;
    setResetting(true);
    setError(null);
    try {
      await apiFetch(`/users/${user.id}/set-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: newPwd }),
      });
      setResetDone({ username: user.email || user.phone || '—', password: newPwd });
    } catch (e: any) { setError(e.message); }
    finally { setResetting(false); }
  };

  if (loading) return <div className="p-10 text-ds-text3">Loading...</div>;
  if (error && !user) return <div className="p-10 text-red-500">{error}</div>;
  if (!user) return null;

  const username = user.email || user.phone || '—';
  const initials = (user.email || user.phone || '?')[0].toUpperCase();

  const subjectsByUnit = assignments?.subjectTeaching.reduce<Record<string, { unitName: string; subjects: string[] }>>((acc, s) => {
    const key = s.academicUnit.id;
    if (!acc[key]) acc[key] = { unitName: s.academicUnit.displayName || s.academicUnit.name, subjects: [] };
    acc[key].subjects.push(s.subject.name);
    return acc;
  }, {}) ?? {};

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push('/dashboard/staff')}
        className="text-sm text-ds-text2 hover:text-ds-text1 mb-6 flex items-center gap-1">
        ← Back to Staff
      </button>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Header */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)', color: '#fcfbf7' }}>
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-ds-text1">{username}</h1>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {user.roles.map((ur) => (
                  <span key={ur.role.id}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[ur.role.code] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                    {ur.role.label}
                  </span>
                ))}
                {user.roles.length === 0 && <span className="text-xs text-ds-text3 italic">No role assigned</span>}
              </div>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text2'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Login Credentials */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ds-text1 mb-4">Login Credentials</h3>
          <div className="bg-ds-bg2 rounded-lg p-4 space-y-3 font-mono text-sm mb-4">
            <div>
              <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Username (Email / Phone)</p>
              <p className="text-ds-text1 font-medium">{username}</p>
            </div>
            {user.phone && user.email && (
              <div>
                <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Phone</p>
                <p className="text-ds-text1 font-medium">{user.phone}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Password</p>
              <p className="text-ds-text3 italic font-sans text-xs">Hidden — use Reset to set a new one</p>
            </div>
          </div>
          <button onClick={openReset}
            className="w-full btn-brand py-2 rounded-lg text-sm font-medium">
            Reset Password
          </button>
        </div>

        {/* Account Info */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ds-text1 mb-4">Account Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ds-text2">Member Since</dt>
              <dd className="text-ds-text1 font-medium">{new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ds-text2">Status</dt>
              <dd className="text-ds-text1 font-medium">{user.isActive ? 'Active' : 'Inactive'}</dd>
            </div>
          </dl>

          {/* Add Role */}
          <div className="mt-5 pt-4 border-t border-ds-border">
            <p className="text-xs font-medium text-ds-text2 mb-2">Assign Additional Role</p>
            <div className="flex gap-2">
              <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}
                className="flex-1 border border-ds-border-strong rounded-lg p-2 text-xs bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                <option value="">Select role...</option>
                {allRoles
                  .filter((r) => !user.roles.some((ur) => ur.role.id === r.id))
                  .map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button onClick={handleAddRole} disabled={addingRole || !newRoleId}
                className="btn-brand px-3 py-2 rounded-lg text-xs">
                {addingRole ? '...' : 'Add'}
              </button>
            </div>
          </div>
        </div>

        {/* Class Teacher Assignments */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ds-text1 mb-4">Class Teacher Of</h3>
          {!assignments ? (
            <p className="text-xs text-ds-text3">Loading...</p>
          ) : assignments.classTeacherOf.length === 0 ? (
            <p className="text-xs text-ds-text3 italic">No class assigned as class teacher</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignments.classTeacherOf.map((u) => (
                <span key={u.id} className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium">
                  {u.displayName || u.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Subject Assignments */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ds-text1 mb-4">Teaching Subjects</h3>
          {!assignments ? (
            <p className="text-xs text-ds-text3">Loading...</p>
          ) : Object.keys(subjectsByUnit).length === 0 ? (
            <p className="text-xs text-ds-text3 italic">No subjects assigned</p>
          ) : (
            <div className="space-y-3">
              {Object.values(subjectsByUnit).map((entry) => (
                <div key={entry.unitName}>
                  <p className="text-[10px] font-semibold text-ds-text2 uppercase tracking-wider mb-1">{entry.unitName}</p>
                  <div className="flex flex-wrap gap-1">
                    {entry.subjects.map((sub) => (
                      <span key={sub} className="px-2 py-0.5 bg-ds-success-bg text-ds-success-text rounded text-xs">{sub}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-4 bg-ds-surface rounded-xl border border-red-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-ds-error-text mb-3">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ds-text1 font-medium">Delete this staff account</p>
            <p className="text-xs text-ds-text3">This action cannot be undone.</p>
          </div>
          <button onClick={handleDelete}
            className="border border-ds-error-border text-ds-error-text px-4 py-2 rounded-lg text-sm font-medium hover:bg-ds-error-bg">
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Reset Password Modal ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            {resetDone ? (
              <div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-ds-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-ds-text1 text-center mb-1">Password Reset</h2>
                <p className="text-xs text-ds-text3 text-center mb-5">Share these credentials. Password will not be shown again.</p>
                <div className="bg-ds-bg2 rounded-xl p-4 space-y-3 font-mono text-sm mb-5">
                  <div>
                    <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Username</p>
                    <p className="text-ds-text1 font-medium">{resetDone.username}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">New Password</p>
                    <p className="text-ds-text1 font-bold tracking-wider text-base">{resetDone.password}</p>
                  </div>
                </div>
                <button onClick={() => { setShowResetModal(false); setResetDone(null); }}
                  className="btn-brand w-full py-2.5 rounded-lg">
                  Done
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-ds-text1 mb-1">Reset Password</h2>
                <p className="text-xs text-ds-text3 mb-4">For: <span className="font-medium text-ds-text1">{username}</span></p>
                {error && <p className="text-ds-error-text text-xs mb-3">{error}</p>}
                <div className="mb-4">
                  <label className="text-xs font-medium text-ds-text2 block mb-1">New Password</label>
                  <div className="flex gap-2">
                    <input type="text"
                      className="flex-1 border border-ds-border-strong rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ds-brand"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                    />
                    <button type="button"
                      onClick={() => setNewPwd(generatePassword())}
                      className="px-3 py-2 bg-ds-bg2 hover:bg-ds-bg2 text-ds-text1 rounded-lg text-xs font-medium whitespace-nowrap">
                      Regenerate
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowResetModal(false); setError(null); }}
                    className="flex-1 border border-ds-border-strong text-ds-text1 py-2.5 rounded-lg text-sm hover:bg-ds-bg2">
                    Cancel
                  </button>
                  <button onClick={handleReset} disabled={resetting || !newPwd}
                    className="btn-brand flex-1 py-2.5 rounded-lg">
                    {resetting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
