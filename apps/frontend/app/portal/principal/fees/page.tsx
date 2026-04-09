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
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Fee Reports</h1>
      <p className="text-sm text-gray-400 mb-6">Monitor fee collection and outstanding balances</p>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Academic Year</label>
          <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Filter by Class</label>
          <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none">
            <option value="">All classes</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{defaulters.length}</p>
          <p className="text-sm text-red-700 font-medium mt-1">Fee Defaulters</p>
          <p className="text-xs text-gray-500 mt-0.5">Outstanding balance</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">₹{totalDue.toLocaleString('en-IN')}</p>
          <p className="text-sm text-red-700 font-medium mt-1">Total Outstanding</p>
          <p className="text-xs text-gray-500 mt-0.5">Across all defaulters</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">₹{todayTotal.toLocaleString('en-IN')}</p>
          <p className="text-sm text-green-700 font-medium mt-1">Today's Collection</p>
          <p className="text-xs text-gray-500 mt-0.5">{todayDate}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ id: 'defaulters', label: 'Defaulters' }, { id: 'daily', label: "Today's Collection" }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'defaulters' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Fee Defaulters</h2>
            <p className="text-xs text-gray-400 mt-0.5">{defaulters.length} student(s) with outstanding balance</p>
          </div>
          {loading ? <p className="p-5 text-sm text-gray-400">Loading...</p>
            : defaulters.length === 0 ? <p className="p-5 text-sm text-gray-400">No defaulters found.</p>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">#</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Total Due</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Paid</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {defaulters.map((d, i) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 text-gray-800 font-medium">{d.firstName} {d.lastName}</td>
                      <td className="px-5 py-3 text-right text-gray-600">₹{(d.totalDue ?? 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right text-gray-600">₹{(d.totalPaid ?? 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right font-semibold text-red-600">₹{(d.balance ?? 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Today's Collection</h2>
            <p className="text-xs text-gray-400 mt-0.5">{dailyCollection.length} payment(s) recorded today</p>
          </div>
          {dailyCollection.length === 0 ? <p className="p-5 text-sm text-gray-400">No payments recorded today.</p>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Receipt No</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Mode</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dailyCollection.map((r) => (
                    <tr key={r.receiptNo}>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{r.receiptNo}</td>
                      <td className="px-5 py-3 text-gray-800">{r.student?.firstName} {r.student?.lastName}</td>
                      <td className="px-5 py-3 text-gray-500 capitalize">{r.paymentMode}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">₹{r.amount.toLocaleString('en-IN')}</td>
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
