'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { usePortalAuthStore } from '@/store/portal-auth.store';

type Institution = { name: string; board?: string; address?: string; phone?: string; email?: string; website?: string; logoUrl?: string; principalName?: string; tagline?: string; affiliationNo?: string; udiseCode?: string; gstin?: string; stampUrl?: string; signatureUrl?: string; bankName?: string; bankAccountNo?: string; bankIfsc?: string; bankBranch?: string; bankAccountHolder?: string; };

type StudentHit = {
  id: string; firstName: string; lastName: string; admissionNo: string;
  academicUnit?: { displayName?: string; name?: string };
};

type LedgerInstallment = {
  id: string; label: string; amount: number; dueDate?: string | null;
  concession: number; netAmount: number; paid: number; balance: number;
  status: 'paid' | 'partial' | 'due' | 'overdue';
};

type LedgerItem = {
  feePlanItemId: string; feeCategoryId: string; categoryName: string;
  totalAmount: number; concession: number; netAmount: number;
  installments: LedgerInstallment[]; totalPaid: number; totalBalance: number;
};

type Ledger = {
  student: { id: string; name: string; admissionNo: string; className: string };
  plan: { id: string; name: string } | null;
  items: LedgerItem[];
  totalAnnual: number; totalConcession: number; totalNet: number;
  totalPaid: number; totalBalance: number;
};

type CollectionEntry = {
  id: string; receiptNo: string; amount: number; paymentMode: string;
  paidOn: string; categoryName: string; installmentLabel?: string | null;
  remarks?: string | null; source: 'legacy' | 'v2';
};

type AcademicYear = { id: string; name: string; isCurrent: boolean };

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

const MODES = ['cash', 'upi', 'cheque', 'neft', 'dd', 'online'] as const;
const MODE_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', cheque: 'Cheque', neft: 'NEFT', dd: 'Demand Draft', online: 'Online' };

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  paid:    { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  partial: { bg: '#fef9c3', color: '#854d0e', label: 'Partial' },
  due:     { bg: '#dbeafe', color: '#1d4ed8', label: 'Due' },
  overdue: { bg: '#fee2e2', color: '#dc2626', label: 'Overdue' },
};

