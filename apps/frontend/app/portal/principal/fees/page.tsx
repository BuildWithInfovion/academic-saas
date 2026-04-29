'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; name: string; displayName: string };

type V2Defaulter = {
  id: string; firstName: string; lastName: string; admissionNo: string;
  className: string; due: number; paid: number; balance: number;
};

type DailyEntry = {
  id?: string; receiptNo: string; amount: number; paymentMode: string;
  student?: { firstName: string; lastName: string };
  categoryName?: string;
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function exportCSV(defaulters: V2Defaulter[]) {
  const header = 'S.No,Student Name,Admission No,Class,Total Due,Total Paid,Balance\n';
  const rows = defaulters.map((d, i) =>
    `${i + 1},"${d.firstName} ${d.lastName}",${d.admissionNo},"${d.className}",${d.due.toFixed(2)},${d.paid.toFixed(2)},${d.balance.toFixed(2)}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `fee-defaulters-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function PrincipalFeesPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [defaulters, setDefaulters] = useState<V2Defaulter[]>([]);
  const [dailyCollection, setDailyCollection] = useState<DailyEntry[]>([]);
  const [todayDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'defaulters' | 'daily'>('defaulters');
  const [loading, setLoading] = useState(false);
  const [defaultersLoading, setDefaultersLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/academic/units/leaf')])
      .then(([y, u]) => {
        const yearList = Array.isArray(y) ? y : [];
        setYears(yearList);
        setUnits(Array.isArray(u) ? u : []);
        const current = yearList.find((yr: AcademicYear) => yr.isCurrent) ?? yearList[0];
        if (current) setSelectedYearId(current.id);
      })
      .catch(() => {});
  }, []);

  // Load daily collection once on mount
  useEffect(() => {
    setLoading(true);
    apiFetch(`/fees/payments/daily?date=${todayDate}`)
      .then((daily) => setDailyCollection(Array.isArray(daily) ? daily : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todayDate]);

  // Load defaulters when year or unit changes
  useEffect(() => {
    if (!selectedYearId) return;
    setDefaultersLoading(true);
    apiFetch(`/fees/v2/defaulters?yearId=${selectedYearId}${selectedUnitId ? `&unitId=${selectedUnitId}` : ''}`)
      .then((res) => setDefaulters(Array.isArray(res) ? res : []))
      .catch(() => setDefaulters([]))
      .finally(() => setDefaultersLoading(false));
  }, [selectedYearId, selectedUnitId]);

  const totalOutstanding = defaulters.reduce((s, d) => s + (d.balance ?? 0), 0);
  const todayTotal = dailyCollection.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Fee Reports</h1>
      <p className="text-sm text-ds-text3 mb-6">Monitor fee collection and outstanding balances</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border p-5" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
          <p className="text-2xl font-bold" style={{ color: '#dc2626' }}>{defaulters.length}</p>
          <p className="text-sm font-medium mt-1" style={{ color: '#dc2626' }}>Fee Defaulters</p>
          <p className="text-xs mt-0.5 text-ds-text2">With outstanding balance</p>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
          <p className="text-2xl font-bold" style={{ color: '#dc2626' }}>{fmt(totalOutstanding)}</p>
          <p className="text-sm font-medium mt-1" style={{ color: '#dc2626' }}>Total Outstanding</p>
          <p className="text-xs mt-0.5 text-ds-text2">Across all defaulters</p>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <p className="text-2xl font-bold" style={{ color: '#15803d' }}>{fmt(todayTotal)}</p>
          <p className="text-sm font-medium mt-1" style={{ color: '#15803d' }}>Today's Collection</p>
          <p className="text-xs mt-0.5 text-ds-text2">{dailyCollection.length} transaction(s)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-2)' }}>
        {([['defaulters', 'Fee Defaulters'], ['daily', "Today's Collection"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'defaulters' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Fee Defaulters</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {defaulters.length} student(s) with outstanding balance (plan-based)
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {/* Filters */}
              <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}
                className="field text-sm" style={{ width: 'auto' }}>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}
                className="field text-sm" style={{ width: 'auto' }}>
                <option value="">All classes</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
              </select>
              {defaulters.length > 0 && (
                <button onClick={() => exportCSV(defaulters)}
                  className="btn-secondary text-sm px-3">
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {defaultersLoading ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>
          ) : defaulters.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>
              {selectedYearId ? 'No defaulters found for the selected filters.' : 'Select an academic year to view defaulters.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-2)' }}>
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>#</th>
                    <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Student</th>
                    <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Admission No</th>
                    <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Class</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Total Due</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Paid</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.map((d, i) => (
                    <tr key={d.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-3)' }}>{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-sm" style={{ color: 'var(--text-1)' }}>
                        {d.firstName} {d.lastName}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-3)' }}>{d.admissionNo}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{d.className}</td>
                      <td className="px-5 py-3 text-right text-xs" style={{ color: 'var(--text-2)' }}>{fmt(d.due)}</td>
                      <td className="px-5 py-3 text-right text-xs" style={{ color: 'var(--text-2)' }}>{fmt(d.paid)}</td>
                      <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: '#dc2626' }}>
                        {fmt(d.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ background: 'var(--bg-2)' }}>
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                      Total ({defaulters.length} students)
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                      {fmt(defaulters.reduce((s, d) => s + d.due, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                      {fmt(defaulters.reduce((s, d) => s + d.paid, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-bold" style={{ color: '#dc2626' }}>
                      {fmt(totalOutstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Today's Collection</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {dailyCollection.length} payment(s) · {todayDate}
            </p>
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>
          ) : dailyCollection.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No payments recorded today.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--bg-2)' }}>
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Receipt No</th>
                      <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Student</th>
                      <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Fee / Category</th>
                      <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Mode</th>
                      <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyCollection.map((r, i) => (
                      <tr key={r.receiptNo ?? i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-3)' }}>{r.receiptNo}</td>
                        <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-1)' }}>
                          {r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{r.categoryName ?? '—'}</td>
                        <td className="px-5 py-3 text-xs capitalize" style={{ color: 'var(--text-2)' }}>{r.paymentMode}</td>
                        <td className="px-5 py-3 text-right font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                          {fmt(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: 'var(--bg-2)' }}>
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Total</td>
                      <td className="px-5 py-3 text-right font-bold text-sm" style={{ color: '#15803d' }}>{fmt(todayTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
