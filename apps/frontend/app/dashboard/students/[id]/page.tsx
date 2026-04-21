'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Student {
  id: string;
  admissionNo: string;
  rollNo?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  secondaryPhone?: string;
  admissionDate?: string;
  academicUnitId?: string;
  status: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  aadharNumber?: string;
  tcFromPrevious?: string;
  tcPreviousInstitution?: string;
  createdAt: string;
  academicUnit?: { id: string; displayName?: string; name?: string };
  userAccount?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  parentUser?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
}

interface AcademicUnit { id: string; displayName?: string; name?: string; }

interface TcRequest {
  id: string;
  status: string;
  tcNumber?: string;
  conductGrade: string;
  reason?: string;
  hasDues: boolean;
  duesRemark?: string;
  rejectionRemark?: string;
  requestedAt: string;
  issuedAt?: string;
}

const TC_LABELS: Record<string, string> = {
  not_applicable: 'Not Applicable', pending: 'Pending', received: 'Received', waived: 'Waived',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-ds-success-bg text-ds-success-text',
  inactive: 'bg-ds-bg2 text-ds-text2',
  transferred: 'bg-yellow-100 text-yellow-700',
  alumni: 'bg-ds-info-bg text-ds-info-text',
};

function generatePassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  // Guarantee at least one uppercase, lowercase, digit
  return rand(upper) + rand(lower) + rand(digits) +
    Array.from({ length: 7 }, () => rand(all)).join('');
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Student>>({});
  const [saving, setSaving] = useState(false);

  // TC state
  const [tc, setTc]                     = useState<TcRequest | null>(null);
  const [tcLoading, setTcLoading]       = useState(false);

  // Password reset state
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetLabel, setResetLabel] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [resetDone, setResetDone] = useState<{ label: string; username: string; password: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const loadTc = async (studentId: string) => {
    setTcLoading(true);
    try {
      const data = await apiFetch(`/tc?studentId=${studentId}`) as TcRequest[];
      // Show the most recent non-rejected TC (pending, approved, or issued)
      const active = data.find((t) => ['pending_approval', 'approved', 'issued'].includes(t.status));
      setTc(active ?? data[0] ?? null);
    } catch {
      // Non-fatal — TC section just shows nothing
    } finally {
      setTcLoading(false);
    }
  };

  const load = async () => {
    try {
      const [s, u] = await Promise.all([
        apiFetch(`/students/${id}`),
        apiFetch('/academic/units/leaf'),
      ]);
      setStudent(s as Student);
      setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : ((u as any).data || []));
      void loadTc(id);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) void load(); }, [id]);

  const startEdit = () => {
    if (!student) return;
    setForm({
      firstName: student.firstName, lastName: student.lastName,
      dateOfBirth: student.dateOfBirth?.split('T')[0],
      gender: student.gender, phone: student.phone, email: student.email,
      address: student.address, fatherName: student.fatherName,
      motherName: student.motherName, parentPhone: student.parentPhone,
      secondaryPhone: student.secondaryPhone,
      admissionDate: student.admissionDate?.split('T')[0],
      academicUnitId: student.academicUnitId, rollNo: student.rollNo,
      bloodGroup: student.bloodGroup, nationality: student.nationality,
      religion: student.religion, casteCategory: student.casteCategory,
      aadharNumber: student.aadharNumber,
      tcFromPrevious: student.tcFromPrevious,
      tcPreviousInstitution: student.tcPreviousInstitution,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setStudent(updated as Student);
      setEditing(false);
      showSuccess('Student updated');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const openResetModal = (userId: string, label: string, username: string) => {
    setResettingUserId(userId);
    setResetLabel(label);
    const generated = generatePassword();
    setNewPwd(generated);
    setResetDone(null);
    // Store username for display after reset
    (openResetModal as any)._username = username;
  };

  const handleReset = async () => {
    if (!resettingUserId || !newPwd) return;
    setResetting(true);
    setError(null);
    try {
      await apiFetch(`/users/${resettingUserId}/set-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: newPwd }),
      });
      const username = (openResetModal as any)._username || '—';
      setResetDone({ label: resetLabel, username, password: newPwd });
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const inp = 'border border-ds-border-strong p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand';
  const lbl = 'text-xs font-medium text-ds-text2 block mb-1';

  if (loading) return <div className="p-10 text-ds-text3">Loading...</div>;
  if (error && !student) return <div className="p-10 text-red-500">{error}</div>;
  if (!student) return null;

  const unit = units.find((u) => u.id === student.academicUnitId) ?? student.academicUnit;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push('/dashboard/students/directory')}
        className="text-sm text-ds-text2 hover:text-ds-text1 mb-6 flex items-center gap-1">
        ← Back to Directory
      </button>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Header */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700 shrink-0">
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ds-text1">{student.firstName} {student.lastName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-ds-text2 font-mono">{student.admissionNo}</span>
                {student.rollNo && <span className="text-sm text-ds-text2">Roll: {student.rollNo}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[student.status] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                  {student.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-ds-text2">{unit?.displayName || unit?.name || 'No class assigned'}</div>
            </div>
          </div>
          {!editing && (
            <button onClick={startEdit}
              className="btn-brand px-4 py-2 rounded-lg">
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 space-y-6">
          <h2 className="text-base font-medium">Edit Details</h2>

          <Section title="Basic Information">
            <div className="grid grid-cols-3 gap-4">
              <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} inp={inp} lbl={lbl} />
              <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} inp={inp} lbl={lbl} />
              <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} inp={inp} lbl={lbl} />
              <SelectField label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} lbl={lbl} inp={inp}
                options={[['', 'Select'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']]} />
              <Field label="Student Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inp={inp} lbl={lbl} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} inp={inp} lbl={lbl} />
              <Field label="Roll No" value={form.rollNo} onChange={(v) => setForm({ ...form, rollNo: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Parent / Guardian">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Father Name" value={form.fatherName} onChange={(v) => setForm({ ...form, fatherName: v })} inp={inp} lbl={lbl} />
              <Field label="Mother Name" value={form.motherName} onChange={(v) => setForm({ ...form, motherName: v })} inp={inp} lbl={lbl} />
              <Field label="Primary Contact" value={form.parentPhone} onChange={(v) => setForm({ ...form, parentPhone: v })} inp={inp} lbl={lbl} />
              <Field label="Secondary Contact" value={form.secondaryPhone} onChange={(v) => setForm({ ...form, secondaryPhone: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Address">
            <div>
              <label className={lbl}>Residential Address</label>
              <textarea className={inp} rows={2} value={form.address ?? ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </Section>

          <Section title="Academic">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Class</label>
                <select className={inp} value={form.academicUnitId ?? ''} onChange={(e) => setForm({ ...form, academicUnitId: e.target.value })}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <Field label="Admission Date" type="date" value={form.admissionDate} onChange={(v) => setForm({ ...form, admissionDate: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Demographics (Optional)">
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="Blood Group" value={form.bloodGroup} onChange={(v) => setForm({ ...form, bloodGroup: v })} lbl={lbl} inp={inp}
                options={[['', 'Select'], ...['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => [bg, bg] as [string, string])]} />
              <Field label="Nationality" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} inp={inp} lbl={lbl} />
              <Field label="Religion" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} inp={inp} lbl={lbl} />
              <SelectField label="Caste Category" value={form.casteCategory} onChange={(v) => setForm({ ...form, casteCategory: v })} lbl={lbl} inp={inp}
                options={[['', 'Select'], ['General','General'], ['OBC','OBC'], ['SC','SC'], ['ST','ST'], ['NT','NT'], ['SBC','SBC']]} />
              <Field label="Aadhar Number" value={form.aadharNumber} onChange={(v) => setForm({ ...form, aadharNumber: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Transfer Certificate">
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="TC Status" value={form.tcFromPrevious} onChange={(v) => setForm({ ...form, tcFromPrevious: v })} lbl={lbl} inp={inp}
                options={[['not_applicable','Not Applicable'],['pending','Pending'],['received','Received'],['waived','Waived']]} />
              <Field label="Previous Institution" value={form.tcPreviousInstitution} onChange={(v) => setForm({ ...form, tcPreviousInstitution: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="btn-brand px-6 py-2.5 rounded-lg">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-6 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <InfoCard title="Personal Information">
            <Row label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN') : '—'} />
            <Row label="Gender" value={student.gender ?? '—'} />
            <Row label="Phone" value={student.phone ?? '—'} />
            <Row label="Email" value={student.email ?? '—'} />
            <Row label="Blood Group" value={student.bloodGroup ?? '—'} />
            <Row label="Nationality" value={student.nationality ?? '—'} />
            <Row label="Religion" value={student.religion ?? '—'} />
            <Row label="Caste Category" value={student.casteCategory ?? '—'} />
            {student.aadharNumber && <Row label="Aadhar" value={`XXXX XXXX ${student.aadharNumber.slice(-4)}`} />}
            <Row label="Address" value={student.address ?? '—'} />
          </InfoCard>

          <InfoCard title="Family Details">
            <Row label="Father Name" value={student.fatherName ?? '—'} />
            <Row label="Mother Name" value={student.motherName ?? '—'} />
            <Row label="Primary Contact" value={student.parentPhone ?? '—'} />
            <Row label="Secondary Contact" value={student.secondaryPhone ?? '—'} />
          </InfoCard>

          <InfoCard title="Academic Details">
            <Row label="Class" value={unit?.displayName || unit?.name || '—'} />
            <Row label="Roll No" value={student.rollNo ?? '—'} />
            <Row label="Admission Date" value={student.admissionDate ? new Date(student.admissionDate).toLocaleDateString('en-IN') : '—'} />
            <Row label="Admitted On" value={new Date(student.createdAt).toLocaleDateString('en-IN')} />
          </InfoCard>

          <InfoCard title="Transfer Certificate">
            <Row label="Incoming TC" value={TC_LABELS[student.tcFromPrevious ?? ''] ?? student.tcFromPrevious ?? '—'} />
            <Row label="Previous Institution" value={student.tcPreviousInstitution ?? '—'} />

            {/* ── Outgoing TC section ── */}
            <div className="mt-3 pt-3 border-t border-ds-border">
              <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-2">Outgoing TC</p>
              {tcLoading ? (
                <p className="text-xs text-ds-text3">Loading…</p>
              ) : tc ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      tc.status === 'issued'           ? 'bg-ds-success-bg text-ds-success-text' :
                      tc.status === 'approved'         ? 'bg-ds-info-bg text-ds-info-text'  :
                      tc.status === 'pending_approval' ? 'bg-ds-warning-bg text-ds-warning-text':
                                                         'bg-ds-error-bg text-ds-error-text'
                    }`}>
                      {tc.status === 'pending_approval' ? 'Pending Approval' :
                       tc.status === 'approved'         ? 'Approved'         :
                       tc.status === 'issued'           ? 'Issued'           : 'Rejected'}
                    </span>
                    {tc.tcNumber && (
                      <span className="text-xs font-mono text-ds-text2">{tc.tcNumber}</span>
                    )}
                  </div>
                  {tc.rejectionRemark && (
                    <p className="text-xs text-red-500">Reason: {tc.rejectionRemark}</p>
                  )}
                  {tc.hasDues && (
                    <p className="text-xs text-ds-warning-text">{tc.duesRemark}</p>
                  )}
                  <Link
                    href="/dashboard/tc"
                    className="text-xs text-ds-text2 underline hover:text-ds-text1"
                  >
                    Manage in TC registry →
                  </Link>
                </div>
              ) : student.status === 'active' ? (
                <button
                  onClick={() => router.push(`/dashboard/tc/new?studentId=${id}`)}
                  className="mt-1 text-xs btn-brand px-3 py-1.5 rounded-lg font-medium"
                >
                  Request Transfer Certificate
                </button>
              ) : (
                <p className="text-xs text-ds-text3">
                  {student.status === 'transferred' ? 'Student already transferred.' : 'TC not applicable.'}
                </p>
              )}
            </div>
          </InfoCard>

          {/* Portal Access Card — spans full width */}
          <div className="col-span-2">
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-ds-text1 mb-4">Portal Access &amp; Credentials</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Parent Portal */}
                <CredentialCard
                  label="Parent Portal"
                  user={student.parentUser}
                  onReset={(userId, username) => openResetModal(userId, 'Parent Portal', username)}
                />
                {/* Student Portal */}
                <CredentialCard
                  label="Student Portal"
                  user={student.userAccount}
                  onReset={(userId, username) => openResetModal(userId, 'Student Portal', username)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resettingUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            {resetDone ? (
              /* Success — show credentials */
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
                    <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Portal</p>
                    <p className="text-ds-text1 font-medium font-sans">{resetDone.label}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Username</p>
                    <p className="text-ds-text1 font-medium">{resetDone.username}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">New Password</p>
                    <p className="text-ds-text1 font-bold tracking-wider text-base">{resetDone.password}</p>
                  </div>
                </div>
                <button onClick={() => { setResettingUserId(null); setResetDone(null); }}
                  className="btn-brand w-full py-2.5 rounded-lg">
                  Done
                </button>
              </div>
            ) : (
              /* Confirm reset */
              <div>
                <h2 className="text-lg font-bold text-ds-text1 mb-1">Reset Password</h2>
                <p className="text-xs text-ds-text3 mb-4">{resetLabel} — a new password will be generated and set immediately.</p>
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
                  <button onClick={() => { setResettingUserId(null); setError(null); }}
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

// ── Portal credential card ────────────────────────────────────────────────────
function CredentialCard({
  label, user, onReset,
}: {
  label: string;
  user?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  onReset: (userId: string, username: string) => void;
}) {
  if (!user) {
    return (
      <div className="rounded-lg border border-dashed border-ds-border p-4">
        <p className="text-xs font-semibold text-ds-text2 mb-2">{label}</p>
        <span className="text-xs text-ds-warning-text bg-ds-warning-bg border border-ds-warning-border rounded-full px-2 py-0.5">Not linked</span>
      </div>
    );
  }
  const username = user.email || user.phone || 'No username';
  return (
    <div className="rounded-lg border border-ds-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ds-text1">{label}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text2'}`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="bg-ds-bg2 rounded-lg p-3 space-y-2 font-mono text-xs">
        <div>
          <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Username</p>
          <p className="text-ds-text1 font-medium">{username}</p>
        </div>
        <div>
          <p className="text-[10px] text-ds-text3 uppercase font-sans mb-0.5">Password</p>
          <p className="text-ds-text3 italic font-sans text-xs">Hidden — use Reset to set a new one</p>
        </div>
      </div>
      <button
        onClick={() => onReset(user.id, username)}
        className="w-full text-xs btn-brand py-1.5 rounded-lg font-medium"
      >
        Reset Password
      </button>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-ds-text2">{label}</dt>
      <dd className="text-ds-text1 font-medium text-right max-w-[60%]">{value}</dd>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ds-text1 mb-4">{title}</h3>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, inp, lbl, type = 'text' }: {
  label: string; value?: string; onChange: (v: string) => void;
  inp: string; lbl: string; type?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input type={type} className={inp} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, inp, lbl, options }: {
  label: string; value?: string; onChange: (v: string) => void;
  inp: string; lbl: string; options: [string, string][];
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <select className={inp} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
