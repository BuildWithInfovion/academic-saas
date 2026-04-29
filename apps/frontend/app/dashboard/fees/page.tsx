'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeeCategory { id: string; name: string; type: string; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface AcademicUnit { id: string; name: string; displayName?: string; }

interface FeePlanInstallment { id: string; label: string; amount: number; dueDate?: string | null; sortOrder: number; }
interface FeePlanItem { id: string; feeCategoryId: string; feeCategory: FeeCategory; totalAmount: number; installments: FeePlanInstallment[]; }
interface FeePlanClassMap { id: string; academicUnitId: string; academicUnit: AcademicUnit; }
interface FeePlan { id: string; name: string; description?: string; isActive: boolean; academicYearId: string; academicYear: { id: string; name: string }; items: FeePlanItem[]; classMaps: FeePlanClassMap[]; }

interface LedgerInstallment { id: string; label: string; amount: number; dueDate?: string | null; concession: number; netAmount: number; paid: number; balance: number; status: 'paid' | 'partial' | 'due' | 'overdue'; isOverdue: boolean; }
interface LedgerItem { feePlanItemId: string; feeCategoryId: string; categoryName: string; totalAmount: number; concession: number; netAmount: number; installments: LedgerInstallment[]; totalPaid: number; totalBalance: number; }
interface Ledger { student: { id: string; name: string; admissionNo: string; className: string }; plan: { id: string; name: string } | null; items: LedgerItem[]; totalAnnual: number; totalConcession: number; totalNet: number; totalPaid: number; totalBalance: number; }

interface StudentSearch { id: string; firstName: string; lastName: string; admissionNo: string; academicUnit?: { name: string; displayName?: string }; }
interface Concession { id: string; amount: number; reason: string; createdAt: string; feePlanItem: { id: string; feeCategory: { name: string }; feePlan: { name: string } }; }
interface DailyEntry { id: string; receiptNo: string; amount: number; paymentMode: string; paidOn: string; categoryName: string; student: { firstName: string; lastName: string; admissionNo: string }; source: string; }
interface Defaulter { id: string; firstName: string; lastName: string; admissionNo: string; className?: string; due: number; paid: number; balance: number; }
interface Institution { name: string; board?: string; address?: string; phone?: string; email?: string; logoUrl?: string; principalName?: string; tagline?: string; affiliationNo?: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const MODES = ['cash', 'upi', 'cheque', 'neft', 'dd', 'online'] as const;
const MODE_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', cheque: 'Cheque', neft: 'NEFT', dd: 'Demand Draft', online: 'Online' };
const CATEGORY_TYPES = ['TUITION', 'TRANSPORT', 'EXAM', 'LAB', 'LIBRARY', 'ACTIVITY', 'SPORTS', 'DEVELOPMENT', 'HOSTEL', 'CUSTOM'];
const STANDARD_CATEGORIES = [
  { name: 'Tuition Fee', type: 'TUITION' }, { name: 'Transport Fee', type: 'TRANSPORT' },
  { name: 'Exam Fee', type: 'EXAM' }, { name: 'Lab Fee', type: 'LAB' },
  { name: 'Library Fee', type: 'LIBRARY' }, { name: 'Activity Fee', type: 'ACTIVITY' },
  { name: 'Sports Fee', type: 'SPORTS' }, { name: 'Development Fee', type: 'DEVELOPMENT' },
];

const STATUS_CHIP: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  due: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-700',
};

function esc(s: string | null | undefined) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ── Receipt Printing ──────────────────────────────────────────────────────────

