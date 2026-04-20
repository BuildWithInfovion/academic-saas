'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { TotpSetupCard } from '@/components/totp-setup-card';

type Institution = {
  id: string; name: string; code: string; institutionType: string;
  address?: string; phone?: string; email?: string; website?: string; board?: string;
};
type AcademicYear = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean };
type AcademicUnit = { id: string; name: string; displayName?: string; level: number; parentId?: string };
type FeeHead = { id: string; name: string; isCustom: boolean };
type Subject = { id: string; name: string };

type Tab = 'profile' | 'years' | 'classes' | 'fees' | 'subjects' | 'security';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Institution Profile' },
  { id: 'years',    label: 'Academic Years' },
  { id: 'classes',  label: 'Class Structure' },
  { id: 'fees',     label: 'Fee Heads' },
  { id: 'subjects', label: 'Subject Master' },
  { id: 'security', label: 'Security' },
];

const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';

function validateAcademicYearForm(form: { name: string; startDate: string; endDate: string }): string | null {
  const name = form.name.trim();
  if (!name || !form.startDate || !form.endDate) return 'Enter year value, start date, and end date';
  if (!/^\d{4}-\d{2}$/.test(name)) return 'Enter a valid year value like 2026-27';
  const startDate = new Date(`${form.startDate}T00:00:00`);
  const endDate   = new Date(`${form.endDate}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Enter valid start and end dates';
  if (startDate >= endDate) return 'End date must be after start date';
  const expected = `${startDate.getFullYear()}-${String(endDate.getFullYear()).slice(-2)}`;
  if (name !== expected) return `Year name must match the selected dates, for example ${expected}`;
  return null;
}

function compareAcademicUnits(a: AcademicUnit, b: AcademicUnit): number {
  const la = (a.displayName || a.name).toLowerCase();
  const lb = (b.displayName || b.name).toLowerCase();
  const order = ['lkg', 'ukg', 'kg', 'nursery'];
  const ai = order.findIndex((k) => la.includes(k));
  const bi = order.findIndex((k) => lb.includes(k));
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'base' });
}

export default function PrincipalSettingsPage() {
  const [tab, setTab]       = useState<Tab>('years');
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };
  const showError   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 5000); };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">School Settings</h1>
      <p className="text-sm text-ds-text3 mb-6">Manage academic structure, fee heads, subjects and institution profile</p>

      {error   && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      <div className="flex gap-1 bg-ds-bg2 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(null); setSuccess(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile'  && <ProfileTab  showSuccess={showSuccess} showError={showError} />}
      {tab === 'years'    && <YearsTab    showSuccess={showSuccess} showError={showError} />}
      {tab === 'classes'  && <ClassesTab  showSuccess={showSuccess} showError={showError} />}
      {tab === 'fees'     && <FeeHeadsTab showSuccess={showSuccess} showError={showError} />}
      {tab === 'subjects' && <SubjectsTab showSuccess={showSuccess} showError={showError} />}
      {tab === 'security' && (
        <div className="max-w-xl">
          <h2 className="text-base font-semibold text-ds-text1 mb-1">Account Security</h2>
          <p className="text-sm text-ds-text3 mb-4">Manage two-factor authentication for your account</p>
          <TotpSetupCard />
        </div>
      )}
    </div>
  );
}

// ── Tab: Institution Profile ──────────────────────────────────────────────────
function ProfileTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [inst, setInst] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({ name: '', institutionType: '', address: '', phone: '', email: '', website: '', board: '' });

  useEffect(() => {
    apiFetch('/institution/me')
      .then((data) => {
        const d = data as Institution;
        setInst(d);
        setForm({ name: d.name ?? '', institutionType: d.institutionType ?? '', address: d.address ?? '', phone: d.phone ?? '', email: d.email ?? '', website: d.website ?? '', board: d.board ?? '' });
      })
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/institution/me', { method: 'PATCH', body: JSON.stringify(form) });
      showSuccess('Institution profile updated');
    } catch (e: any) { showError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-ds-text3">Loading...</p>;

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs font-medium text-ds-text2 block mb-1">Institution Name *</label>
          <input className={inp} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Type</label>
          <select className={inp} value={form.institutionType} onChange={(e) => setForm((f) => ({ ...f, institutionType: e.target.value }))}>
            <option value="school">School</option>
            <option value="college">College</option>
            <option value="coaching">Coaching</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Affiliation Board</label>
          <input className={inp} placeholder="e.g. CBSE, ICSE, SSC" value={form.board} onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-ds-text2 block mb-1">Address</label>
          <input className={inp} placeholder="Full address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Phone</label>
          <input className={inp} placeholder="Contact number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Email</label>
          <input type="email" className={inp} placeholder="institution@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Website</label>
          <input className={inp} placeholder="https://yourschool.edu.in" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Login Code</label>
          <input className={inp + ' bg-ds-bg2 text-ds-text3'} value={inst?.code ?? ''} readOnly />
          <p className="text-[10px] text-ds-text3 mt-1">Contact platform admin to change the login code.</p>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="btn-brand mt-6 px-6 py-2.5 rounded-lg">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Tab: Academic Years ───────────────────────────────────────────────────────
function YearsTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [years, setYears]       = useState<AcademicYear[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', startDate: '', endDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [settingCurrent, setSettingCurrent] = useState<string | null>(null);

  const load = () => apiFetch('/academic/years')
    .then((d) => setYears(d as AcademicYear[]))
    .catch((e: any) => showError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // Auto-fill year name when dates change
  const updateYearName = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;
    const s = new Date(`${startDate}T00:00:00`);
    const e = new Date(`${endDate}T00:00:00`);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s < e) {
      setForm((f) => ({ ...f, name: `${s.getFullYear()}-${String(e.getFullYear()).slice(-2)}` }));
    }
  };

  const handleCreate = async () => {
    const err = validateAcademicYearForm(form);
    if (err) return showError(err);
    setSubmitting(true);
    try {
      await apiFetch('/academic/years', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim() }) });
      showSuccess('Academic year created');
      setShowForm(false);
      setForm({ name: '', startDate: '', endDate: '' });
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleSetCurrent = async (id: string) => {
    setSettingCurrent(id);
    try {
      await apiFetch(`/academic/years/${id}/set-current`, { method: 'PATCH' });
      showSuccess('Current year updated');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setSettingCurrent(null); }
  };

  const currentYear = years.find((y) => y.isCurrent);
  const now = new Date();
  const suggestedName = now.getMonth() >= 5
    ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(-2)}`;

  return (
    <div className="space-y-4">
      {!currentYear && (
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-4 text-sm text-ds-warning-text">
          No current academic year set. Create one below so the system knows the active session.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ds-text2">
          Suggested for this session: <strong>{suggestedName}</strong>
        </p>
        <button onClick={() => setShowForm(!showForm)}
          className="btn-brand px-4 py-2 rounded-lg">
          + New Academic Year
        </button>
      </div>

      {showForm && (
        <div className="bg-ds-surface rounded-xl border border-ds-border p-5 shadow-sm">
          <h3 className="font-semibold text-ds-text1 text-sm mb-4">Create Academic Year</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Start Date *</label>
              <input type="date" className={inp} value={form.startDate}
                onChange={(e) => { setForm((f) => ({ ...f, startDate: e.target.value })); updateYearName(e.target.value, form.endDate); }} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">End Date *</label>
              <input type="date" className={inp} value={form.endDate}
                onChange={(e) => { setForm((f) => ({ ...f, endDate: e.target.value })); updateYearName(form.startDate, e.target.value); }} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Name (auto-filled) *</label>
              <input className={inp} placeholder="e.g. 2026-27" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)}
              className="border border-ds-border-strong text-ds-text1 px-4 py-2 rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            <button onClick={handleCreate} disabled={submitting}
              className="btn-brand px-4 py-2 rounded-lg">
              {submitting ? 'Creating...' : 'Create Year'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : years.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No academic years yet. Create one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ds-bg2">
              <tr>
                <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Name</th>
                <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Period</th>
                <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {years.map((y) => (
                <tr key={y.id} className="hover:bg-ds-bg2">
                  <td className="px-5 py-3 font-medium text-ds-text1">{y.name}</td>
                  <td className="px-5 py-3 text-ds-text2 text-xs">
                    {new Date(y.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
                    {new Date(y.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3">
                    {y.isCurrent
                      ? <span className="px-2 py-0.5 bg-ds-success-bg text-ds-success-text rounded-full text-xs font-medium">Current</span>
                      : <span className="px-2 py-0.5 bg-ds-bg2 text-ds-text2 rounded-full text-xs">Inactive</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!y.isCurrent && (
                      <button onClick={() => handleSetCurrent(y.id)} disabled={settingCurrent === y.id}
                        className="text-xs text-ds-brand hover:text-blue-800 font-medium disabled:opacity-50">
                        {settingCurrent === y.id ? 'Setting...' : 'Set Current'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Tab: Class Structure ──────────────────────────────────────────────────────
function ClassesTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [units, setUnits]       = useState<AcademicUnit[]>([]);
  const [years, setYears]       = useState<AcademicYear[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', displayName: '', level: '1', parentId: '', academicYearId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const load = async () => {
    try {
      const [u, y] = await Promise.all([apiFetch('/academic/units'), apiFetch('/academic/years')]);
      setUnits(u as AcademicUnit[]);
      const ys = y as AcademicYear[];
      setYears(ys);
      if (!form.academicYearId) {
        const cur = ys.find((yr) => yr.isCurrent);
        if (cur) setForm((f) => ({ ...f, academicYearId: cur.id }));
      }
    } catch (e: any) { showError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return showError('Class name is required');
    setSubmitting(true);
    try {
      await apiFetch('/academic/units', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), displayName: form.displayName.trim() || undefined, level: parseInt(form.level), parentId: form.parentId || undefined, academicYearId: form.academicYearId || undefined }),
      });
      showSuccess('Class created');
      setShowForm(false);
      setForm((f) => ({ ...f, name: '', displayName: '' }));
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete class "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/academic/units/${id}`, { method: 'DELETE' });
      showSuccess('Class deleted');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setDeleting(null); }
  };

  const rootUnits = [...units.filter((u) => !u.parentId)].sort(compareAcademicUnits);
  const childUnits = (parentId: string) => units.filter((u) => u.parentId === parentId).sort(compareAcademicUnits);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="btn-brand px-4 py-2 rounded-lg">
          + Add Class / Section
        </button>
      </div>

      {showForm && (
        <div className="bg-ds-surface rounded-xl border border-ds-border p-5 shadow-sm">
          <h3 className="font-semibold text-ds-text1 text-sm mb-4">Create Class or Section</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Name *</label>
              <input className={inp} placeholder="e.g. Class 10" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Display Name (optional)</label>
              <input className={inp} placeholder="10th Standard" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Level</label>
              <select className={inp} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
                <option value="1">1 — Class / Grade</option>
                <option value="2">2 — Section / Division</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Parent Class (for sections)</label>
              <select className={inp} value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
                <option value="">None (top-level)</option>
                {rootUnits.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year</label>
              <select className={inp} value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}>
                <option value="">None</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="border border-ds-border-strong text-ds-text1 px-4 py-2 rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="btn-brand px-4 py-2 rounded-lg">
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : units.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No classes yet.</p>
        ) : (
          <div className="divide-y divide-ds-border">
            {rootUnits.map((unit) => (
              <div key={unit.id}>
                <div className="flex items-center justify-between px-5 py-3 hover:bg-ds-bg2">
                  <div>
                    <span className="font-medium text-ds-text1 text-sm">{unit.displayName || unit.name}</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-ds-bg2 text-ds-text2 rounded text-[10px]">Level {unit.level}</span>
                  </div>
                  <button onClick={() => handleDelete(unit.id, unit.displayName || unit.name)} disabled={deleting === unit.id}
                    className="text-xs text-red-500 hover:text-ds-error-text font-medium disabled:opacity-50">
                    {deleting === unit.id ? '...' : 'Delete'}
                  </button>
                </div>
                {childUnits(unit.id).map((child) => (
                  <div key={child.id} className="flex items-center justify-between px-5 py-2.5 pl-10 bg-ds-bg2/50 border-t border-ds-border hover:bg-ds-bg2/50">
                    <div>
                      <span className="text-sm text-ds-text1">{child.displayName || child.name}</span>
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-ds-info-text rounded text-[10px]">Section</span>
                    </div>
                    <button onClick={() => handleDelete(child.id, child.displayName || child.name)} disabled={deleting === child.id}
                      className="text-xs text-red-500 hover:text-ds-error-text font-medium disabled:opacity-50">
                      {deleting === child.id ? '...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Fee Heads ────────────────────────────────────────────────────────────
function FeeHeadsTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [heads, setHeads]   = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => apiFetch('/fees/heads').then((d) => setHeads(d as FeeHead[])).catch((e: any) => showError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return showError('Fee head name is required');
    setAdding(true);
    try {
      await apiFetch('/fees/heads', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      showSuccess('Fee head added');
      setNewName('');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete fee head "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/fees/heads/${id}`, { method: 'DELETE' });
      showSuccess('Fee head deleted');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-surface rounded-xl border border-ds-border p-4 shadow-sm flex gap-3">
        <input className={inp} placeholder="e.g. Hostel Fee, Bus Fee" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} disabled={adding}
          className="btn-brand px-4 py-2 rounded-lg shrink-0">
          {adding ? 'Adding...' : '+ Add'}
        </button>
      </div>
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : heads.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No fee heads yet.</p>
        ) : (
          <div className="divide-y divide-ds-border">
            {heads.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-ds-bg2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ds-text1">{h.name}</span>
                  {!h.isCustom && <span className="px-1.5 py-0.5 bg-ds-bg2 text-ds-text3 rounded text-[10px]">Default</span>}
                </div>
                <button onClick={() => handleDelete(h.id, h.name)} disabled={deleting === h.id}
                  className="text-xs text-red-500 hover:text-ds-error-text font-medium disabled:opacity-50">
                  {deleting === h.id ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Subject Master ───────────────────────────────────────────────────────
function SubjectsTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState('');
  const [adding, setAdding]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => apiFetch('/subjects').then((d) => setSubjects(d as Subject[])).catch((e: any) => showError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return showError('Subject name is required');
    setAdding(true);
    try {
      await apiFetch('/subjects', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      showSuccess('Subject added');
      setNewName('');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/subjects/${id}`, { method: 'DELETE' });
      showSuccess('Subject deleted');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-surface rounded-xl border border-ds-border p-4 shadow-sm flex gap-3">
        <input className={inp} placeholder="e.g. Environmental Science, Economics" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} disabled={adding}
          className="btn-brand px-4 py-2 rounded-lg shrink-0">
          {adding ? 'Adding...' : '+ Add'}
        </button>
      </div>
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : subjects.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No subjects yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-0 divide-y divide-ds-border">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-ds-bg2">
                <span className="text-sm text-ds-text1">{s.name}</span>
                <button onClick={() => handleDelete(s.id, s.name)} disabled={deleting === s.id}
                  className="text-xs text-red-400 hover:text-ds-error-text font-medium disabled:opacity-50 ml-2">
                  {deleting === s.id ? '...' : '×'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
