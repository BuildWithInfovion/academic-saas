'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; name: string; displayName: string };
type FeeDefaulter = { id: string; firstName: string; lastName: string; balance: number; totalDue: number; totalPaid: number };
type DailyRecord = { receiptNo: string; amount: number; paymentMode: string; student: { firstName: string; lastName: string } };

export default function PrincipalFeesPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [defaulters, setDefaulters] = useState<FeeDefaulter[]>([]);
  const [dailyCollection, setDailyCollection] = useState<DailyRecord[]>([]);
  const [todayDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'defaulters' | 'daily'>('defaulters');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/academic/units/leaf')])
      .then(([y, u]) => {
        setYears(y);
        setUnits(u);
        const current = y.find((yr: AcademicYear) => yr.isCurrent) ?? y[0];
        if (current) setSelectedYearId(current.id);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedYearId) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/fees/defaulters?yearId=${selectedYearId}${selectedUnitId ? `&unitId=${selectedUnitId}` : ''}`),
      apiFetch(`/fees/payments/daily?date=${todayDate}`),
    ])
      .then(([def, daily]) => { setDefaulters(def ?? []); setDailyCollection(daily ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedYearId, selectedUnitId]);

  const totalDue = defaulters.reduce((s, d) => s + (d.balance ?? 0), 0);
  const todayTotal = dailyCollection.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Fee Reports</h1>
      <p className="text-sm text-ds-text3 mb-6">Monitor fee collection and outstanding balances</p>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year</label>
          <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Filter by Class</label>
          <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none">
            <option value="">All classes</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ds-error-bg border border-ds-error-border rounded-xl p-4">
          <p className="text-2xl font-bold text-ds-error-text">{defaulters.length}</p>
          <p className="text-sm text-ds-error-text font-medium mt-1">Fee Defaulters</p>
          <p className="text-xs text-ds-text2 mt-0.5">Outstanding balance</p>
        </div>
        <div className="bg-ds-error-bg border border-ds-error-border rounded-xl p-4">
          <p className="text-2xl font-bold text-ds-error-text">₹{totalDue.toLocaleString('en-IN')}</p>
          <p className="text-sm text-ds-error-text font-medium mt-1">Total Outstanding</p>
          <p className="text-xs text-ds-text2 mt-0.5">Across all defaulters</p>
        </div>
        <div className="bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
          <p className="text-2xl font-bold text-ds-success-text">₹{todayTotal.toLocaleString('en-IN')}</p>
          <p className="text-sm text-ds-success-text font-medium mt-1">Today's Collection</p>
          <p className="text-xs text-ds-text2 mt-0.5">{todayDate}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-ds-bg2 rounded-xl p-1 w-fit">
        {[{ id: 'defaulters', label: 'Defaulters' }, { id: 'daily', label: "Today's Collection" }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'defaulters' && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-ds-border">
            <h2 className="font-semibold text-ds-text1 text-sm">Fee Defaulters</h2>
            <p className="text-xs text-ds-text3 mt-0.5">{defaulters.length} student(s) with outstanding balance</p>
          </div>
          {loading ? <p className="p-5 text-sm text-ds-text3">Loading...</p>
            : defaulters.length === 0 ? <p className="p-5 text-sm text-ds-text3">No defaulters found.</p>
            : (
              <table className="w-full text-sm">
                <thead className="bg-ds-bg2">
                  <tr>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">#</th>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Student</th>
                    <th className="text-right px-5 py-3 text-ds-text2 font-medium text-xs">Total Due</th>
                    <th className="text-right px-5 py-3 text-ds-text2 font-medium text-xs">Paid</th>
                    <th className="text-right px-5 py-3 text-ds-text2 font-medium text-xs">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {defaulters.map((d, i) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3 text-ds-text3 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 text-ds-text1 font-medium">{d.firstName} {d.lastName}</td>
                      <td className="px-5 py-3 text-right text-ds-text2">₹{(d.totalDue ?? 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right text-ds-text2">₹{(d.totalPaid ?? 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right font-semibold text-ds-error-text">₹{(d.balance ?? 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-ds-border">
            <h2 className="font-semibold text-ds-text1 text-sm">Today's Collection</h2>
            <p className="text-xs text-ds-text3 mt-0.5">{dailyCollection.length} payment(s) recorded today</p>
          </div>
          {dailyCollection.length === 0 ? <p className="p-5 text-sm text-ds-text3">No payments recorded today.</p>
            : (
              <table className="w-full text-sm">
                <thead className="bg-ds-bg2">
                  <tr>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Receipt No</th>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Student</th>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Mode</th>
                    <th className="text-right px-5 py-3 text-ds-text2 font-medium text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {dailyCollection.map((r) => (
                    <tr key={r.receiptNo}>
                      <td className="px-5 py-3 text-ds-text2 font-mono text-xs">{r.receiptNo}</td>
                      <td className="px-5 py-3 text-ds-text1">{r.student?.firstName} {r.student?.lastName}</td>
                      <td className="px-5 py-3 text-ds-text2 capitalize">{r.paymentMode}</td>
                      <td className="px-5 py-3 text-right font-semibold text-ds-text1">₹{r.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  );
}