function printReceipt(params: {
  collections: { receiptNo: string; amount: number; paymentMode: string; categoryName: string; installmentLabel?: string }[];
  student: { name: string; admissionNo: string; className: string };
  paidOn: string; remarks?: string; institution: Institution;
}) {
  const { collections, student, paidOn, remarks, institution: i } = params;
  const date = new Date(paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const total = collections.reduce((s, c) => s + c.amount, 0);
  const receiptNo = collections[0]?.receiptNo ?? '';
  const payMode = MODE_LABEL[collections[0]?.paymentMode ?? ''] ?? collections[0]?.paymentMode?.toUpperCase() ?? '';
  const itemRows = collections.map((c) =>
    `<div class="row"><span class="label">${esc(c.categoryName)}${c.installmentLabel ? ` · ${esc(c.installmentLabel)}` : ''}</span><span class="value">${fmt(c.amount)}</span></div>`
  ).join('');
  const subLine = [i.board, i.affiliationNo ? `Affil: ${i.affiliationNo}` : '', i.udiseCode ? `UDISE: ${i.udiseCode}` : ''].filter(Boolean).join(' · ');
  const contactLine = [i.address, i.phone ? `Ph: ${i.phone}` : '', i.email ? `Email: ${i.email}` : '', i.website ? i.website : ''].filter(Boolean).join('  ·  ');
  const hasBankInfo = i.bankName || i.bankAccountNo;
  const html = `<!DOCTYPE html><html><head><title>Fee Receipt — ${esc(receiptNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#f1f5f9;padding:30px}
  .receipt{max-width:560px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .letterhead{background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:14px}
  .letterhead img.logo{width:52px;height:52px;object-fit:contain;border-radius:4px;background:#fff;padding:3px;flex-shrink:0}
  .letterhead .logo-ph{width:52px;height:52px;border-radius:4px;background:rgba(255,255,255,.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(255,255,255,.5);text-align:center;line-height:1.2}
  .lh-text{flex:1;min-width:0}
  .lh-text h1{font-size:16px;font-weight:700;margin-bottom:2px}
  .lh-text .tagline{font-size:10px;opacity:.6;font-style:italic;margin-bottom:3px}
  .lh-text .sub{font-size:10px;opacity:.55;line-height:1.6}
  .stamp{width:56px;height:56px;object-fit:contain;opacity:.75;flex-shrink:0}
  .rhead{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
  .rno{font-size:13px;font-weight:700;color:#0f172a} .rdate{font-size:12px;color:#64748b}
  .section{padding:16px 24px}
  .stitle{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border:none}
  .label{color:#64748b;font-size:12px} .value{font-weight:600;font-size:12px;text-align:right;max-width:60%}
  .amt-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:0 24px 20px;display:flex;justify-content:space-between;align-items:center}
  .amt-box .lbl{font-size:12px;color:#166534;font-weight:600} .amt-box .amt{font-size:26px;font-weight:800;color:#15803d}
  .bank-box{margin:0 24px 18px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10.5px;color:#475569;line-height:1.8}
  .bank-box strong{color:#1e293b}
  .sig-row{display:flex;justify-content:flex-end;padding:0 24px 16px;gap:16px;align-items:flex-end}
  .sig-row img{max-height:40px;max-width:120px;object-fit:contain}
  .sig-label{font-size:10px;color:#94a3b8;text-align:center;margin-top:3px;border-top:1px solid #e2e8f0;padding-top:3px}
  .footer{text-align:center;color:#94a3b8;font-size:10px;padding:12px 20px;border-top:1px solid #f1f5f9;line-height:1.6}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0;border:none};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div class="receipt">
  <div class="letterhead">
    ${i.logoUrl ? `<img class="logo" src="${esc(i.logoUrl)}" alt="Logo" />` : `<div class="logo-ph">School<br/>Logo</div>`}
    <div class="lh-text">
      <h1>${esc(i.name)}</h1>
      ${i.tagline ? `<div class="tagline">${esc(i.tagline)}</div>` : ''}
      <div class="sub">${subLine ? `${subLine}<br>` : ''}${contactLine}</div>
    </div>
    ${i.stampUrl ? `<img class="stamp" src="${esc(i.stampUrl)}" alt="Stamp" />` : ''}
  </div>
  <div class="rhead"><span class="rno">Receipt No: ${esc(receiptNo)}</span><span class="rdate">${date}</span></div>
  <div class="section"><div class="stitle">Student Details</div>
    <div class="row"><span class="label">Name</span><span class="value">${esc(student.name)}</span></div>
    <div class="row"><span class="label">Admission No.</span><span class="value">${esc(student.admissionNo)}</span></div>
    <div class="row"><span class="label">Class</span><span class="value">${esc(student.className)}</span></div>
  </div>
  <div class="section"><div class="stitle">Fee Details</div>
    ${itemRows}
    <div class="row"><span class="label">Payment Mode</span><span class="value">${esc(payMode)}</span></div>
    ${remarks ? `<div class="row"><span class="label">Remarks</span><span class="value">${esc(remarks)}</span></div>` : ''}
  </div>
  <div class="amt-box"><span class="lbl">Total Amount Paid</span><span class="amt">${fmt(total)}</span></div>
  ${hasBankInfo ? `<div class="bank-box"><strong>Bank Transfer Details</strong> (for NEFT / Online payments)<br>${[i.bankAccountHolder ? `A/C Holder: ${esc(i.bankAccountHolder)}` : '', i.bankName ? `Bank: ${esc(i.bankName)}` : '', i.bankAccountNo ? `A/C No: ${esc(i.bankAccountNo)}` : '', i.bankIfsc ? `IFSC: ${esc(i.bankIfsc)}` : '', i.bankBranch ? `Branch: ${esc(i.bankBranch)}` : ''].filter(Boolean).join('  &nbsp;·&nbsp;  ')}</div>` : ''}
  ${i.signatureUrl ? `<div class="sig-row"><div><img src="${esc(i.signatureUrl)}" alt="Signature" /><div class="sig-label">Authorised Signatory</div></div></div>` : ''}
  <div class="footer">${i.principalName ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">Principal: ${esc(i.principalName)}</div>` : ''}Computer-generated receipt — no manual signature required<br>${esc(i.name)}${i.gstin ? `  ·  GSTIN: ${esc(i.gstin)}` : ''}</div>
</div><script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank', 'width=620,height=780');
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
}

