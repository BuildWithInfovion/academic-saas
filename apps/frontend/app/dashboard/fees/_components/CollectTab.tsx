'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { AcademicYear, Institution, LedgerInstallment, LedgerItem, Ledger, StudentSearchResult } from '@/lib/types';
import { fmt, todayStr, STATUS_CHIP, MODES, MODE_LABEL, printReceipt } from './fees-utils';

type StudentSearch = StudentSearchResult;

export function CollectTab({ years, institution }: { years: AcademicYear[]; institution: Institution | null }) {
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
      try { const r = await apiFetch<any>(`/students?search=${encodeURIComponent(query)}&limit=8&page=1`); setResults(r.data ?? []); }
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
      const autoSelect = new Set<string>();
      for (const item of l.items) {
        for (const inst of item.installments) {
          if (inst.status !== 'paid' && inst.status !== 'upcoming') autoSelect.add(inst.id);
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
      const items = ledger.items.flatMap((item: LedgerItem) =>
        item.installments
          .filter((inst) => selectedInstallments.has(inst.id))
          .map((inst) => ({
            feePlanInstallmentId: inst.id.startsWith('item_') ? undefined : inst.id,
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
      if (institution) {
        for (const c of res.collections) {
          printReceipt({ receiptNo: c.receiptNo, amount: c.amount, paymentMode: payMode, paidOn: c.paidOn, categoryName: c.feeCategory.name, installmentLabel: c.feePlanInstallment?.label, remarks, studentName: ledger.student.name, admissionNo: ledger.student.admissionNo, className: ledger.student.className, institution });
        }
      }
      const l = await apiFetch<Ledger>(`/fees/ledger/student/${selected.id}?yearId=${currentYear.id}`);
      setLedger(l); setSelectedInstallments(new Set()); setOverrides({}); setRemarks('');
    } catch (e: any) { showToast(e.message ?? 'Collection failed'); } finally { setCollecting(false); }
  };

  const unitDisplayName = (unit?: { name: string; displayName?: string }) => unit?.displayName || unit?.name || '—';

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Search Student</h2>
        <div className="relative max-w-lg">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type name or admission number…" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {loading && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
          {results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
              {results.map((s) => (
                <button key={s.id} onClick={() => void selectStudent(s)} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">{s.firstName[0]}{s.lastName[0]}</div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{s.firstName} {s.lastName}</div>
                    <div className="text-xs text-slate-500">{s.admissionNo} · {unitDisplayName(s.academicUnit)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {ledgerLoading && <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading fee ledger…</div>}

      {!ledgerLoading && selected && ledger && (
        <div className="space-y-4">
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

          {!ledger.plan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <div className="text-amber-700 font-medium">No fee plan assigned to this student's class</div>
              <div className="text-amber-600 text-sm mt-1">Go to the <strong>Fee Plans</strong> tab to create a plan and assign it to {ledger.student.className}.</div>
            </div>
          )}

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
