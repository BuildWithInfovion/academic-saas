'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type Role = { id: string; code: string; label: string };
type StaffUser = {
  id: string; name?: string; email?: string; phone?: string;
  isActive: boolean; createdAt: string; lastLoginAt?: string;
  roles: { role: Role }[];
};
type Assignments = {
  classTeacherOf: { id: string; name: string; displayName?: string; level: number }[];
  subjectTeaching: {
    academicUnit: { id: string; name: string; displayName?: string };
    subject: { id: string; name: string; code?: string };
  }[];
};
type AttendanceSummary = {
  total: number; present: number; absent: number; late: number; halfDay: number;
};
type AllowanceItem = { name: string; amount: number };
type SalaryProfile = {
  id: string; isActive: boolean; effectiveFrom: string; notes?: string;
  basicSalary: number; houseRentAllowance: number; medicalAllowance: number;
  transportAllowance: number; otherAllowances: AllowanceItem[];
  providentFund: number; professionalTax: number; otherDeductions: AllowanceItem[];
  structure?: { id: string; name: string };
};
type SalaryRecord = {
  id: string; month: number; year: number; status: string;
  grossSalary: number; totalDeductions: number; netSalary: number;
  paidOn?: string; paymentMode?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-ds-info-bg text-ds-info-text',
  principal: 'bg-indigo-100 text-indigo-700',
  teacher: 'bg-ds-success-bg text-ds-success-text',
  receptionist: 'bg-pink-100 text-pink-700',
  non_teaching_staff: 'bg-orange-100 text-orange-700',
  accountant: 'bg-cyan-100 text-cyan-700',
  director: 'bg-violet-100 text-violet-700',
};
const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-ds-success-bg text-ds-success-text',
  pending: 'bg-yellow-100 text-yellow-700',
  on_hold: 'bg-orange-100 text-orange-700',
};
const STATUS_LABEL: Record<string, string> = { paid: 'Paid', pending: 'Pending', on_hold: 'On Hold' };
const STAFF_ROLE_CODES = ['super_admin','admin','principal','teacher','receptionist','non_teaching_staff','accountant','director'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-ds-border last:border-0">
      <span className="text-xs text-ds-text3 shrink-0 w-36">{label}</span>
      <span className="text-sm text-ds-text1 font-medium text-right">{value ?? <span className="text-ds-text3 italic font-normal">—</span>}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<StaffUser | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignments | null>(null);
  const [salaryProfile, setSalaryProfile] = useState<SalaryProfile | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'salary'>('overview');

  // Role management
  const [newRoleId, setNewRoleId] = useState('');
  const [addingRole, setAddingRole] = useState(false);

  // Password reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState<{ username: string; password: string } | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, assignRes] = await Promise.all([
        apiFetch('/users') as Promise<StaffUser[]>,
        apiFetch('/roles') as Promise<Role[]>,
        apiFetch(`/users/${id}/assignments`) as Promise<Assignments>,
      ]);
      const found = usersRes.find((u) => u.id === id);
      if (!found) throw new Error('Staff member not found');
      setUser(found);
      setAllRoles(rolesRes.filter((r) => STAFF_ROLE_CODES.includes(r.code)));
      setAssignments(assignRes);

      // Load salary data separately (may not have permission or no profile)
      try {
        const history = await apiFetch(`/salary/staff/${id}/history`) as { profile: SalaryProfile | null; records: SalaryRecord[] };
        setSalaryProfile(history.profile);
        setSalaryHistory(history.records);
      } catch { /* no salary permission or no profile */ }

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
      await apiFetch(`/users/${user.id}/roles`, { method: 'POST', body: JSON.stringify({ roleId: newRoleId }) });
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
    setNewPwd(generatePassword()); setResetDone(null); setShowResetModal(true);
  };

  const handleReset = async () => {
    if (!user || !newPwd) return;
    setResetting(true); setError(null);
    try {
      await apiFetch(`/users/${user.id}/set-password`, {
        method: 'PATCH', body: JSON.stringify({ newPassword: newPwd }),
      });
      setResetDone({ username: user.email || user.phone || '—', password: newPwd });
    } catch (e: any) { setError(e.message); }
    finally { setResetting(false); }
  };

  if (loading) return <div className="p-10 text-ds-text3 text-sm">Loading employee profile...</div>;
  if (error && !user) return <div className="p-10 text-red-500">{error}</div>;
  if (!user) return null;

  const username = user.name || user.email || user.phone || '—';
  const initials = username.slice(0, 2).toUpperCase();
  const primaryRole = user.roles[0]?.role ?? null;

  const subjectsByUnit = assignments?.subjectTeaching.reduce<Record<string, { unitName: string; subjects: string[] }>>((acc, s) => {
    const key = s.academicUnit.id;
    if (!acc[key]) acc[key] = { unitName: s.academicUnit.displayName || s.academicUnit.name, subjects: [] };
    acc[key].subjects.push(s.subject.name);
    return acc;
  }, {}) ?? {};

  // Salary computed
  const salaryGross = salaryProfile
    ? salaryProfile.basicSalary + salaryProfile.houseRentAllowance + salaryProfile.medicalAllowance +
      salaryProfile.transportAllowance + (salaryProfile.otherAllowances ?? []).reduce((s, a) => s + a.amount, 0)
    : 0;
  const salaryDeductions = salaryProfile
    ? salaryProfile.providentFund + salaryProfile.professionalTax +
      (salaryProfile.otherDeductions ?? []).reduce((s, d) => s + d.amount, 0)
    : 0;
  const salaryNet = salaryGross - salaryDeductions;

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <button onClick={() => router.push('/dashboard/staff')}
        className="text-sm text-ds-text2 hover:text-ds-text1 mb-5 flex items-center gap-1">
        ← Back to Staff
      </button>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* ── Profile Header ─────────────────────────────────────────────────── */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)', color: '#fcfbf7' }}>
              {initials}
            </div>
            <div>
              <h1 className="text-lg font-bold text-ds-text1">{username}</h1>
              {user.name && (user.email || user.phone) && (
                <p className="text-xs text-ds-text3">{user.email || user.phone}</p>
              )}
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

          <div className="flex flex-col items-end gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text2'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
            {salaryProfile && (
              <span className="text-xs text-ds-text3">Net: <span className="font-semibold text-green-600">{fmt(salaryNet)}/mo</span></span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-ds-bg2 rounded-lg p-3">
            <p className="text-[10px] text-ds-text3 uppercase tracking-wider mb-0.5">Member Since</p>
            <p className="text-sm font-semibold text-ds-text1">
              {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="bg-ds-bg2 rounded-lg p-3">
            <p className="text-[10px] text-ds-text3 uppercase tracking-wider mb-0.5">Last Login</p>
            <p className="text-sm font-semibold text-ds-text1">
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Never'}
            </p>
          </div>
          <div className="bg-ds-bg2 rounded-lg p-3">
            <p className="text-[10px] text-ds-text3 uppercase tracking-wider mb-0.5">Classes Taught</p>
            <p className="text-sm font-semibold text-ds-text1">
              {assignments ? Object.keys(subjectsByUnit).length : '—'}
            </p>
          </div>
          <div className="bg-ds-bg2 rounded-lg p-3">
            <p className="text-[10px] text-ds-text3 uppercase tracking-wider mb-0.5">Salary Status</p>
            <p className="text-sm font-semibold text-ds-text1">
              {salaryProfile ? (salaryProfile.isActive ? 'Configured' : 'Inactive') : 'Not Set'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 border-b border-ds-border">
        {(['overview', 'assignments', 'salary'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              activeTab === t ? 'border-ds-brand text-ds-brand' : 'border-transparent text-ds-text2 hover:text-ds-text1'
            }`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Account Info */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-ds-text1 mb-3">Account Information</h3>
            <InfoRow label="Name" value={user.name} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Phone" value={user.phone} />
            <InfoRow label="Status" value={
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text2'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            } />
            <InfoRow label="Created" value={new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <InfoRow label="Last Login" value={user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : null} />
          </div>

          {/* Login Credentials */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-ds-text1 mb-3">Login Credentials</h3>
            <div className="bg-ds-bg2 rounded-lg p-4 space-y-3 font-mono text-sm mb-4">
              <div>
                <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Username (Email / Phone)</p>
                <p className="text-ds-text1 font-medium">{user.email || user.phone || '—'}</p>
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
            <button onClick={openReset} className="w-full btn-brand py-2 rounded-lg text-sm font-medium">
              Reset Password
            </button>
          </div>

          {/* Role Management */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-ds-text1 mb-3">Roles</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {user.roles.map((ur) => (
                <span key={ur.role.id}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${ROLE_BADGE[ur.role.code] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                  {ur.role.label}
                </span>
              ))}
              {user.roles.length === 0 && <p className="text-xs text-ds-text3 italic">No roles assigned</p>}
            </div>
            <div className="flex gap-2">
              <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}
                className="flex-1 border border-ds-border-strong rounded-lg p-2 text-xs bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                <option value="">Assign additional role...</option>
                {allRoles.filter((r) => !user.roles.some((ur) => ur.role.id === r.id))
                  .map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button onClick={handleAddRole} disabled={addingRole || !newRoleId}
                className="btn-brand px-3 py-2 rounded-lg text-xs">
                {addingRole ? '...' : 'Assign'}
              </button>
            </div>
          </div>

          {/* Salary Snapshot */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ds-text1">Salary Overview</h3>
              <button onClick={() => setActiveTab('salary')} className="text-xs text-ds-brand hover:underline">View Details</button>
            </div>
            {!salaryProfile ? (
              <div className="text-center py-4">
                <p className="text-xs text-ds-text3 mb-3">No salary profile configured for this staff member.</p>
                <a href="/dashboard/salary" className="text-xs text-ds-brand hover:underline">Configure in Salary Management →</a>
              </div>
            ) : (
              <div className="space-y-1.5">
                <InfoRow label="Basic Salary" value={fmt(salaryProfile.basicSalary)} />
                <InfoRow label="Gross Salary" value={fmt(salaryGross)} />
                <InfoRow label="Total Deductions" value={salaryDeductions > 0 ? <span className="text-red-500">{fmt(salaryDeductions)}</span> : '—'} />
                <div className="flex justify-between pt-2 border-t border-ds-border">
                  <span className="text-xs text-ds-text3">Net Monthly</span>
                  <span className="text-sm font-bold text-green-600">{fmt(salaryNet)}</span>
                </div>
                {salaryProfile.structure && (
                  <p className="text-[10px] text-ds-text3 mt-1">Based on: {salaryProfile.structure.name}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assignments Tab ────────────────────────────────────────────────── */}
      {activeTab === 'assignments' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Class Teacher */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-ds-text1 mb-3">Class Teacher Of</h3>
            {!assignments ? (
              <p className="text-xs text-ds-text3">Loading...</p>
            ) : assignments.classTeacherOf.length === 0 ? (
              <p className="text-xs text-ds-text3 italic">Not assigned as class teacher</p>
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

          {/* Subject Teaching */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-ds-text1 mb-3">Teaching Subjects</h3>
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
      )}

      {/* ── Salary Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'salary' && (
        <div className="space-y-4">
          {!salaryProfile ? (
            <div className="bg-ds-surface border border-ds-border rounded-xl p-10 text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" fill="none" stroke="#ca8a04" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-ds-text1 mb-1">No Salary Profile</p>
              <p className="text-xs text-ds-text3 mb-4">This staff member does not have a salary profile configured.</p>
              <a href="/dashboard/salary" className="btn-brand px-4 py-2 rounded-lg text-sm inline-block">
                Set Up Salary Profile
              </a>
            </div>
          ) : (
            <>
              {/* Current Profile */}
              <div className="bg-ds-surface border border-ds-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-ds-text1">Current Salary Profile</h3>
                  <div className="flex items-center gap-3">
                    {salaryProfile.structure && (
                      <span className="text-xs text-ds-text3">Template: <span className="font-medium text-ds-text1">{salaryProfile.structure.name}</span></span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${salaryProfile.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text3'}`}>
                      {salaryProfile.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Earnings */}
                  <div>
                    <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Earnings</p>
                    <div className="space-y-1">
                      {salaryProfile.basicSalary > 0 && (
                        <div className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">Basic Salary</span>
                          <span className="font-medium text-ds-text1">{fmt(salaryProfile.basicSalary)}</span>
                        </div>
                      )}
                      {salaryProfile.houseRentAllowance > 0 && (
                        <div className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">House Rent Allowance</span>
                          <span className="font-medium text-ds-text1">{fmt(salaryProfile.houseRentAllowance)}</span>
                        </div>
                      )}
                      {salaryProfile.medicalAllowance > 0 && (
                        <div className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">Medical Allowance</span>
                          <span className="font-medium text-ds-text1">{fmt(salaryProfile.medicalAllowance)}</span>
                        </div>
                      )}
                      {salaryProfile.transportAllowance > 0 && (
                        <div className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">Transport Allowance</span>
                          <span className="font-medium text-ds-text1">{fmt(salaryProfile.transportAllowance)}</span>
                        </div>
                      )}
                      {(salaryProfile.otherAllowances ?? []).map((a) => (
                        <div key={a.name} className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">{a.name}</span>
                          <span className="font-medium text-ds-text1">{fmt(a.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm py-2 font-bold">
                        <span className="text-ds-text1">Gross Salary</span>
                        <span className="text-ds-text1">{fmt(salaryGross)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions + Net */}
                  <div>
                    <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Deductions</p>
                    <div className="space-y-1">
                      {salaryProfile.providentFund > 0 && (
                        <div className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">Provident Fund</span>
                          <span className="font-medium text-red-500">{fmt(salaryProfile.providentFund)}</span>
                        </div>
                      )}
                      {salaryProfile.professionalTax > 0 && (
                        <div className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">Professional Tax</span>
                          <span className="font-medium text-red-500">{fmt(salaryProfile.professionalTax)}</span>
                        </div>
                      )}
                      {(salaryProfile.otherDeductions ?? []).map((d) => (
                        <div key={d.name} className="flex justify-between text-sm py-1 border-b border-ds-border">
                          <span className="text-ds-text2">{d.name}</span>
                          <span className="font-medium text-red-500">{fmt(d.amount)}</span>
                        </div>
                      ))}
                      {salaryDeductions === 0 && (
                        <p className="text-xs text-ds-text3 italic py-2">No deductions</p>
                      )}
                      <div className="flex justify-between text-sm py-2 font-bold border-t border-ds-border mt-2">
                        <span className="text-ds-text1">Total Deductions</span>
                        <span className="text-red-500">{salaryDeductions > 0 ? fmt(salaryDeductions) : '—'}</span>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-3">
                      <p className="text-xs text-green-600 font-medium mb-0.5">Net Monthly Salary</p>
                      <p className="text-2xl font-bold text-green-700">{fmt(salaryNet)}</p>
                    </div>
                  </div>
                </div>

                {salaryProfile.notes && (
                  <div className="mt-4 bg-ds-bg2 rounded-lg p-3">
                    <p className="text-xs text-ds-text3">Notes: <span className="text-ds-text1">{salaryProfile.notes}</span></p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-ds-border flex justify-between text-xs text-ds-text3">
                  <span>Effective from: {new Date(salaryProfile.effectiveFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <a href="/dashboard/salary" className="text-ds-brand hover:underline">Edit in Salary Management →</a>
                </div>
              </div>

              {/* Salary History */}
              {salaryHistory.length > 0 && (
                <div className="bg-ds-surface border border-ds-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-ds-border">
                    <h3 className="text-sm font-semibold text-ds-text1">Salary History</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ds-bg2 border-b border-ds-border">
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-ds-text3 uppercase tracking-wider">Month</th>
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden md:table-cell">Gross</th>
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden md:table-cell">Deductions</th>
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-ds-text3 uppercase tracking-wider">Net</th>
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-ds-text3 uppercase tracking-wider">Status</th>
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden lg:table-cell">Paid On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ds-border">
                      {salaryHistory.map((r) => (
                        <tr key={r.id} className="hover:bg-ds-bg2/50">
                          <td className="px-5 py-3 font-medium text-ds-text1">
                            {MONTHS[r.month - 1]} {r.year}
                          </td>
                          <td className="px-5 py-3 text-right text-ds-text2 hidden md:table-cell">{fmt(r.grossSalary)}</td>
                          <td className="px-5 py-3 text-right text-red-500 hidden md:table-cell">
                            {r.totalDeductions > 0 ? fmt(r.totalDeductions) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-green-600">{fmt(r.netSalary)}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[r.status]}`}>
                              {STATUS_LABEL[r.status]}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-ds-text3 hidden lg:table-cell">
                            {r.paidOn
                              ? `${new Date(r.paidOn).toLocaleDateString('en-IN')} · ${r.paymentMode?.replace('_', ' ')}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-ds-bg2 border-t border-ds-border">
                        <td className="px-5 py-2.5 text-xs font-semibold text-ds-text2" colSpan={3}>
                          {salaryHistory.length} records · {salaryHistory.filter((r) => r.status === 'paid').length} paid
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs font-bold text-green-600">
                          {fmt(salaryHistory.filter((r) => r.status === 'paid').reduce((s, r) => s + r.netSalary, 0))} total paid
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {salaryHistory.length === 0 && (
                <div className="bg-ds-surface border border-ds-border rounded-xl p-8 text-center">
                  <p className="text-xs text-ds-text3">No salary records yet. Generate monthly salaries from the Salary Management page.</p>
                  <a href="/dashboard/salary" className="mt-2 text-xs text-ds-brand hover:underline inline-block">Go to Salary Management</a>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Danger Zone ────────────────────────────────────────────────────── */}
      <div className="mt-4 bg-ds-surface rounded-xl border border-red-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-ds-error-text mb-3">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ds-text1 font-medium">Delete this staff account</p>
            <p className="text-xs text-ds-text3">Permanently deletes the account. This cannot be undone.</p>
          </div>
          <button onClick={handleDelete}
            className="border border-ds-error-border text-ds-error-text px-4 py-2 rounded-lg text-sm font-medium hover:bg-ds-error-bg">
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Reset Password Modal ────────────────────────────────────────────── */}
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
                  className="btn-brand w-full py-2.5 rounded-lg">Done</button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-ds-text1 mb-1">Reset Password</h2>
                <p className="text-xs text-ds-text3 mb-4">For: <span className="font-medium text-ds-text1">{user.email || user.phone || '—'}</span></p>
                {error && <p className="text-ds-error-text text-xs mb-3">{error}</p>}
                <div className="mb-4">
                  <label className="text-xs font-medium text-ds-text2 block mb-1">New Password</label>
                  <div className="flex gap-2">
                    <input type="text"
                      className="flex-1 border border-ds-border-strong rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ds-brand"
                      value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                    <button type="button" onClick={() => setNewPwd(generatePassword())}
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
