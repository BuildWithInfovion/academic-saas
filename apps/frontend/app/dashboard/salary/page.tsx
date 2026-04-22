'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type AllowanceItem = { name: string; amount: number };

type SalaryStructure = {
  id: string; name: string; description?: string; isActive: boolean;
  basicSalary: number; houseRentAllowance: number; medicalAllowance: number;
  transportAllowance: number; otherAllowances: AllowanceItem[];
  providentFund: number; professionalTax: number; otherDeductions: AllowanceItem[];
  _count: { staffProfiles: number };
};

type StaffUser = { id: string; name?: string; email?: string; phone?: string; roles: { role: { id: string; code: string; label: string } }[] };

type SalaryProfile = {
  id: string; userId: string; isActive: boolean; effectiveFrom: string; notes?: string;
  basicSalary: number; houseRentAllowance: number; medicalAllowance: number;
  transportAllowance: number; otherAllowances: AllowanceItem[];
  providentFund: number; professionalTax: number; otherDeductions: AllowanceItem[];
  structure?: { id: string; name: string };
  user: StaffUser;
};

type SalaryRecord = {
  id: string; userId: string; month: number; year: number; status: string;
  basicSalary: number; houseRentAllowance: number; medicalAllowance: number;
  transportAllowance: number; otherAllowances: AllowanceItem[];
  grossSalary: number; providentFund: number; professionalTax: number;
  otherDeductions: AllowanceItem[]; totalDeductions: number; netSalary: number;
  paidOn?: string; paymentMode?: string; paymentReference?: string; remarks?: string;
  user: StaffUser;
};

type Summary = {
  month: number; year: number; total: number; paid: number; pending: number; onHold: number;
  totalNetSalary: number; paidAmount: number; pendingAmount: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PAYMENT_MODES = ['cash', 'bank_transfer', 'cheque', 'upi', 'other'];
const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-ds-success-bg text-ds-success-text',
  pending: 'bg-yellow-100 text-yellow-700',
  on_hold: 'bg-orange-100 text-orange-700',
};
const STATUS_LABEL: Record<string, string> = { paid: 'Paid', pending: 'Pending', on_hold: 'On Hold' };

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function staffLabel(user: StaffUser) {
  return user.name || user.email || user.phone || 'Unknown';
}

function roleLabel(user: StaffUser) {
  return user.roles.map((r) => r.role.label).join(', ') || 'No Role';
}

function currentYearMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// ── Empty form states ──────────────────────────────────────────────────────────

function emptyStructureForm() {
  return {
    name: '', description: '', basicSalary: '', houseRentAllowance: '', medicalAllowance: '',
    transportAllowance: '', providentFund: '', professionalTax: '',
    otherAllowances: [] as AllowanceItem[], otherDeductions: [] as AllowanceItem[],
  };
}

