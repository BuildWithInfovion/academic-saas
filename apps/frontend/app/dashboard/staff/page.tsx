'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Role = { id: string; code: string; label: string };
type StaffUser = {
  id: string; email: string; phone?: string; isActive: boolean; createdAt: string;
  roles: { role: Role }[];
};

// Codes shown in the staff list (all non-student, non-parent roles)
const STAFF_ROLE_CODES = ['super_admin', 'admin', 'principal', 'teacher', 'receptionist', 'non_teaching_staff', 'accountant'];
// Codes available in the Add Staff dropdown — operators cannot create Director accounts
const ASSIGNABLE_ROLE_CODES = ['admin', 'principal', 'teacher', 'receptionist', 'non_teaching_staff', 'accountant'];

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

function validateStaffIdentity(email: string, phone: string): string | null {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  if (!trimmedEmail && !trimmedPhone) return 'Email or phone is required';
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Enter a valid email address';
  }
  if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
    return 'Enter a valid 10-digit phone number';
  }

  return null;
}

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; phone?: string; password: string } | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([apiFetch('/users'), apiFetch('/roles')]);
      const staffUsers = (usersRes as StaffUser[]).filter(
        (u) => !u.roles.every((ur) => ['parent', 'student'].includes(ur.role.code)),
      );
      setStaff(staffUsers);
      setRoles((rolesRes as Role[]).filter((r) => ASSIGNABLE_ROLE_CODES.includes(r.code)));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const generateCredentials = () => { setPassword(generatePassword()); setShowPassword(true); };

  const handleCreate = async () => {
    const validationError = validateStaffIdentity(email, phone);
    if (validationError) return setError(validationError);
    if (!password.trim()) return setError('Password is required');
    if (!selectedRoleId) return setError('Role is required. Please select a role for this staff member.');
    setSubmitting(true);
    setError(null);
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

  const handleDelete = async (userId: string, userEmail: string) => {
    if (!confirm(`Delete user "${userEmail}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      showSuccess('User deleted');
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

  const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand';

  return (
    <div className="p-8 overflow-auto h-full">
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

      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-ds-border">
          <p className="text-sm font-semibold text-ds-text1">All Staff <span className="text-ds-text3 font-normal">({staff.length})</span></p>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-ds-text3">Loading...</p>
        ) : staff.length === 0 ? (
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
              {staff.map((u) => (
                <tr key={u.id}
                  onClick={() => router.push(`/dashboard/staff/${u.id}`)}
                  className="cursor-pointer hover:bg-ds-bg2 transition-colors">
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
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-ds-warning-text mb-1">Next Steps</p>
                  <ul className="text-xs text-ds-warning-text space-y-1 list-disc list-inside">
                    <li>Go to <strong>Classes</strong> to assign this staff member to a class as teacher</li>
                    <li>Go to <strong>Subjects</strong> to assign subjects they will teach</li>
                  </ul>
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
                      <button type="button" onClick={generateCredentials}
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
