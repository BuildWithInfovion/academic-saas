'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AcademicYear, LedgerItem, Ledger, StudentSearchResult, Concession } from '@/lib/types';
import { fmt } from './fees-utils';

type StudentSearch = StudentSearchResult;

export function ConcessionsTab({ years }: { years: AcademicYear[] }) {
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
      try { const r = await apiFetch<any>(`/students?search=${encodeURIComponent(query)}&limit=8&page=1`); setResults(r.data ?? []); } catch { }
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