function emptyProfileForm() {
  const today = new Date().toISOString().split('T')[0];
  return {
    userId: '', structureId: '', basicSalary: '', houseRentAllowance: '', medicalAllowance: '',
    transportAllowance: '', providentFund: '', professionalTax: '', effectiveFrom: today,
    notes: '', otherAllowances: [] as AllowanceItem[], otherDeductions: [] as AllowanceItem[],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SalaryBreakdownRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  if (value === 0) return null;
  return (
    <div className={`flex justify-between text-sm py-1 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-ds-text2">{label}</span>
      <span className={highlight ? 'text-ds-text1' : 'text-ds-text1'}>{fmt(value)}</span>
    </div>
  );
}

function ExtraItemsEditor({
  label, items, onChange,
}: { label: string; items: AllowanceItem[]; onChange: (items: AllowanceItem[]) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-ds-text2 mb-1">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-1">
          <input
            className="flex-1 border border-ds-border-strong rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ds-brand"
            placeholder="Name" value={item.name}
            onChange={(e) => {
              const next = [...items]; next[i] = { ...next[i], name: e.target.value }; onChange(next);
            }}
          />
          <input
            className="w-24 border border-ds-border-strong rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ds-brand"
            placeholder="Amount" type="number" min="0" value={item.amount}
            onChange={(e) => {
              const next = [...items]; next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 }; onChange(next);
            }}
          />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { name: '', amount: 0 }])}
        className="text-xs text-ds-brand hover:underline mt-0.5">+ Add</button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SalaryPage() {
  const [tab, setTab] = useState<'overview' | 'structures' | 'profiles' | 'records'>('overview');

  // Shared data
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [profiles, setProfiles] = useState<SalaryProfile[]>([]);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [unassignedStaff, setUnassignedStaff] = useState<StaffUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters for records
  const { month: curMonth, year: curYear } = currentYearMonth();
  const [filterMonth, setFilterMonth] = useState(curMonth);
  const [filterYear, setFilterYear] = useState(curYear);
  const [filterStatus, setFilterStatus] = useState('');

  // Structure modal
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);
  const [structureForm, setStructureForm] = useState(emptyStructureForm());
  const [structureSaving, setStructureSaving] = useState(false);

  // Profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SalaryProfile | null>(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm());
  const [profileSaving, setProfileSaving] = useState(false);

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genMonth, setGenMonth] = useState(curMonth);
  const [genYear, setGenYear] = useState(curYear);
  const [generating, setGenerating] = useState(false);

  // Status update modal
  const [statusRecord, setStatusRecord] = useState<SalaryRecord | null>(null);
  const [statusForm, setStatusForm] = useState({ status: 'paid', paidOn: '', paymentMode: 'cash', paymentReference: '', remarks: '' });
  const [statusSaving, setStatusSaving] = useState(false);

  const showMsg = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, r, sum, ua] = await Promise.all([
        apiFetch('/salary/structures') as Promise<SalaryStructure[]>,
        apiFetch('/salary/profiles') as Promise<SalaryProfile[]>,
        apiFetch(`/salary/records?month=${filterMonth}&year=${filterYear}${filterStatus ? `&status=${filterStatus}` : ''}`) as Promise<SalaryRecord[]>,
        apiFetch(`/salary/summary?month=${filterMonth}&year=${filterYear}`) as Promise<Summary>,
        apiFetch('/salary/profiles/unassigned') as Promise<StaffUser[]>,
      ]);
      setStructures(s); setProfiles(p); setRecords(r); setSummary(sum); setUnassignedStaff(ua);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [filterMonth, filterYear, filterStatus]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const loadRecords = async () => {
    try {
      const [r, sum] = await Promise.all([
        apiFetch(`/salary/records?month=${filterMonth}&year=${filterYear}${filterStatus ? `&status=${filterStatus}` : ''}`) as Promise<SalaryRecord[]>,
        apiFetch(`/salary/summary?month=${filterMonth}&year=${filterYear}`) as Promise<Summary>,
      ]);
      setRecords(r); setSummary(sum);
    } catch { /* silent */ }
  };

  // ── Structure CRUD ──────────────────────────────────────────────────────────

  const openNewStructure = () => {
    setEditingStructure(null);
    setStructureForm(emptyStructureForm());
    setShowStructureModal(true);
  };

  const openEditStructure = (s: SalaryStructure) => {
    setEditingStructure(s);
    setStructureForm({
      name: s.name, description: s.description ?? '', basicSalary: String(s.basicSalary),
      houseRentAllowance: String(s.houseRentAllowance), medicalAllowance: String(s.medicalAllowance),
      transportAllowance: String(s.transportAllowance), providentFund: String(s.providentFund),
      professionalTax: String(s.professionalTax),
      otherAllowances: s.otherAllowances ?? [], otherDeductions: s.otherDeductions ?? [],
    });
    setShowStructureModal(true);
  };

  const saveStructure = async () => {
    setStructureSaving(true); setError(null);
    try {
      const payload = {
        name: structureForm.name, description: structureForm.description || undefined,
        basicSalary: parseFloat(structureForm.basicSalary) || 0,
        houseRentAllowance: parseFloat(structureForm.houseRentAllowance) || 0,
        medicalAllowance: parseFloat(structureForm.medicalAllowance) || 0,
        transportAllowance: parseFloat(structureForm.transportAllowance) || 0,
        providentFund: parseFloat(structureForm.providentFund) || 0,
        professionalTax: parseFloat(structureForm.professionalTax) || 0,
        otherAllowances: structureForm.otherAllowances.filter((i) => i.name),
        otherDeductions: structureForm.otherDeductions.filter((i) => i.name),
      };
      if (editingStructure) {
        await apiFetch(`/salary/structures/${editingStructure.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showMsg('Structure updated');
      } else {
        await apiFetch('/salary/structures', { method: 'POST', body: JSON.stringify(payload) });
        showMsg('Structure created');
      }
      setShowStructureModal(false);
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setStructureSaving(false); }
  };

  const deleteStructure = async (s: SalaryStructure) => {
    if (!confirm(`Delete salary structure "${s.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/salary/structures/${s.id}`, { method: 'DELETE' });
      showMsg('Structure deleted');
      await loadAll();
    } catch (e: any) { setError(e.message); }
  };

  // ── Profile CRUD ────────────────────────────────────────────────────────────

  const openNewProfile = (prefillUserId?: string) => {
    setEditingProfile(null);
    const form = emptyProfileForm();
    if (prefillUserId) form.userId = prefillUserId;
    setProfileForm(form);
    setShowProfileModal(true);
  };

  const openEditProfile = (p: SalaryProfile) => {
    setEditingProfile(p);
    setProfileForm({
      userId: p.userId, structureId: p.structure?.id ?? '',
      basicSalary: String(p.basicSalary), houseRentAllowance: String(p.houseRentAllowance),
      medicalAllowance: String(p.medicalAllowance), transportAllowance: String(p.transportAllowance),
      providentFund: String(p.providentFund), professionalTax: String(p.professionalTax),
      effectiveFrom: p.effectiveFrom.split('T')[0], notes: p.notes ?? '',
      otherAllowances: p.otherAllowances ?? [], otherDeductions: p.otherDeductions ?? [],
    });
    setShowProfileModal(true);
  };

  const applyStructureToForm = (structureId: string) => {
    const s = structures.find((s) => s.id === structureId);
    if (!s) return;
    setProfileForm((f) => ({
      ...f, structureId,
      basicSalary: String(s.basicSalary), houseRentAllowance: String(s.houseRentAllowance),
      medicalAllowance: String(s.medicalAllowance), transportAllowance: String(s.transportAllowance),
      providentFund: String(s.providentFund), professionalTax: String(s.professionalTax),
      otherAllowances: s.otherAllowances ?? [], otherDeductions: s.otherDeductions ?? [],
    }));
  };

  const saveProfile = async () => {
    setProfileSaving(true); setError(null);
    try {
      const payload = {
        userId: profileForm.userId, structureId: profileForm.structureId || undefined,
        basicSalary: parseFloat(profileForm.basicSalary) || 0,
        houseRentAllowance: parseFloat(profileForm.houseRentAllowance) || 0,
        medicalAllowance: parseFloat(profileForm.medicalAllowance) || 0,
        transportAllowance: parseFloat(profileForm.transportAllowance) || 0,
        providentFund: parseFloat(profileForm.providentFund) || 0,
        professionalTax: parseFloat(profileForm.professionalTax) || 0,
        effectiveFrom: profileForm.effectiveFrom, notes: profileForm.notes || undefined,
        otherAllowances: profileForm.otherAllowances.filter((i) => i.name),
        otherDeductions: profileForm.otherDeductions.filter((i) => i.name),
      };
      if (editingProfile) {
        await apiFetch(`/salary/profiles/${editingProfile.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showMsg('Profile updated');
      } else {
        await apiFetch('/salary/profiles', { method: 'POST', body: JSON.stringify(payload) });
        showMsg('Salary profile assigned');
      }
      setShowProfileModal(false);
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setProfileSaving(false); }
  };

  // ── Generate salaries ───────────────────────────────────────────────────────

  const generateSalaries = async () => {
    setGenerating(true); setError(null);
    try {
      const result = await apiFetch('/salary/generate', {
        method: 'POST', body: JSON.stringify({ month: genMonth, year: genYear }),
      }) as { created: number; skipped: number; total: number };
      setShowGenerateModal(false);
      showMsg(`Generated ${result.created} salary slips (${result.skipped} already existed)`);
      setFilterMonth(genMonth); setFilterYear(genYear);
      await loadAll();
      setTab('records');
    } catch (e: any) { setError(e.message); }
    finally { setGenerating(false); }
  };

  // ── Status update ───────────────────────────────────────────────────────────

  const openStatusModal = (r: SalaryRecord) => {
    setStatusRecord(r);
    setStatusForm({
      status: r.status === 'paid' ? 'pending' : 'paid',
      paidOn: new Date().toISOString().split('T')[0],
      paymentMode: 'cash', paymentReference: '', remarks: r.remarks ?? '',
    });
  };

  const saveStatus = async () => {
    if (!statusRecord) return;
    setStatusSaving(true); setError(null);
    try {
      await apiFetch(`/salary/records/${statusRecord.id}/status`, {
        method: 'PATCH', body: JSON.stringify(statusForm),
      });
      showMsg('Status updated');
      setStatusRecord(null);
      await loadRecords();
    } catch (e: any) { setError(e.message); }
    finally { setStatusSaving(false); }
  };

  // ── Computed gross/net preview in profile form ──────────────────────────────
  const formGross =
    (parseFloat(profileForm.basicSalary) || 0) +
    (parseFloat(profileForm.houseRentAllowance) || 0) +
    (parseFloat(profileForm.medicalAllowance) || 0) +
    (parseFloat(profileForm.transportAllowance) || 0) +
    profileForm.otherAllowances.reduce((s, a) => s + (a.amount || 0), 0);
  const formDeductions =
    (parseFloat(profileForm.providentFund) || 0) +
    (parseFloat(profileForm.professionalTax) || 0) +
    profileForm.otherDeductions.reduce((s, d) => s + (d.amount || 0), 0);
  const formNet = formGross - formDeductions;

  const structGross = (f: typeof structureForm) =>
    (parseFloat(f.basicSalary) || 0) + (parseFloat(f.houseRentAllowance) || 0) +
    (parseFloat(f.medicalAllowance) || 0) + (parseFloat(f.transportAllowance) || 0) +
    f.otherAllowances.reduce((s, a) => s + a.amount, 0);
  const structDeductions = (f: typeof structureForm) =>
    (parseFloat(f.providentFund) || 0) + (parseFloat(f.professionalTax) || 0) +
    f.otherDeductions.reduce((s, d) => s + d.amount, 0);

  if (loading) return <div className="p-8 text-ds-text3 text-sm">Loading salary data...</div>;

  // ── Available years for filter ──────────────────────────────────────────────
  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i);

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ds-text1">Staff Salary Management</h1>
          <p className="text-sm text-ds-text3 mt-0.5">Configure structures, assign profiles, and manage monthly payroll</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGenerateModal(true)}
            className="btn-brand px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="13" x2="12" y2="17"/><line x1="10" y1="15" x2="14" y2="15"/>
            </svg>
            Generate Salaries
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ds-border">
        {(['overview', 'structures', 'profiles', 'records'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              tab === t ? 'border-ds-brand text-ds-brand' : 'border-transparent text-ds-text2 hover:text-ds-text1'
            }`}>
            {t === 'records' ? 'Monthly Salaries' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'profiles' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-ds-bg2 text-ds-text3 text-[10px]">{profiles.length}</span>}
            {t === 'structures' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-ds-bg2 text-ds-text3 text-[10px]">{structures.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Staff', value: summary.total, sub: 'with salary profiles', color: 'text-ds-text1' },
                { label: 'Paid', value: summary.paid, sub: `${fmt(summary.paidAmount)}`, color: 'text-green-600' },
                { label: 'Pending', value: summary.pending, sub: `${fmt(summary.pendingAmount)}`, color: 'text-yellow-600' },
                { label: 'On Hold', value: summary.onHold, sub: 'salary records', color: 'text-orange-600' },
              ].map((card) => (
                <div key={card.label} className="bg-ds-surface border border-ds-border rounded-xl p-4">
                  <p className="text-xs text-ds-text3 mb-1">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-ds-text3 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Month selector */}
          <div className="bg-ds-surface border border-ds-border rounded-xl p-4 flex items-center gap-3">
            <span className="text-sm text-ds-text2 font-medium">Viewing:</span>
            <select value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))}
              className="border border-ds-border-strong rounded-lg px-3 py-1.5 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="border border-ds-border-strong rounded-lg px-3 py-1.5 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => void loadRecords()} className="text-xs text-ds-brand hover:underline">Refresh</button>
          </div>

          {/* Unassigned staff alert */}
          {unassignedStaff.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg width="16" height="16" fill="none" stroke="#ca8a04" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">{unassignedStaff.length} staff member{unassignedStaff.length > 1 ? 's' : ''} without a salary profile</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {unassignedStaff.slice(0, 6).map((u) => (
                      <button key={u.id} onClick={() => { setTab('profiles'); openNewProfile(u.id); }}
                        className="text-xs bg-white border border-yellow-300 text-yellow-800 px-2 py-1 rounded-lg hover:bg-yellow-100">
                        {staffLabel(u)}
                      </button>
                    ))}
                    {unassignedStaff.length > 6 && <span className="text-xs text-yellow-600">+{unassignedStaff.length - 6} more</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent records preview */}
          {records.length > 0 && (
            <div className="bg-ds-surface border border-ds-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-ds-border">
                <h3 className="text-sm font-semibold text-ds-text1">
                  {MONTHS[filterMonth - 1]} {filterYear} — Salary Records
                </h3>
                <button onClick={() => setTab('records')} className="text-xs text-ds-brand hover:underline">View all</button>
              </div>
              <div className="divide-y divide-ds-border">
                {records.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-ds-bg2 flex items-center justify-center text-xs font-bold text-ds-text2">
                        {(staffLabel(r.user)[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ds-text1">{staffLabel(r.user)}</p>
                        <p className="text-xs text-ds-text3">{roleLabel(r.user)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-ds-text1">{fmt(r.netSalary)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Structures Tab ────────────────────────────────────────────────── */}
      {tab === 'structures' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-ds-text2">Define reusable salary templates for different staff grades.</p>
            <button onClick={openNewStructure} className="btn-brand px-3 py-2 rounded-lg text-sm font-medium">
              + New Structure
            </button>
          </div>
          {structures.length === 0 ? (
            <div className="bg-ds-surface border border-ds-border rounded-xl p-12 text-center">
              <p className="text-ds-text2 text-sm">No salary structures yet.</p>
              <button onClick={openNewStructure} className="mt-3 btn-brand px-4 py-2 rounded-lg text-sm">Create First Structure</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {structures.map((s) => {
                const gross = s.basicSalary + s.houseRentAllowance + s.medicalAllowance + s.transportAllowance +
                  (s.otherAllowances ?? []).reduce((a, i) => a + i.amount, 0);
                const deductions = s.providentFund + s.professionalTax +
                  (s.otherDeductions ?? []).reduce((a, i) => a + i.amount, 0);
                const net = gross - deductions;
                return (
                  <div key={s.id} className="bg-ds-surface border border-ds-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-ds-text1">{s.name}</h3>
                        {s.description && <p className="text-xs text-ds-text3 mt-0.5">{s.description}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text3'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <SalaryBreakdownRow label="Basic" value={s.basicSalary} />
                      <SalaryBreakdownRow label="HRA" value={s.houseRentAllowance} />
                      <SalaryBreakdownRow label="Medical" value={s.medicalAllowance} />
                      <SalaryBreakdownRow label="Transport" value={s.transportAllowance} />
                      {(s.otherAllowances ?? []).map((a) => <SalaryBreakdownRow key={a.name} label={a.name} value={a.amount} />)}
                    </div>
                    <div className="flex justify-between py-1.5 border-t border-ds-border font-semibold text-sm">
                      <span className="text-ds-text2">Gross</span><span className="text-ds-text1">{fmt(gross)}</span>
                    </div>
                    {deductions > 0 && (
                      <div className="space-y-1 mt-1">
                        <SalaryBreakdownRow label="PF" value={s.providentFund} />
                        <SalaryBreakdownRow label="Professional Tax" value={s.professionalTax} />
                        {(s.otherDeductions ?? []).map((d) => <SalaryBreakdownRow key={d.name} label={d.name} value={d.amount} />)}
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-t border-ds-border font-bold text-sm mt-1">
                      <span className="text-ds-text2">Net Salary</span><span className="text-green-600">{fmt(net)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-ds-border">
                      <span className="text-xs text-ds-text3">{s._count.staffProfiles} staff assigned</span>
                      <div className="flex gap-2">
                        <button onClick={() => openEditStructure(s)}
                          className="text-xs text-ds-brand hover:underline">Edit</button>
                        {s._count.staffProfiles === 0 && (
                          <button onClick={() => deleteStructure(s)}
                            className="text-xs text-red-500 hover:underline">Delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Profiles Tab ─────────────────────────────────────────────────── */}
      {tab === 'profiles' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-ds-text2">
              {profiles.length} staff with salary profiles.
              {unassignedStaff.length > 0 && ` ${unassignedStaff.length} without.`}
            </p>
            <button onClick={() => openNewProfile()} className="btn-brand px-3 py-2 rounded-lg text-sm font-medium">
              + Assign Profile
            </button>
          </div>
          {profiles.length === 0 ? (
            <div className="bg-ds-surface border border-ds-border rounded-xl p-12 text-center">
              <p className="text-ds-text2 text-sm">No salary profiles assigned yet.</p>
              <button onClick={() => openNewProfile()} className="mt-3 btn-brand px-4 py-2 rounded-lg text-sm">Assign First Profile</button>
            </div>
          ) : (
            <div className="bg-ds-surface border border-ds-border rounded-xl overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-ds-border bg-ds-bg2">
                    <th className="text-left px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[28%]">Staff</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden md:table-cell w-[18%]">Structure</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[12%]">Gross</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[12%]">Net</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden lg:table-cell w-[14%]">Effective</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[10%]">Status</th>
                    <th className="px-4 py-3 w-[6%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {profiles.map((p) => {
                    const gross = p.basicSalary + p.houseRentAllowance + p.medicalAllowance + p.transportAllowance +
                      (p.otherAllowances ?? []).reduce((a, i) => a + i.amount, 0);
                    const deductions = p.providentFund + p.professionalTax +
                      (p.otherDeductions ?? []).reduce((a, i) => a + i.amount, 0);
                    const net = gross - deductions;
                    return (
                      <tr key={p.id} className="hover:bg-ds-bg2/50">
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-ds-text1">{staffLabel(p.user)}</p>
                          <p className="text-xs text-ds-text3">{roleLabel(p.user)}</p>
                        </td>
                        <td className="px-4 py-3 text-ds-text2 text-xs hidden md:table-cell align-top">
                          {p.structure?.name ?? <span className="italic text-ds-text3">Custom</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-ds-text1 align-top">{fmt(gross)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600 align-top">{fmt(net)}</td>
                        <td className="px-4 py-3 text-xs text-ds-text3 hidden lg:table-cell align-top">
                          {new Date(p.effectiveFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-center align-top">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.isActive ? 'bg-ds-success-bg text-ds-success-text' : 'bg-ds-bg2 text-ds-text3'}`}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <button onClick={() => openEditProfile(p)} className="text-xs text-ds-brand hover:underline">Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Records Tab ──────────────────────────────────────────────────── */}
      {tab === 'records' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <select value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))}
              className="border border-ds-border-strong rounded-lg px-3 py-1.5 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="border border-ds-border-strong rounded-lg px-3 py-1.5 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-ds-border-strong rounded-lg px-3 py-1.5 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="on_hold">On Hold</option>
            </select>
            <button onClick={() => void loadRecords()} className="btn-brand px-3 py-1.5 rounded-lg text-sm">Apply</button>
            <span className="ml-auto text-xs text-ds-text3">{records.length} records</span>
          </div>

          {/* Summary bar */}
          {summary && records.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-ds-surface border border-ds-border rounded-xl p-3 text-center">
                <p className="text-xs text-ds-text3">Total Payroll</p>
                <p className="text-base font-bold text-ds-text1 mt-0.5">{fmt(summary.totalNetSalary)}</p>
              </div>
              <div className="bg-ds-surface border border-green-200 rounded-xl p-3 text-center">
                <p className="text-xs text-ds-text3">Paid</p>
                <p className="text-base font-bold text-green-600 mt-0.5">{fmt(summary.paidAmount)}</p>
              </div>
              <div className="bg-ds-surface border border-yellow-200 rounded-xl p-3 text-center">
                <p className="text-xs text-ds-text3">Outstanding</p>
                <p className="text-base font-bold text-yellow-600 mt-0.5">{fmt(summary.pendingAmount)}</p>
              </div>
            </div>
          )}

          {records.length === 0 ? (
            <div className="bg-ds-surface border border-ds-border rounded-xl p-12 text-center">
              <p className="text-ds-text2 text-sm">No salary records for {MONTHS[filterMonth - 1]} {filterYear}.</p>
              <button onClick={() => setShowGenerateModal(true)} className="mt-3 btn-brand px-4 py-2 rounded-lg text-sm">
                Generate Now
              </button>
            </div>
          ) : (
            <div className="bg-ds-surface border border-ds-border rounded-xl overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-ds-border bg-ds-bg2">
                    <th className="text-left px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[28%]">Staff</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden md:table-cell w-[13%]">Gross</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden md:table-cell w-[13%]">Deductions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[13%]">Net</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider w-[12%]">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ds-text3 uppercase tracking-wider hidden lg:table-cell w-[14%]">Payment</th>
                    <th className="px-4 py-3 w-[7%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-ds-bg2/50">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-ds-text1">{staffLabel(r.user)}</p>
                        <p className="text-xs text-ds-text3">{roleLabel(r.user)}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-ds-text2 hidden md:table-cell align-top">{fmt(r.grossSalary)}</td>
                      <td className="px-4 py-3 text-right text-red-500 hidden md:table-cell align-top">{r.totalDeductions > 0 ? `- ${fmt(r.totalDeductions)}` : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 align-top">{fmt(r.netSalary)}</td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ds-text3 hidden lg:table-cell align-top">
                        {r.paidOn ? (
                          <span>{new Date(r.paidOn).toLocaleDateString('en-IN')} · {r.paymentMode?.replace('_', ' ')}</span>
                        ) : <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button onClick={() => openStatusModal(r)}
                          className="text-xs text-ds-brand hover:underline">
                          {r.status === 'paid' ? 'Revert' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Generate Modal ────────────────────────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-ds-text1 mb-1">Generate Monthly Salaries</h2>
            <p className="text-xs text-ds-text3 mb-4">This creates salary slips for all active staff with salary profiles. Already-generated slips are skipped.</p>
            {error && <p className="text-ds-error-text text-xs mb-3">{error}</p>}
            <div className="flex gap-2 mb-5">
              <select value={genMonth} onChange={(e) => setGenMonth(parseInt(e.target.value))}
                className="flex-1 border border-ds-border-strong rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={genYear} onChange={(e) => setGenYear(parseInt(e.target.value))}
                className="border border-ds-border-strong rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowGenerateModal(false); setError(null); }}
                className="flex-1 border border-ds-border-strong text-ds-text1 py-2.5 rounded-lg text-sm hover:bg-ds-bg2">
                Cancel
              </button>
              <button onClick={generateSalaries} disabled={generating}
                className="btn-brand flex-1 py-2.5 rounded-lg text-sm">
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Structure Modal ───────────────────────────────────────────────── */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-md my-6 p-6">
            <h2 className="text-base font-bold text-ds-text1 mb-4">
              {editingStructure ? 'Edit' : 'New'} Salary Structure
            </h2>
            {error && <p className="text-ds-error-text text-xs mb-3">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Name *</label>
                <input value={structureForm.name} onChange={(e) => setStructureForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Teacher Grade A"
                  className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Description</label>
                <input value={structureForm.description} onChange={(e) => setStructureForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
              </div>

              <p className="text-xs font-semibold text-ds-text1 pt-1">Earnings</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['basicSalary', 'Basic Salary *'],
                  ['houseRentAllowance', 'HRA'],
                  ['medicalAllowance', 'Medical Allowance'],
                  ['transportAllowance', 'Transport Allowance'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">{label}</label>
                    <input type="number" min="0"
                      value={(structureForm as any)[field]}
                      onChange={(e) => setStructureForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                  </div>
                ))}
              </div>
              <ExtraItemsEditor label="Other Allowances"
                items={structureForm.otherAllowances}
                onChange={(items) => setStructureForm((f) => ({ ...f, otherAllowances: items }))} />

              <p className="text-xs font-semibold text-ds-text1 pt-1">Deductions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['providentFund', 'Provident Fund'],
                  ['professionalTax', 'Professional Tax'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">{label}</label>
                    <input type="number" min="0"
                      value={(structureForm as any)[field]}
                      onChange={(e) => setStructureForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                  </div>
                ))}
              </div>
              <ExtraItemsEditor label="Other Deductions"
                items={structureForm.otherDeductions}
                onChange={(items) => setStructureForm((f) => ({ ...f, otherDeductions: items }))} />

              {/* Preview */}
              <div className="bg-ds-bg2 rounded-lg p-3 text-xs mt-1">
                <div className="flex justify-between"><span className="text-ds-text3">Gross</span><span className="font-medium">{fmt(structGross(structureForm))}</span></div>
                <div className="flex justify-between mt-0.5"><span className="text-ds-text3">Deductions</span><span className="font-medium text-red-500">{fmt(structDeductions(structureForm))}</span></div>
                <div className="flex justify-between mt-1 border-t border-ds-border pt-1 font-semibold"><span>Net Salary</span><span className="text-green-600">{fmt(structGross(structureForm) - structDeductions(structureForm))}</span></div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowStructureModal(false); setError(null); }}
                className="flex-1 border border-ds-border-strong text-ds-text1 py-2.5 rounded-lg text-sm hover:bg-ds-bg2">
                Cancel
              </button>
              <button onClick={saveStructure} disabled={structureSaving || !structureForm.name}
                className="btn-brand flex-1 py-2.5 rounded-lg text-sm">
                {structureSaving ? 'Saving...' : editingStructure ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Modal ─────────────────────────────────────────────────── */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-md my-6 p-6">
            <h2 className="text-base font-bold text-ds-text1 mb-4">
              {editingProfile ? 'Edit' : 'Assign'} Salary Profile
            </h2>
            {error && <p className="text-ds-error-text text-xs mb-3">{error}</p>}

            <div className="space-y-3">
              {!editingProfile && (
                <div>
                  <label className="text-xs font-medium text-ds-text2 block mb-1">Staff Member *</label>
                  <select value={profileForm.userId} onChange={(e) => setProfileForm((f) => ({ ...f, userId: e.target.value }))}
                    className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                    <option value="">Select staff...</option>
                    {unassignedStaff.map((u) => (
                      <option key={u.id} value={u.id}>{staffLabel(u)} ({roleLabel(u)})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Apply from Structure (optional)</label>
                <select value={profileForm.structureId}
                  onChange={(e) => { applyStructureToForm(e.target.value); }}
                  className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                  <option value="">Custom / No Template</option>
                  {structures.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <p className="text-xs font-semibold text-ds-text1 pt-1">Earnings (can be customized)</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['basicSalary', 'Basic Salary *'],
                  ['houseRentAllowance', 'HRA'],
                  ['medicalAllowance', 'Medical Allowance'],
                  ['transportAllowance', 'Transport Allowance'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">{label}</label>
                    <input type="number" min="0"
                      value={(profileForm as any)[field]}
                      onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                  </div>
                ))}
              </div>
              <ExtraItemsEditor label="Other Allowances"
                items={profileForm.otherAllowances}
                onChange={(items) => setProfileForm((f) => ({ ...f, otherAllowances: items }))} />

              <p className="text-xs font-semibold text-ds-text1 pt-1">Deductions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['providentFund', 'Provident Fund'],
                  ['professionalTax', 'Professional Tax'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">{label}</label>
                    <input type="number" min="0"
                      value={(profileForm as any)[field]}
                      onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                  </div>
                ))}
              </div>
              <ExtraItemsEditor label="Other Deductions"
                items={profileForm.otherDeductions}
                onChange={(items) => setProfileForm((f) => ({ ...f, otherDeductions: items }))} />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-ds-text2 block mb-1">Effective From *</label>
                  <input type="date" value={profileForm.effectiveFrom}
                    onChange={(e) => setProfileForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                    className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ds-text2 block mb-1">Notes</label>
                  <input value={profileForm.notes} onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                    className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-ds-bg2 rounded-lg p-3 text-xs mt-1">
                <div className="flex justify-between"><span className="text-ds-text3">Gross</span><span className="font-medium">{fmt(formGross)}</span></div>
                <div className="flex justify-between mt-0.5"><span className="text-ds-text3">Deductions</span><span className="font-medium text-red-500">{fmt(formDeductions)}</span></div>
                <div className="flex justify-between mt-1 border-t border-ds-border pt-1 font-semibold"><span>Net Salary</span><span className="text-green-600">{fmt(formNet)}</span></div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowProfileModal(false); setError(null); }}
                className="flex-1 border border-ds-border-strong text-ds-text1 py-2.5 rounded-lg text-sm hover:bg-ds-bg2">
                Cancel
              </button>
              <button onClick={saveProfile} disabled={profileSaving || !profileForm.effectiveFrom || (!editingProfile && !profileForm.userId)}
                className="btn-brand flex-1 py-2.5 rounded-lg text-sm">
                {profileSaving ? 'Saving...' : editingProfile ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Modal ──────────────────────────────────────────────────── */}
      {statusRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-ds-text1 mb-1">Update Payment Status</h2>
            <p className="text-xs text-ds-text3 mb-4">
              {staffLabel(statusRecord.user)} — {MONTHS[statusRecord.month - 1]} {statusRecord.year} — {fmt(statusRecord.netSalary)}
            </p>
            {error && <p className="text-ds-error-text text-xs mb-3">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Status</label>
                <select value={statusForm.status} onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
              {statusForm.status === 'paid' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Paid On</label>
                    <input type="date" value={statusForm.paidOn}
                      onChange={(e) => setStatusForm((f) => ({ ...f, paidOn: e.target.value }))}
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Payment Mode</label>
                    <select value={statusForm.paymentMode} onChange={(e) => setStatusForm((f) => ({ ...f, paymentMode: e.target.value }))}
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand">
                      {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ds-text2 block mb-1">Reference / Cheque No. (optional)</label>
                    <input value={statusForm.paymentReference}
                      onChange={(e) => setStatusForm((f) => ({ ...f, paymentReference: e.target.value }))}
                      placeholder="Transaction ID, Cheque number, etc."
                      className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Remarks (optional)</label>
                <input value={statusForm.remarks} onChange={(e) => setStatusForm((f) => ({ ...f, remarks: e.target.value }))}
                  placeholder="Any additional notes"
                  className="w-full border border-ds-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setStatusRecord(null); setError(null); }}
                className="flex-1 border border-ds-border-strong text-ds-text1 py-2.5 rounded-lg text-sm hover:bg-ds-bg2">
                Cancel
              </button>
              <button onClick={saveStatus} disabled={statusSaving}
                className="btn-brand flex-1 py-2.5 rounded-lg text-sm">
                {statusSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
