'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface AcademicUnit { id: string; name: string; displayName?: string; }
interface Student { id: string; firstName: string; lastName: string; admissionNo: string; rollNo?: string; }
interface AttendanceRecord {
  status: string;
  student: Student;
}

const today = () => new Date().toISOString().split('T')[0];

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  leave: 'bg-blue-100 text-blue-700',
};

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'daily' | 'defaulters'>('daily');

  // Daily report
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [date, setDate] = useState(today());
  const [reportData, setReportData] = useState<{ taken: boolean; students: Student[]; records: AttendanceRecord[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Defaulters
  const [defUnit, setDefUnit] = useState('');
  const [defYear, setDefYear] = useState(new Date().getFullYear());
  const [defMonth, setDefMonth] = useState(new Date().getMonth() + 1);
  const [defThreshold, setDefThreshold] = useState(75);
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [loadingDef, setLoadingDef] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.institutionId) return;
    apiFetch('/academic/units/leaf').then((res) => {
      setUnits(Array.isArray(res) ? res : res.data || []);
    }).catch(() => {});
  }, [user?.institutionId]);

  const loadDailyReport = async () => {
    if (!selectedUnit || !date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/attendance/units/${selectedUnit}/daily?date=${date}`);
      setReportData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUnit && date) loadDailyReport();
  }, [selectedUnit, date]);

  const loadDefaulters = async () => {
    if (!defUnit) return;
    setLoadingDef(true);
    setError(null);
    try {
      const res = await apiFetch(`/attendance/units/${defUnit}/defaulters?year=${defYear}&month=${defMonth}&threshold=${defThreshold}`);
      setDefaulters(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoadingDef(false);
    }
  };

  const counts = reportData?.records
    ? {
        present: reportData.records.filter((r) => r.status === 'present').length,
        absent: reportData.records.filter((r) => r.status === 'absent').length,
        late: reportData.records.filter((r) => r.status === 'late').length,
        leave: reportData.records.filter((r) => r.status === 'leave').length,
      }
    : null;

  const totalStudents = reportData?.students?.length ?? 0;
  const marked = reportData?.records?.length ?? 0;

  const inp = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white';
  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Attendance</h1>
      <p className="text-sm text-gray-400 mb-6">View and monitor attendance records. Attendance is marked by class teachers.</p>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button className={tabBtn('daily')} onClick={() => setTab('daily')}>Daily Report</button>
        <button className={tabBtn('defaulters')} onClick={() => setTab('defaulters')}>Defaulters</button>
      </div>

      {/* ── Daily Report ── */}
      {tab === 'daily' && (
        <>
          {/* Controls */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-600 block mb-1">Class</label>
                <select className={inp + ' w-full'} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Date</label>
                <input type="date" className={inp} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          {!selectedUnit && (
            <div className="text-center py-16 text-gray-400 text-sm">Select a class to view attendance</div>
          )}

          {selectedUnit && loading && (
            <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
          )}

          {selectedUnit && !loading && reportData && (
            <>
              {/* Status banner */}
              {!reportData.taken ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-700">
                  Attendance has not been marked yet for this class on{' '}
                  {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
                  The class teacher should mark it from the Teacher Portal.
                </div>
              ) : (
                <div className="flex gap-3 mb-4 flex-wrap">
                  {([['present', 'green'], ['absent', 'red'], ['late', 'yellow'], ['leave', 'blue']] as const).map(([s, c]) => (
                    <div key={s} className={`px-4 py-2 rounded-lg text-sm font-medium bg-${c}-50 text-${c}-700 border border-${c}-200`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}: <strong>{counts?.[s] ?? 0}</strong>
                    </div>
                  ))}
                  <div className="px-4 py-2 rounded-lg text-sm bg-gray-50 text-gray-600 border border-gray-200">
                    Total: <strong>{totalStudents}</strong> &nbsp;|&nbsp; Marked: <strong>{marked}</strong>
                  </div>
                </div>
              )}

              {/* Attendance table */}
              {reportData.taken && reportData.records.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">#</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Student</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.records.map((r, idx) => (
                        <tr key={r.student.id} className={r.status === 'absent' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-5 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-800">{r.student.firstName} {r.student.lastName}</div>
                            <div className="text-xs text-gray-400 font-mono">{r.student.admissionNo}</div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Students not yet marked */}
              {reportData.taken && totalStudents > marked && (
                <p className="text-xs text-gray-400 mt-3">
                  {totalStudents - marked} student(s) not yet marked.
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* ── Defaulters ── */}
      {tab === 'defaulters' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-gray-600 block mb-1">Class</label>
                <select className={inp + ' w-full'} value={defUnit} onChange={(e) => setDefUnit(e.target.value)}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Month</label>
                <select className={inp} value={defMonth} onChange={(e) => setDefMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Year</label>
                <select className={inp} value={defYear} onChange={(e) => setDefYear(Number(e.target.value))}>
                  {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Below (%)</label>
                <input type="number" className={inp + ' w-20'} min="1" max="100"
                  value={defThreshold} onChange={(e) => setDefThreshold(Number(e.target.value))} />
              </div>
              <button onClick={loadDefaulters} disabled={!defUnit || loadingDef}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loadingDef ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          {defaulters.length === 0 && !loadingDef && defUnit && (
            <div className="text-center py-16 text-gray-400 text-sm">
              No defaulters found — all students are above {defThreshold}% attendance.
            </div>
          )}

          {defaulters.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{defaulters.length} defaulter(s) below {defThreshold}%</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Student</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Present</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Absent</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Total</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {defaulters.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-800">{d.firstName} {d.lastName}</div>
                        <div className="text-xs text-gray-400 font-mono">{d.admissionNo}</div>
                      </td>
                      <td className="px-5 py-3 text-green-700">{d.present}</td>
                      <td className="px-5 py-3 text-red-600 font-medium">{d.absent}</td>
                      <td className="px-5 py-3 text-gray-600">{d.total}</td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${d.percentage < 50 ? 'text-red-600' : 'text-orange-500'}`}>
                          {d.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