function printReceipt(params: { receiptNo: string; amount: number; paymentMode: string; paidOn: string; categoryName: string; installmentLabel?: string; remarks?: string; studentName: string; admissionNo: string; className: string; institution: Institution }) {
  const { receiptNo, amount, paymentMode, paidOn, categoryName, installmentLabel, remarks, studentName, admissionNo, className, institution } = params;
  const date = new Date(paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><title>Fee Receipt — ${esc(receiptNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#f1f5f9;padding:30px}
  .receipt{max-width:540px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .letterhead{background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:14px}
  .letterhead img{width:52px;height:52px;object-fit:contain;border-radius:4px;background:#fff;padding:3px;flex-shrink:0}
  .letterhead .logo-ph{width:52px;height:52px;border-radius:4px;background:rgba(255,255,255,.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(255,255,255,.5);text-align:center;line-height:1.2}
  .lh-text{flex:1;min-width:0}
  .lh-text h1{font-size:16px;font-weight:700;margin-bottom:2px}
  .lh-text .tagline{font-size:10px;opacity:.6;font-style:italic;margin-bottom:3px}
  .lh-text .sub{font-size:10px;opacity:.55;line-height:1.6}
  .rhead{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
  .rno{font-size:13px;font-weight:700;color:#0f172a} .rdate{font-size:12px;color:#64748b}
  .section{padding:16px 24px}
  .stitle{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border:none}
  .label{color:#64748b;font-size:12px} .value{font-weight:600;font-size:12px;text-align:right;max-width:60%}
  .amt-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:0 24px 20px;display:flex;justify-content:space-between;align-items:center}
  .amt-box .lbl{font-size:12px;color:#166534;font-weight:600} .amt-box .amt{font-size:26px;font-weight:800;color:#15803d}
  .footer{text-align:center;color:#94a3b8;font-size:10px;padding:12px 20px;border-top:1px solid #f1f5f9;line-height:1.6}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0;border:none};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div class="receipt">
  <div class="letterhead">
    ${institution.logoUrl ? `<img src="${esc(institution.logoUrl)}" alt="Logo" />` : `<div class="logo-ph">School<br/>Logo</div>`}
    <div class="lh-text">
      <h1>${esc(institution.name)}</h1>
      ${institution.tagline ? `<div class="tagline">${esc(institution.tagline)}</div>` : ''}
      <div class="sub">${[institution.board, institution.affiliationNo ? `Affil: ${institution.affiliationNo}` : ''].filter(Boolean).join(' · ')}${(institution.board || institution.affiliationNo) ? '<br>' : ''}${institution.address ? `${esc(institution.address)}<br>` : ''}${[institution.phone ? `Ph: ${esc(institution.phone)}` : '', institution.email ? `Email: ${esc(institution.email)}` : ''].filter(Boolean).join(' · ')}</div>
    </div>
  </div>
  <div class="rhead"><span class="rno">Receipt No: ${esc(receiptNo)}</span><span class="rdate">${date}</span></div>
  <div class="section"><div class="stitle">Student Details</div>
    <div class="row"><span class="label">Name</span><span class="value">${esc(studentName)}</span></div>
    <div class="row"><span class="label">Admission No.</span><span class="value">${esc(admissionNo)}</span></div>
    <div class="row"><span class="label">Class</span><span class="value">${esc(className)}</span></div>
  </div>
  <div class="section"><div class="stitle">Payment Details</div>
    <div class="row"><span class="label">Fee Category</span><span class="value">${esc(categoryName)}</span></div>
    ${installmentLabel ? `<div class="row"><span class="label">Installment</span><span class="value">${esc(installmentLabel)}</span></div>` : ''}
    <div class="row"><span class="label">Payment Mode</span><span class="value">${esc(MODE_LABEL[paymentMode] ?? paymentMode)}</span></div>
    ${remarks ? `<div class="row"><span class="label">Remarks</span><span class="value">${esc(remarks)}</span></div>` : ''}
  </div>
  <div class="amt-box"><span class="lbl">Amount Paid</span><span class="amt">${fmt(amount)}</span></div>
  <div class="footer">${institution.principalName ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">Principal: ${esc(institution.principalName)}</div>` : ''}Computer-generated receipt — no signature required<br>${esc(institution.name)}</div>
</div></body></html>`;
  const w = window.open('', '_blank', 'width=620,height=780');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FeesPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'collect' | 'plans' | 'concessions' | 'reports' | 'categories'>('collect');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];

  useEffect(() => {
    void Promise.all([
      apiFetch<AcademicYear[]>('/academic/years').then(setYears),
      apiFetch<{ units: AcademicUnit[] }>('/academic/units').then((r) => setUnits(r.units ?? [])),
      apiFetch<Institution>('/institution/profile').then(setInstitution),
    ]);
  }, []);

  const tabs = [
    { key: 'collect', label: 'Collect Fee' },
    { key: 'plans', label: 'Fee Plans' },
    { key: 'concessions', label: 'Concessions' },
    { key: 'reports', label: 'Reports' },
    { key: 'categories', label: 'Categories' },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
        <p className="text-slate-500 text-sm mt-1">Manage fee plans, collect payments, and track outstanding dues</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'collect' && <CollectTab years={years} institution={institution} />}
      {tab === 'plans' && <PlansTab years={years} units={units} />}
      {tab === 'concessions' && <ConcessionsTab years={years} />}
      {tab === 'reports' && <ReportsTab years={years} units={units} institution={institution} />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}

// ── Collect Tab ───────────────────────────────────────────────────────────────

function CollectTab({ years, institution }: { years: AcademicYear[]; institution: Institution | null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentSearch[]>([]);
  const [selected, setSelected] = useState<StudentSearch | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [payMode, setPayMode] = useState<string>('cash');
  const [payDate, setPayDate] = useState(todayStr());
  const [remarks, setRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { const r = await apiFetch<{ students: StudentSearch[] }>(`/students/search?q=${encodeURIComponent(query)}&limit=8`); setResults(r.students ?? []); }
      catch { setResults([]); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const selectStudent = useCallback(async (s: StudentSearch) => {
    setSelected(s); setResults([]); setQuery(''); setSelectedInstallments(new Set()); setOverrides({});
    if (!currentYear) return;
    setLedgerLoading(true);
    try {
      const l = await apiFetch<Ledger>(`/fees/ledger/student/${s.id}?yearId=${currentYear.id}`);
      setLedger(l);
      // Auto-select all unpaid/partial installments
      const autoSelect = new Set<string>();
      for (const item of l.items) {
        for (const inst of item.installments) {
          if (inst.status !== 'paid') autoSelect.add(inst.id);
        }
      }
      setSelectedInstallments(autoSelect);
    } catch { setLedger(null); } finally { setLedgerLoading(false); }
  }, [currentYear]);

  const toggleInstallment = (id: string) => {
    setSelectedInstallments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getInstallmentAmount = (inst: LedgerInstallment) => {
    const override = overrides[inst.id];
    if (override) return parseFloat(override) || 0;
    return inst.balance;
  };

  const selectedTotal = ledger
    ? ledger.items.flatMap((i) => i.installments).filter((inst) => selectedInstallments.has(inst.id)).reduce((s, inst) => s + getInstallmentAmount(inst), 0)
    : 0;

  const handleCollect = async () => {
    if (!selected || !ledger?.plan || selectedInstallments.size === 0 || !currentYear) return;
    setCollecting(true);
    try {
      const items = ledger.items.flatMap((item) =>
        item.installments
          .filter((inst) => selectedInstallments.has(inst.id))
          .map((inst) => ({
            feePlanInstallmentId: inst.id,
            feePlanItemId: item.feePlanItemId,
            feeCategoryId: item.feeCategoryId,
            amount: getInstallmentAmount(inst),
          }))
      );
      const res = await apiFetch<{ collections: { receiptNo: string; amount: number; paidOn: string; feePlanInstallment?: { label: string }; feeCategory: { name: string } }[]; totalCollected: number }>('/fees/collections', {
        method: 'POST',
        body: JSON.stringify({ studentId: selected.id, academicYearId: currentYear.id, items, paymentMode: payMode, paidOn: payDate, remarks: remarks || undefined }),
      });
      showToast(`Collected ${fmt(res.totalCollected)} — ${res.collections.length} receipt(s) generated`);
      // Print receipts
      if (institution) {
        for (const c of res.collections) {
          printReceipt({ receiptNo: c.receiptNo, amount: c.amount, paymentMode: payMode, paidOn: c.paidOn, categoryName: c.feeCategory.name, installmentLabel: c.feePlanInstallment?.label, remarks, studentName: ledger.student.name, admissionNo: ledger.student.admissionNo, className: ledger.student.className, institution });
        }
      }
      // Refresh ledger
      const l = await apiFetch<Ledger>(`/fees/ledger/student/${selected.id}?yearId=${currentYear.id}`);
      setLedger(l); setSelectedInstallments(new Set()); setOverrides({}); setRemarks('');
    } catch (e: any) { showToast(e.message ?? 'Collection failed'); } finally { setCollecting(false); }
  };

  const className = (unit?: { name: string; displayName?: string }) => unit?.displayName || unit?.name || '—';

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      {/* Student Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Search Student</h2>
        <div className="relative max-w-lg">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type name or admission number…"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {loading && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
          {results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
              {results.map((s) => (
                <button key={s.id} onClick={() => void selectStudent(s)} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">{s.firstName[0]}{s.lastName[0]}</div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{s.firstName} {s.lastName}</div>
                    <div className="text-xs text-slate-500">{s.admissionNo} · {className(s.academicUnit)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Student + Ledger */}
      {ledgerLoading && <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading fee ledger…</div>}

      {!ledgerLoading && selected && ledger && (
        <div className="space-y-4">
          {/* Student Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg shrink-0">{ledger.student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-lg">{ledger.student.name}</div>
              <div className="text-sm text-slate-500">{ledger.student.admissionNo} · {ledger.student.className}</div>
              {ledger.plan && <div className="text-xs text-indigo-600 mt-0.5">Plan: {ledger.plan.name}</div>}
            </div>
            <div className="text-right shrink-0">
              {ledger.totalBalance > 0
                ? <div><div className="text-2xl font-bold text-red-600">{fmt(ledger.totalBalance)}</div><div className="text-xs text-slate-500">outstanding</div></div>
                : <div><div className="text-2xl font-bold text-green-600">Cleared</div><div className="text-xs text-slate-500">no dues</div></div>}
            </div>
          </div>

          {/* No Plan */}
          {!ledger.plan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <div className="text-amber-700 font-medium">No fee plan assigned to this student's class</div>
              <div className="text-amber-600 text-sm mt-1">Go to the <strong>Fee Plans</strong> tab to create a plan and assign it to {ledger.student.className}.</div>
            </div>
          )}

          {/* Fee Ledger Table */}
          {ledger.plan && ledger.items.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Fee Ledger</h3>
                <div className="flex gap-2 text-xs text-slate-500">
                  <span className="bg-slate-100 px-2 py-1 rounded">Annual: {fmt(ledger.totalAnnual)}</span>
                  {ledger.totalConcession > 0 && <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Concession: {fmt(ledger.totalConcession)}</span>}
                  <span className="bg-slate-100 px-2 py-1 rounded">Net: {fmt(ledger.totalNet)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5 w-8"></th>
                      <th className="text-left px-4 py-2.5">Category</th>
                      <th className="text-left px-4 py-2.5">Installment</th>
                      <th className="text-left px-4 py-2.5">Due Date</th>
                      <th className="text-right px-4 py-2.5">Net Due</th>
                      <th className="text-right px-4 py-2.5">Paid</th>
                      <th className="text-right px-4 py-2.5">Balance</th>
                      <th className="text-center px-4 py-2.5">Status</th>
                      <th className="text-right px-4 py-2.5">Collect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledger.items.map((item) =>
                      item.installments.map((inst, idx) => {
                        const checked = selectedInstallments.has(inst.id);
                        return (
                          <tr key={inst.id} className={`hover:bg-slate-50 ${inst.isOverdue && inst.status !== 'paid' ? 'bg-red-50/40' : ''}`}>
                            <td className="px-4 py-2.5">
                              {inst.status !== 'paid' && (
                                <input type="checkbox" checked={checked} onChange={() => toggleInstallment(inst.id)} className="rounded border-slate-300 text-indigo-600" />
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{idx === 0 ? item.categoryName : ''}</td>
                            <td className="px-4 py-2.5 text-slate-600">{inst.label}</td>
                            <td className="px-4 py-2.5 text-slate-500">{inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-700">{fmt(inst.netAmount)}</td>
                            <td className="px-4 py-2.5 text-right text-green-700">{inst.paid > 0 ? fmt(inst.paid) : '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(inst.balance)}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CHIP[inst.status]}`}>{inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {inst.status !== 'paid' && checked && (
                                <input
                                  type="number"
                                  value={overrides[inst.id] ?? inst.balance}
                                  onChange={(e) => setOverrides((p) => ({ ...p, [inst.id]: e.target.value }))}
                                  className="w-24 border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                  min={1}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Collection Bar */}
              {selectedInstallments.size > 0 && (
                <div className="px-5 py-4 bg-indigo-50 border-t border-indigo-100 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-indigo-700 font-medium">{selectedInstallments.size} installment(s) selected · Total: <span className="font-bold text-lg">{fmt(selectedTotal)}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {MODES.map((m) => (
                      <button key={m} onClick={() => setPayMode(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${payMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'}`}>{MODE_LABEL[m]}</button>
                    ))}
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (optional)" className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    <button onClick={() => void handleCollect()} disabled={collecting || selectedTotal <= 0} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      {collecting ? 'Processing…' : `Collect ${fmt(selectedTotal)}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Plans Tab ─────────────────────────────────────────────────────────────────

function PlansTab({ years, units }: { years: AcademicYear[]; units: AcademicUnit[] }) {
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const [selYear, setSelYear] = useState<string>('');
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FeePlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<{ planId: string; itemId?: string } | null>(null);
  const [editItemCat, setEditItemCat] = useState('');
  const [editItemAmt, setEditItemAmt] = useState('');
  const [addingInst, setAddingInst] = useState<{ itemId: string } | null>(null);
  const [instLabel, setInstLabel] = useState('');
  const [instAmt, setInstAmt] = useState('');
  const [instDate, setInstDate] = useState('');
  const [assigningPlan, setAssigningPlan] = useState<string | null>(null);
  const [assignedUnits, setAssignedUnits] = useState<Set<string>>(new Set());
  const [copyingPlan, setCopyingPlan] = useState<FeePlan | null>(null);
  const [copyTargetYear, setCopyTargetYear] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const yearId = selYear || currentYear?.id || '';

  useEffect(() => { if (currentYear) setSelYear(currentYear.id); }, [currentYear]);

  const loadPlans = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try { const p = await apiFetch<FeePlan[]>(`/fees/plans?yearId=${yearId}`); setPlans(p); }
    catch { } finally { setLoading(false); }
  }, [yearId]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);
  useEffect(() => { void apiFetch<FeeCategory[]>('/fees/categories').then(setCategories); }, []);

  const createPlan = async () => {
    if (!newPlanName.trim() || !yearId) return;
    try {
      await apiFetch('/fees/plans', { method: 'POST', body: JSON.stringify({ name: newPlanName.trim(), academicYearId: yearId }) });
      setNewPlanName(''); setCreating(false); await loadPlans();
    } catch (e: any) { showToast(e.message); }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Delete this fee plan?')) return;
    await apiFetch(`/fees/plans/${planId}`, { method: 'DELETE' }); await loadPlans();
    if (selectedPlan?.id === planId) setSelectedPlan(null);
  };

  const addItem = async () => {
    if (!selectedPlan || !editItemCat || !editItemAmt) return;
    try {
      await apiFetch(`/fees/plans/${selectedPlan.id}/items`, { method: 'POST', body: JSON.stringify({ feeCategoryId: editItemCat, totalAmount: parseFloat(editItemAmt) }) });
      setEditingItem(null); setEditItemCat(''); setEditItemAmt('');
      const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p); await loadPlans();
    } catch (e: any) { showToast(e.message); }
  };

  const deleteItem = async (itemId: string) => {
    if (!selectedPlan || !confirm('Remove this fee item?')) return;
    try { await apiFetch(`/fees/plans/${selectedPlan.id}/items/${itemId}`, { method: 'DELETE' }); const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p); await loadPlans(); }
    catch (e: any) { showToast(e.message); }
  };

  const addInst = async () => {
    if (!selectedPlan || !addingInst || !instLabel || !instAmt) return;
    try {
      await apiFetch(`/fees/plans/${selectedPlan.id}/items/${addingInst.itemId}/installments`, { method: 'POST', body: JSON.stringify({ label: instLabel, amount: parseFloat(instAmt), dueDate: instDate || undefined }) });
      setAddingInst(null); setInstLabel(''); setInstAmt(''); setInstDate('');
      const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p);
    } catch (e: any) { showToast(e.message); }
  };

  const deleteInst = async (itemId: string, instId: string) => {
    if (!selectedPlan || !confirm('Delete this installment?')) return;
    try { await apiFetch(`/fees/plans/${selectedPlan.id}/items/${itemId}/installments/${instId}`, { method: 'DELETE' }); const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p); }
    catch (e: any) { showToast(e.message); }
  };

  const openAssign = (plan: FeePlan) => {
    setAssigningPlan(plan.id);
    setAssignedUnits(new Set(plan.classMaps.map((c) => c.academicUnitId)));
  };

  const saveAssign = async () => {
    if (!assigningPlan) return;
    try {
      await apiFetch(`/fees/plans/${assigningPlan}/classes`, { method: 'POST', body: JSON.stringify({ academicUnitIds: [...assignedUnits] }) });
      setAssigningPlan(null); await loadPlans();
      if (selectedPlan?.id === assigningPlan) { const p = await apiFetch<FeePlan>(`/fees/plans/${assigningPlan}`); setSelectedPlan(p); }
    } catch (e: any) { showToast(e.message); }
  };

  const handleCopy = async () => {
    if (!copyingPlan || !copyTargetYear) return;
    try {
      await apiFetch(`/fees/plans/${copyingPlan.id}/copy`, { method: 'POST', body: JSON.stringify({ targetAcademicYearId: copyTargetYear }) });
      showToast('Plan copied!'); setCopyingPlan(null); setCopyTargetYear(''); await loadPlans();
    } catch (e: any) { showToast(e.message); }
  };

  const unitName = (u: AcademicUnit) => u.displayName || u.name;
  const totalFee = (plan: FeePlan) => plan.items.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      {/* Assign Classes Modal */}
      {assigningPlan && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 mb-4">Assign Classes to Plan</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {units.map((u) => (
                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={assignedUnits.has(u.id)} onChange={() => setAssignedUnits((p) => { const n = new Set(p); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })} className="rounded border-slate-300 text-indigo-600" />
                  <span className="text-sm text-slate-800">{unitName(u)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAssigningPlan(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => void saveAssign()} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Plan Modal */}
      {copyingPlan && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">Copy Plan to Another Year</h3>
            <p className="text-sm text-slate-500 mb-4">Copying: <strong>{copyingPlan.name}</strong></p>
            <select value={copyTargetYear} onChange={(e) => setCopyTargetYear(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-5">
              <option value="">Select target year…</option>
              {years.filter((y) => y.id !== copyingPlan.academicYearId).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => { setCopyingPlan(null); setCopyTargetYear(''); }} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => void handleCopy()} disabled={!copyTargetYear} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Copy</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold text-slate-800 text-lg flex-1">Fee Plans</h2>
        <select value={selYear} onChange={(e) => setSelYear(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
        </select>
        <button onClick={() => setCreating(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ New Plan</button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Plan Name</label>
            <input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createPlan()} placeholder="e.g. Regular Students Plan" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
          </div>
          <button onClick={() => void createPlan()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Create</button>
          <button onClick={() => { setCreating(false); setNewPlanName(''); }} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
        </div>
      )}

      {loading && <div className="text-center py-10 text-slate-400 text-sm">Loading plans…</div>}

      {!loading && plans.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="text-slate-400 text-sm">No fee plans for this academic year.</div>
          <div className="text-slate-400 text-xs mt-1">Create one to start collecting fees using the plan-based system.</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all ${selectedPlan?.id === plan.id ? 'border-indigo-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`} onClick={() => setSelectedPlan(plan)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-slate-900">{plan.name}</div>
                {plan.description && <div className="text-xs text-slate-500 mt-0.5">{plan.description}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setCopyingPlan(plan); setCopyTargetYear(''); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Copy to another year">⧉</button>
                <button onClick={(e) => { e.stopPropagation(); void deletePlan(plan.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">✕</button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Fee items</span><span className="font-medium">{plan.items.length}</span></div>
              <div className="flex justify-between text-slate-600"><span>Annual total</span><span className="font-medium text-slate-900">{fmt(totalFee(plan))}</span></div>
              <div className="flex justify-between text-slate-600"><span>Classes</span><span className="font-medium">{plan.classMaps.length > 0 ? plan.classMaps.map((c) => unitName(c.academicUnit)).join(', ') : <span className="text-amber-600">None assigned</span>}</span></div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); openAssign(plan); }} className="mt-3 w-full px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">Assign Classes</button>
          </div>
        ))}
      </div>

      {/* Plan Editor */}
      {selectedPlan && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Editing: {selectedPlan.name}</h3>
            <div className="text-sm text-slate-500">Annual total: <span className="font-semibold text-slate-900">{fmt(totalFee(selectedPlan))}</span></div>
          </div>
          <div className="divide-y divide-slate-100">
            {selectedPlan.items.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium text-slate-900">{item.feeCategory.name}</span>
                    <span className="text-xs text-slate-500 ml-2">({item.feeCategory.type})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{fmt(item.totalAmount)}</span>
                    <button onClick={() => void deleteItem(item.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                </div>
                {/* Installments */}
                <div className="space-y-1.5 ml-4">
                  {item.installments.map((inst) => (
                    <div key={inst.id} className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                      <span className="text-slate-700 flex-1">{inst.label}</span>
                      <span className="text-slate-500">{inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No due date'}</span>
                      <span className="font-medium text-slate-800">{fmt(inst.amount)}</span>
                      <button onClick={() => void deleteInst(item.id, inst.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                  {addingInst?.itemId === item.id ? (
                    <div className="flex gap-2 ml-5 flex-wrap">
                      <input value={instLabel} onChange={(e) => setInstLabel(e.target.value)} placeholder="Label (e.g. Term 1)" className="border border-slate-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <input type="number" value={instAmt} onChange={(e) => setInstAmt(e.target.value)} placeholder="Amount" className="border border-slate-300 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <input type="date" value={instDate} onChange={(e) => setInstDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <button onClick={() => void addInst()} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">Add</button>
                      <button onClick={() => setAddingInst(null)} className="px-2 py-1 border border-slate-300 text-xs rounded hover:bg-slate-50">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingInst({ itemId: item.id }); setInstLabel(''); setInstAmt(''); setInstDate(''); }} className="ml-5 text-xs text-indigo-600 hover:text-indigo-800">+ Add installment</button>
                  )}
                </div>
              </div>
            ))}

            {/* Add Item Row */}
            <div className="p-5">
              {editingItem?.planId === selectedPlan.id ? (
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Fee Category</label>
                    <select value={editItemCat} onChange={(e) => setEditItemCat(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select category…</option>
                      {categories.filter((c) => !selectedPlan.items.find((i) => i.feeCategoryId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Annual Amount (₹)</label>
                    <input type="number" value={editItemAmt} onChange={(e) => setEditItemAmt(e.target.value)} placeholder="e.g. 12000" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <button onClick={() => void addItem()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Add</button>
                  <button onClick={() => setEditingItem(null)} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setEditingItem({ planId: selectedPlan.id }); setEditItemCat(''); setEditItemAmt(''); }} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add Fee Item</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Concessions Tab ───────────────────────────────────────────────────────────

function ConcessionsTab({ years }: { years: AcademicYear[] }) {
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentSearch[]>([]);
  const [selected, setSelected] = useState<StudentSearch | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [concessions, setConcessions] = useState<Concession[]>([]);
  const [loading, setLoading] = useState(false);
  const [addItem, setAddItem] = useState<LedgerItem | null>(null);
  const [conAmount, setConAmount] = useState('');
  const [conReason, setConReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try { const r = await apiFetch<{ students: StudentSearch[] }>(`/students/search?q=${encodeURIComponent(query)}&limit=8`); setResults(r.students ?? []); } catch { }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const selectStudent = async (s: StudentSearch) => {
    setSelected(s); setResults([]); setQuery(''); setAddItem(null);
    if (!currentYear) return;
    setLoading(true);
    try {
      const [l, c] = await Promise.all([
        apiFetch<Ledger>(`/fees/ledger/student/${s.id}?yearId=${currentYear.id}`),
        apiFetch<Concession[]>(`/fees/concessions/student/${s.id}`),
      ]);
      setLedger(l); setConcessions(c);
    } catch { } finally { setLoading(false); }
  };

  const handleAddConcession = async () => {
    if (!selected || !addItem || !conAmount || !conReason) return;
    setSaving(true);
    try {
      await apiFetch('/fees/concessions', { method: 'POST', body: JSON.stringify({ studentId: selected.id, feePlanItemId: addItem.feePlanItemId, amount: parseFloat(conAmount), reason: conReason }) });
      showToast('Concession added');
      setAddItem(null); setConAmount(''); setConReason('');
      const c = await apiFetch<Concession[]>(`/fees/concessions/student/${selected.id}`); setConcessions(c);
    } catch (e: any) { showToast(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this concession?')) return;
    await apiFetch(`/fees/concessions/${id}`, { method: 'DELETE' });
    const c = await apiFetch<Concession[]>(`/fees/concessions/student/${selected!.id}`); setConcessions(c);
  };

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Search Student</h2>
        <div className="relative max-w-lg">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type name or admission number…" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
              {results.map((s) => (
                <button key={s.id} onClick={() => void selectStudent(s)} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">{s.firstName[0]}{s.lastName[0]}</div>
                  <div><div className="text-sm font-medium text-slate-900">{s.firstName} {s.lastName}</div><div className="text-xs text-slate-500">{s.admissionNo}</div></div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>}

      {selected && !loading && ledger && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Add Concession Panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Add Concession for {ledger.student.name}</h3>
            {!ledger.plan && <p className="text-sm text-amber-600">No fee plan assigned to this student's class.</p>}
            {ledger.plan && ledger.items.length > 0 && (
              <div className="space-y-3">
                {ledger.items.map((item) => (
                  <div key={item.feePlanItemId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{item.categoryName}</div>
                      <div className="text-xs text-slate-500">Annual: {fmt(item.totalAmount)} · Current concession: {fmt(item.concession)}</div>
                    </div>
                    <button onClick={() => { setAddItem(item); setConAmount(''); setConReason(''); }} className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50">Add</button>
                  </div>
                ))}
                {addItem && (
                  <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
                    <div className="text-sm font-semibold text-indigo-800">Adding concession for: {addItem.categoryName}</div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Amount (₹)</label>
                        <input type="number" value={conAmount} onChange={(e) => setConAmount(e.target.value)} placeholder="e.g. 500" max={addItem.totalAmount} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Reason</label>
                      <input value={conReason} onChange={(e) => setConReason(e.target.value)} placeholder="e.g. Scholarship, EWS, Sibling discount" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => void handleAddConcession()} disabled={saving || !conAmount || !conReason} className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">Save Concession</button>
                      <button onClick={() => setAddItem(null)} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Existing Concessions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Existing Concessions</h3>
            {concessions.length === 0 && <div className="text-sm text-slate-400 py-6 text-center">No concessions for this student</div>}
            <div className="space-y-2">
              {concessions.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{c.feePlanItem.feeCategory.name}</div>
                    <div className="text-xs text-slate-500">{c.feePlanItem.feePlan.name} · {c.reason}</div>
                  </div>
                  <div className="font-bold text-green-700 shrink-0">{fmt(c.amount)}</div>
                  <button onClick={() => void handleDelete(c.id)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab({ years, units, institution }: { years: AcademicYear[]; units: AcademicUnit[]; institution: Institution | null }) {
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const [reportTab, setReportTab] = useState<'daily' | 'defaulters' | 'trend'>('daily');
  const [selYear, setSelYear] = useState<string>('');
  const [selUnit, setSelUnit] = useState<string>('');
  const [date, setDate] = useState(todayStr());
  const [dailyData, setDailyData] = useState<{ payments: DailyEntry[]; total: number } | null>(null);
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [trend, setTrend] = useState<{ month: string; label: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (currentYear) setSelYear(currentYear.id); }, [currentYear]);

  useEffect(() => {
    if (reportTab === 'daily') { void loadDaily(); }
    else if (reportTab === 'defaulters') { void loadDefaulters(); }
    else { void loadTrend(); }
  }, [reportTab, date, selYear, selUnit]);

  const loadDaily = async () => {
    setLoading(true);
    try { setDailyData(await apiFetch(`/fees/payments/daily?date=${date}`)); } catch { } finally { setLoading(false); }
  };

  const loadDefaulters = async () => {
    if (!selYear) return;
    setLoading(true);
    try {
      const d = await apiFetch<Defaulter[]>(`/fees/v2/defaulters?yearId=${selYear}${selUnit ? `&unitId=${selUnit}` : ''}`);
      setDefaulters(d);
    } catch { setDefaulters([]); } finally { setLoading(false); }
  };

  const loadTrend = async () => {
    setLoading(true);
    try { setTrend(await apiFetch('/fees/payments/monthly-trend?months=6')); } catch { } finally { setLoading(false); }
  };

  const exportCSV = () => {
    const rows = [['Student Name', 'Admission No', 'Class', 'Total Due', 'Paid', 'Outstanding'].join(','), ...defaulters.map((d) => [`"${d.firstName} ${d.lastName}"`, d.admissionNo, `"${d.className ?? ''}"`, d.due.toFixed(2), d.paid.toFixed(2), d.balance.toFixed(2)].join(','))];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `defaulters_${selYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const unitName = (u: AcademicUnit) => u.displayName || u.name;
  const modeLabel = (m: string) => MODE_LABEL[m] ?? m;
  const maxTrend = Math.max(...trend.map((t) => t.amount), 1);

  const subTabs = [
    { key: 'daily', label: 'Daily Collection' },
    { key: 'defaulters', label: 'Defaulters' },
    { key: 'trend', label: 'Monthly Trend' },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {subTabs.map((t) => (
          <button key={t.key} onClick={() => setReportTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${reportTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{t.label}</button>
        ))}
      </div>

      {reportTab === 'daily' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-4">
            <h3 className="font-semibold text-slate-800 flex-1">Daily Collection</h3>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => void loadDaily()} className="px-3 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50">Refresh</button>
          </div>
          {loading ? <div className="py-10 text-center text-slate-400 text-sm">Loading…</div> : dailyData && (
            <>
              <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">{dailyData.payments.length} transaction(s)</span>
                <span className="text-xl font-bold text-green-800">{fmt(dailyData.total)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-xs text-slate-500 uppercase">{['Receipt No', 'Student', 'Category', 'Mode', 'Amount'].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyData.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-indigo-600">{p.receiptNo}</td>
                        <td className="px-4 py-2.5"><div className="font-medium text-slate-800">{p.student.firstName} {p.student.lastName}</div><div className="text-xs text-slate-500">{p.student.admissionNo}</div></td>
                        <td className="px-4 py-2.5 text-slate-600">{p.categoryName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{modeLabel(p.paymentMode)}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{fmt(p.amount)}</td>
                      </tr>
                    ))}
                    {dailyData.payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No collections on this date</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {reportTab === 'defaulters' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-slate-800 flex-1">Defaulters Report</h3>
            <select value={selYear} onChange={(e) => setSelYear(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
            </select>
            <select value={selUnit} onChange={(e) => setSelUnit(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Classes</option>
              {units.map((u) => <option key={u.id} value={u.id}>{unitName(u)}</option>)}
            </select>
            {defaulters.length > 0 && <button onClick={exportCSV} className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">Export CSV</button>}
          </div>
          {loading ? <div className="py-10 text-center text-slate-400 text-sm">Loading…</div> : (
            <>
              {defaulters.length > 0 && (
                <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                  <span className="text-sm text-red-700 font-medium">{defaulters.length} student(s) with outstanding dues</span>
                  <span className="text-xl font-bold text-red-700">{fmt(defaulters.reduce((s, d) => s + d.balance, 0))}</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-xs text-slate-500 uppercase">{['Student', 'Class', 'Total Due', 'Paid', 'Outstanding'].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {defaulters.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5"><div className="font-medium text-slate-800">{d.firstName} {d.lastName}</div><div className="text-xs text-slate-500">{d.admissionNo}</div></td>
                        <td className="px-4 py-2.5 text-slate-600">{d.className ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-700">{fmt(d.due)}</td>
                        <td className="px-4 py-2.5 text-green-700">{fmt(d.paid)}</td>
                        <td className="px-4 py-2.5 font-bold text-red-600">{fmt(d.balance)}</td>
                      </tr>
                    ))}
                    {defaulters.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No defaulters — all dues are cleared!</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {reportTab === 'trend' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-5">Monthly Collection Trend (Last 6 Months)</h3>
          {loading ? <div className="text-center py-8 text-slate-400 text-sm">Loading…</div> : (
            <div className="space-y-3">
              {trend.map((t) => (
                <div key={t.month} className="flex items-center gap-4">
                  <div className="text-sm text-slate-600 w-14 shrink-0">{t.label}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(t.amount / maxTrend) * 100}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 w-28 text-right">{fmt(t.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Categories Tab ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('CUSTOM');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => apiFetch<FeeCategory[]>('/fees/categories').then(setCategories);
  useEffect(() => { void load(); }, []);

  const addStandard = async (name: string, type: string) => {
    try { await apiFetch('/fees/categories', { method: 'POST', body: JSON.stringify({ name, type }) }); await load(); }
    catch (e: any) { if (!e.message?.includes('already exists')) showToast(e.message); }
  };

  const addCustom = async () => {
    if (!newName.trim()) return;
    try { await apiFetch('/fees/categories', { method: 'POST', body: JSON.stringify({ name: newName.trim(), type: newType }) }); setNewName(''); setAdding(false); await load(); }
    catch (e: any) { showToast(e.message); }
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try { await apiFetch(`/fees/categories/${id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { showToast(e.message); }
  };

  const TYPE_COLORS: Record<string, string> = { TUITION: 'bg-blue-100 text-blue-800', TRANSPORT: 'bg-orange-100 text-orange-800', EXAM: 'bg-purple-100 text-purple-800', LAB: 'bg-teal-100 text-teal-800', LIBRARY: 'bg-emerald-100 text-emerald-800', ACTIVITY: 'bg-pink-100 text-pink-800', SPORTS: 'bg-yellow-100 text-yellow-800', DEVELOPMENT: 'bg-indigo-100 text-indigo-800', HOSTEL: 'bg-cyan-100 text-cyan-800', CUSTOM: 'bg-slate-100 text-slate-700' };

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick-Add Standard */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Quick-Add Standard Categories</h3>
          <div className="grid grid-cols-2 gap-2">
            {STANDARD_CATEGORIES.map((s) => {
              const exists = categories.some((c) => c.name === s.name);
              return (
                <button key={s.name} onClick={() => void addStandard(s.name, s.type)} disabled={exists} className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${exists ? 'bg-green-50 border-green-200 text-green-700 cursor-default' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700'}`}>
                  {exists ? '✓ ' : '+ '}{s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Custom */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Add Custom Category</h3>
          {adding ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCustom()} placeholder="Category name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {CATEGORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void addCustom()} className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Add</button>
                <button onClick={() => { setAdding(false); setNewName(''); }} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">+ Add Custom Category</button>
          )}
        </div>
      </div>

      {/* Category List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">All Categories ({categories.length})</h3>
        </div>
        {categories.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No categories yet. Add standard categories above.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[c.type] ?? TYPE_COLORS['CUSTOM']}`}>{c.type}</span>
                <span className="flex-1 text-sm text-slate-800 font-medium">{c.name}</span>
                <button onClick={() => void deleteCat(c.id)} className="text-slate-400 hover:text-red-500 text-sm px-2 py-1 rounded hover:bg-red-50">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
