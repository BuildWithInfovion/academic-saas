'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Unit = { id: string; name: string; displayName: string };
type Defaulter = { id: string; firstName: string; lastName: string; percentage: number; present: number; total: number };

export default function PrincipalAttendancePage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [allStudents, setAllStudents] = useState<Defaulter[]>([]);
  const [threshold, setThreshold] = useState(75);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/academic/units/leaf').then(setUnits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUnit || !selectedMonth) return;
    const [year, month] = selectedMonth.split('-');
    setLoading(true);
    Promise.all([
      apiFetch(`/attendance/units/${selectedUnit}/defaulters?year=${year}&month=${month}&threshold=${threshold}`),
      apiFetch(`/attendance/units/${selectedUnit}/defaulters?year=${year}&month=${month}&threshold=0`),
    ])
      .then(([def, all]) => { setDefaulters(def ?? []); setAllStudents(all ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedUnit, selectedMonth, threshold]);

  const unitName = units.find((u) => u.id === selectedUnit)?.displayName || '';
  const [year, month] = selectedMonth.split('-');
  const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const inp = 'border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Attendance Reports</h1>
      <p className="text-sm text-gray-400 mb-6">Class-wise attendance monitoring and defaulter tracking</p>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Class</label>
            <select className={inp} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
              <option value="">Select class...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Month</label>
            <input type="month" className={inp} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Threshold (%)</label>
            <select className={inp} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
              {[60, 65, 70, 75, 80, 85].map((t) => <option key={t} value={t}>{t}%</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedUnit && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-2xl font-bold text-gray-800">{allStudents.length}</p>
              <p className="text-sm text-gray-600 mt-1">Total Students</p>
              <p className="text-xs text-gray-400">{unitName}</p>
            </div>
            <div className={`rounded-xl border shadow-sm p-4 ${defaulters.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-2xl font-bold ${defaulters.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{defaulters.length}</p>
              <p className={`text-sm mt-1 ${defaulters.length > 0 ? 'text-red-700' : 'text-green-700'}`}>Defaulters</p>
              <p className="text-xs text-gray-500">Below {threshold}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-2xl font-bold text-gray-800">{monthLabel}</p>
              <p className="text-sm text-gray-600 mt-1">Reporting Period</p>
            </div>
          </div>

          {/* Full student attendance table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">Student Attendance — {unitName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{monthLabel} · Showing all {allStudents.length} students</p>
            </div>
            {loading ? (
              <p className="text-sm text-gray-400 p-5">Loading...</p>
            ) : allStudents.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No attendance data for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">#</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                    <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Present / Total</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">%</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allStudents.map((s, i) => {
                    const isDefaulter = s.percentage < threshold;
                    return (
                      <tr key={s.id} className={isDefaulter ? 'bg-red-50/40' : ''}>
                        <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-3 text-gray-800 font-medium">{s.firstName} {s.lastName}</td>
                        <td className="px-5 py-3 text-center text-gray-600">{s.present} / {s.total}</td>
                        <td className="px-5 py-3 text-right font-semibold">
                          <span className={isDefaulter ? 'text-red-600' : 'text-green-600'}>{s.percentage}%</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isDefaulter
                            ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Defaulter</span>
                            : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Good</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!selectedUnit && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">Select a class and month to view attendance reports</p>
        </div>
      )}
    </div>
  );
}
