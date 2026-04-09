'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; name: string; displayName: string };
type Defaulter = { id: string; firstName: string; lastName: string; percentage: number; academicUnit?: { displayName: string } };
type FeeDefaulter = { id: string; firstName: string; lastName: string; balance: number };
type Exam = { id: string; name: string; status: string };

export default function DirectorReportsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [attendanceDefaulters, setAttendanceDefaulters] = useState<Defaulter[]>([]);
  const [feeDefaulters, setFeeDefaulters] = useState<FeeDefaulter[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'fees' | 'exams'>('attendance');
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/academic/units/leaf')])
      .then(([y, u]) => {
        setYears(y);
        setUnits(u);
        const yr: AcademicYear = y.find((yr: AcademicYear) => yr.isCurrent) ?? y[0] ?? null;
        setCurrentYear(yr);
        if (yr) {
          loadFeeDefaulters(yr.id);
          loadExams(yr.id);
        }
        if (u.length > 0) {
          setSelectedUnitId(u[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUnitId) return;
    loadAttendanceDefaulters(selectedUnitId);
  }, [selectedUnitId]);

  const loadAttendanceDefaulters = (unitId: string) => {
    setLoading(true);
    apiFetch(`/attendance/units/${unitId}/defaulters?year=${year}&month=${month}&threshold=75`)
      .then((d) => setAttendanceDefaulters(d ?? []))
      .catch(() => setAttendanceDefaulters([]))
      .finally(() => setLoading(false));
  };

  const loadFeeDefaulters = (yearId: string) => {
    apiFetch(`/fees/defaulters?yearId=${yearId}`)
      .then((d) => setFeeDefaulters(d ?? []))
      .catch(() => {});
  };

  const loadExams = (yearId: string) => {
    apiFetch(`/exams?yearId=${yearId}`)
      .then((e) => setExams(e ?? []))
      .catch(() => {});
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance', count: attendanceDefaulters.length },
    { id: 'fees', label: 'Fees', count: feeDefaulters.length },
    { id: 'exams', label: 'Examinations', count: exams.length },
  ] as const;

  const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Reports</h1>
      <p className="text-sm text-gray-400 mb-6">Institution-wide monitoring for {currentYear?.name ?? '—'}</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === t.id ? 'bg-black text-white' : 'bg-gray-300 text-gray-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Select Class</label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName || u.name}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-400 mt-4">Defaulters below 75% — {monthName}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">
                Attendance Defaulters — {units.find((u) => u.id === selectedUnitId)?.displayName ?? ''}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{attendanceDefaulters.length} student(s) below 75%</p>
            </div>
            {loading ? (
              <p className="text-sm text-gray-400 p-5">Loading...</p>
            ) : attendanceDefaulters.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No defaulters for this class this month.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">#</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attendanceDefaulters.map((d, i) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 text-gray-800">{d.firstName} {d.lastName}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-semibold text-red-600">{d.percentage}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Fees Tab */}
      {activeTab === 'fees' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Fee Defaulters — {currentYear?.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{feeDefaulters.length} student(s) with outstanding balance</p>
          </div>
          {feeDefaulters.length === 0 ? (
            <p className="text-sm text-gray-400 p-5">No fee defaulters for this year.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">#</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {feeDefaulters.map((d, i) => (
                  <tr key={d.id}>
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 text-gray-800">{d.firstName} {d.lastName}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">
                      ₹{d.balance?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Exams Tab */}
      {activeTab === 'exams' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">All Examinations — {currentYear?.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{exams.length} exam(s) configured</p>
          </div>
          {exams.length === 0 ? (
            <p className="text-sm text-gray-400 p-5">No exams for this year.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Exam Name</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 text-gray-800 font-medium">{e.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.status === 'active' ? 'bg-blue-100 text-blue-700'
                        : e.status === 'completed' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                      </span>
                    </td>
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