export default function AccountantFeesPage() {
  const user = usePortalAuthStore((s) => s.user);
  const [institution, setInstitution] = useState<Institution>({ name: user?.institutionName ?? 'School' });
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [student, setStudent] = useState<StudentSearch | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [payMode, setPayMode] = useState<string>('cash');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);

  const [history, setHistory] = useState<CollectionEntry[]>([]);
  const [histTotal, setHistTotal] = useState(0);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  type StudentSearch = StudentHit;

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/academic/institution')])
      .then(([yrs, inst]) => {
        const list = Array.isArray(yrs) ? yrs : [];
        setYears(list);
        const cur = list.find((y: AcademicYear) => y.isCurrent) ?? list[0];
        if (cur) setYearId(cur.id);
        if (inst) setInstitution(inst as Institution);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/students?search=${encodeURIComponent(query.trim())}&limit=8`);
        setResults(Array.isArray(res) ? res : (res as any)?.students ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [query]);

  const loadLedger = useCallback(async (s: StudentSearch, yrId: string) => {
    setLedgerLoading(true);
    try {
      const [ldg, hist] = await Promise.all([
        apiFetch(`/fees/ledger/student/${s.id}${yrId ? `?yearId=${yrId}` : ''}`),
        apiFetch(`/fees/collections/student/${s.id}`),
      ]);
      setLedger(ldg as Ledger);
      const payments = (hist as any)?.payments ?? [];
      setHistory(payments);
      setHistTotal((hist as any)?.total ?? 0);
      const autoSelect = new Set<string>();
      for (const item of (ldg as Ledger).items ?? []) {
        for (const inst of item.installments) {
          if (inst.status !== 'paid') autoSelect.add(inst.id);
        }
      }
      setSelectedIds(autoSelect);
      setOverrides({});
    } catch (e: any) { showToast(e.message ?? 'Failed to load fee data', false); setLedger(null); }
    finally { setLedgerLoading(false); }
  }, []);

  const selectStudent = (s: StudentSearch) => {
    setStudent(s); setResults([]); setQuery('');
    setSelectedIds(new Set()); setOverrides({});
    setPayMode('cash'); setRemarks('');
    loadLedger(s, yearId);
  };

  const clearStudent = () => {
    setStudent(null); setLedger(null); setHistory([]);
    setSelectedIds(new Set()); setQuery('');
  };

  const toggleInstallment = (inst: LedgerInstallment) => {
    if (inst.status === 'paid') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(inst.id)) next.delete(inst.id); else next.add(inst.id);
      return next;
    });
  };

  const getAmount = (inst: LedgerInstallment): number => {
    const ov = overrides[inst.id];
    if (ov !== undefined) return parseFloat(ov) || 0;
    return inst.balance;
  };

  const selectedTotal = ledger
    ? ledger.items.flatMap((i) => i.installments).filter((i) => selectedIds.has(i.id)).reduce((s, i) => s + getAmount(i), 0)
    : 0;

  const handleCollect = async () => {
    if (!student || !ledger?.plan || selectedIds.size === 0) return;
    setCollecting(true);
    try {
      const items = ledger.items.flatMap((item) =>
        item.installments
          .filter((inst) => selectedIds.has(inst.id))
          .map((inst) => ({
            feePlanInstallmentId: inst.id,
            feePlanItemId: item.feePlanItemId,
            feeCategoryId: item.feeCategoryId,
            amount: getAmount(inst),
          }))
      );
      const res = await apiFetch<{ collections: { receiptNo: string; amount: number; paidOn: string; feePlanInstallment?: { label: string }; feeCategory: { name: string } }[]; totalCollected: number }>('/fees/collections', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.id, academicYearId: yearId, items, paymentMode: payMode, paidOn: payDate, remarks: remarks || undefined }),
      });
      showToast(`Collected ${fmt(res.totalCollected)} — ${res.collections.length} receipt(s) generated`);
      printReceipt({
        collections: res.collections.map((c) => ({ receiptNo: c.receiptNo, amount: c.amount, paymentMode: payMode, categoryName: c.feeCategory.name, installmentLabel: c.feePlanInstallment?.label })),
        student: { name: ledger.student.name, admissionNo: ledger.student.admissionNo, className: ledger.student.className },
        paidOn: payDate, remarks, institution,
      });
      await loadLedger(student, yearId);
      setRemarks('');
    } catch (e: any) { showToast(e.message ?? 'Collection failed', false); }
    finally { setCollecting(false); }
  };

  const unitLabel = (s: StudentSearch) => s.academicUnit?.displayName || s.academicUnit?.name || '';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Fee Collection</h1>
      <p className="text-sm text-ds-text3 mb-6">Search a student to view dues and collect payments</p>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Student search */}
      {!student && (
        <div className="mb-6 relative max-w-lg">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Search Student</label>
          <input
            className="field w-full"
            placeholder="Type name or admission number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && <div className="absolute right-3 top-8 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
          {results.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {results.map((s) => (
                <button key={s.id} onClick={() => selectStudent(s)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-ds-bg2 border-b last:border-0 flex items-center justify-between"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-1)' }}>{s.firstName} {s.lastName}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                    {s.admissionNo}{unitLabel(s) ? ` · ${unitLabel(s)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {student && (
        <div className="space-y-5">
          {/* Student header */}
          <div className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {student.firstName} {student.lastName}
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                {student.admissionNo}{unitLabel(student) ? ` · ${unitLabel(student)}` : ''}
              </p>
              {ledger?.plan && (
                <p className="text-xs mt-1" style={{ color: '#6366f1' }}>Plan: {ledger.plan.name}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <select
                className="field text-sm"
                style={{ width: 'auto' }}
                value={yearId}
                onChange={(e) => { setYearId(e.target.value); loadLedger(student, e.target.value); }}
              >
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <button onClick={clearStudent} className="btn-secondary text-sm">Change</button>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading fee ledger…</div>
          ) : ledger ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Annual Fee', val: ledger.totalAnnual, cls: '' },
                  { label: 'Concession', val: ledger.totalConcession, cls: 'text-indigo-600' },
                  { label: 'Total Paid', val: ledger.totalPaid, cls: 'text-green-700' },
                  { label: 'Balance Due', val: ledger.totalBalance, cls: ledger.totalBalance > 0 ? 'text-red-600' : 'text-green-700' },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <p className={`text-xl font-bold ${cls}`} style={!cls ? { color: 'var(--text-1)' } : {}}>{fmt(val)}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                  </div>
                ))}
              </div>

              {!ledger.plan ? (
                <div className="rounded-xl p-5 text-sm text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  No fee plan assigned to this student's class. Configure one in the admin Fee Management panel.
                </div>
              ) : (
                <>
                  {/* Installment table */}
                  {ledger.items.length > 0 && (
                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Fee Installments</h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Click to select / deselect installments for collection</p>
                        </div>
                        <button
                          className="text-xs font-medium px-3 py-1 rounded-lg"
                          style={{ background: 'var(--bg-2)', color: 'var(--text-2)' }}
                          onClick={() => {
                            const allDue = new Set<string>();
                            for (const item of ledger.items) {
                              for (const inst of item.installments) {
                                if (inst.status !== 'paid') allDue.add(inst.id);
                              }
                            }
                            if (selectedIds.size === allDue.size) setSelectedIds(new Set());
                            else setSelectedIds(allDue);
                          }}
                        >
                          {selectedIds.size > 0 ? 'Deselect All' : 'Select All Due'}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead style={{ background: 'var(--bg-2)' }}>
                            <tr>
                              <th className="w-8 px-3 py-3"></th>
                              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Category · Installment</th>
                              <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Net Due</th>
                              <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Paid</th>
                              <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Balance</th>
                              <th className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Status</th>
                              <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Collect ₹</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.items.flatMap((item) =>
                              item.installments.map((inst) => {
                                const chip = STATUS_CHIP[inst.status] ?? STATUS_CHIP.due;
                                const isSelected = selectedIds.has(inst.id);
                                const isPaid = inst.status === 'paid';
                                return (
                                  <tr
                                    key={inst.id}
                                    onClick={() => toggleInstallment(inst)}
                                    className={`border-b transition-colors ${isPaid ? 'opacity-50 cursor-default' : 'cursor-pointer hover:bg-indigo-50/40'} ${isSelected ? 'bg-indigo-50/60' : ''}`}
                                    style={{ borderColor: 'var(--border)' }}
                                  >
                                    <td className="px-3 py-3 text-center">
                                      {!isPaid && (
                                        <input type="checkbox" readOnly checked={isSelected}
                                          className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-medium text-xs" style={{ color: 'var(--text-1)' }}>{item.categoryName}</span>
                                      <span className="text-xs" style={{ color: 'var(--text-3)' }}> · {inst.label}</span>
                                      {inst.dueDate && (
                                        <span className="block text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                                          Due {new Date(inst.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--text-2)' }}>{fmt(inst.netAmount)}</td>
                                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--text-2)' }}>{fmt(inst.paid)}</td>
                                    <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color: inst.balance > 0 ? '#dc2626' : '#15803d' }}>
                                      {fmt(inst.balance)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                        style={{ background: chip.bg, color: chip.color }}>
                                        {chip.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                      {isSelected && (
                                        <input
                                          type="number" min="1" step="1"
                                          value={overrides[inst.id] ?? inst.balance}
                                          onChange={(e) => setOverrides((prev) => ({ ...prev, [inst.id]: e.target.value }))}
                                          className="field text-right text-xs"
                                          style={{ width: '100px' }}
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
                    </div>
                  )}

                  {/* Collection form */}
                  {selectedIds.size > 0 && (
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid #6366f1' }}>
                      <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-1)' }}>
                        Record Collection — {fmt(selectedTotal)}
                      </h3>
                      <div className="mb-4">
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Payment Mode</p>
                        <div className="flex flex-wrap gap-2">
                          {MODES.map((m) => (
                            <button key={m} onClick={() => setPayMode(m)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${payMode === m ? 'text-white border-indigo-600 bg-indigo-600' : 'border-ds-border text-ds-text2 hover:border-indigo-400'}`}>
                              {MODE_LABEL[m]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Payment Date</label>
                          <input type="date" className="field w-full text-sm" value={payDate}
                            onChange={(e) => setPayDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Remarks (optional)</label>
                          <input className="field w-full text-sm" placeholder="e.g. Cash received"
                            value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                        </div>
                      </div>
                      <button
                        onClick={handleCollect}
                        disabled={collecting || selectedTotal <= 0}
                        className="btn-primary w-full text-sm"
                      >
                        {collecting ? 'Processing…' : `Collect ${fmt(selectedTotal)} via ${MODE_LABEL[payMode]}`}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Payment history */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Payment History</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{history.length} payment(s) · Total {fmt(histTotal)}</p>
                  </div>
                </div>
                {history.length === 0 ? (
                  <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead style={{ background: 'var(--bg-2)' }}>
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Receipt No</th>
                          <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Fee / Installment</th>
                          <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Date</th>
                          <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Mode</th>
                          <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((c) => (
                          <tr key={c.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-3)' }}>{c.receiptNo}</td>
                            <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-1)' }}>
                              {c.categoryName}
                              {c.installmentLabel && <span style={{ color: 'var(--text-3)' }}> · {c.installmentLabel}</span>}
                            </td>
                            <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                              {new Date(c.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3 text-xs capitalize" style={{ color: 'var(--text-2)' }}>{c.paymentMode}</td>
                            <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-1)' }}>
                              {fmt(c.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No fee data available for this student.</p>
          )}
        </div>
      )}
    </div>
  );
}
