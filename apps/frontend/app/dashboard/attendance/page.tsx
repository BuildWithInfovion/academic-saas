'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { AcademicUnit, Student } from '@/lib/types';
interface AttendanceRecord {
  status: string;
  student: Student;
}

const today = () => new Date().toISOString().split('T')[0];

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-ds-success-bg text-ds-success-text',
  absent: 'bg-ds-error-bg text-ds-error-text',
  late: 'bg-yellow-100 text-yellow-700',
  leave: 'bg-ds-info-bg text-ds-info-text',
};

interface MonthlyReportRow {
  id: string; firstName: string; lastName: string; admissionNo: string; rollNo?: string;
  daily: (string | null)[]; present: number; absent: number; leave: number; total: number; percentage: number;
}

function downloadMonthlyCSV(report: { dates: string[]; rows: MonthlyReportRow[] }, unitName: string, year: number, month: number) {
  const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const headers = ['Roll No', 'Name', 'Adm No', ...report.dates.map((d) => new Date(d).getDate().toString()), 'Present', 'Absent', 'Leave', 'Total', '%'];
  const rows = report.rows.map((r) => [
    r.rollNo ?? '',
    `${r.firstName} ${r.lastName}`,
    r.admissionNo,
    ...r.daily.map((d) => d === 'present' ? 'P' : d === 'absent' ? 'A' : d === 'late' ? 'L' : d === 'leave' ? 'LE' : ''),
    r.present, r.absent, r.leave, r.total, r.percentage + '%',
  ]);
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-${unitName}-${MONTHS_FULL[month - 1]}-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'daily' | 'defaulters' | 'monthly'>('daily');

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

  // Monthly report
  const [monthUnit, setMonthUnit] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());
  const [monthMonth, setMonthMonth] = useState(new Date().getMonth() + 1);
  const [monthReport, setMonthReport] = useState<{ dates: string[]; rows: MonthlyReportRow[] } | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const loadMonthlyReport = async () => {
    if (!monthUnit) return;
    setLoadingMonth(true);
    setError(null);
    try {
      const res = await apiFetch(`/attendance/units/${monthUnit}/monthly-report?year=${monthYear}&month=${monthMonth}`);
      setMonthReport(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load monthly report');
    } finally {
      setLoadingMonth(false);
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

  const inp = 'border border-ds-border-strong rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';
  const tabBtn = (t: 'daily' | 'defaulters' | 'monthly') =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-black text-black' : 'border-transparent text-ds-text2 hover:text-ds-text1'}`;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Attendance</h1>
      <p className="text-sm text-ds-text3 mb-6">View and monitor attendance records. Attendance is marked by class teachers.</p>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ds-border mb-6 overflow-x-auto">
        <button className={tabBtn('daily')} onClick={() => setTab('daily')}>Daily Report</button>
        <button className={tabBtn('monthly')} onClick={() => setTab('monthly')}>Monthly Report</button>
        <button className={tabBtn('defaulters')} onClick={() => setTab('defaulters')}>Defaulters</button>
      </div>

      {/* ── Daily Report ── */}
      {tab === 'daily' && (
        <>
          {/* Controls */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-5">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-ds-text2 block mb-1">Class</label>
                <select className={inp + ' w-full'} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Date</label>
                <input type="date" className={inp} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          {!selectedUnit && (
            <div className="text-center py-16 text-ds-text3 text-sm">Select a class to view attendance</div>
          )}

          {selectedUnit && loading && (
            <div className="text-center py-16 text-ds-text3 text-sm">Loading...</div>
          )}

          {selectedUnit && !loading && reportData && (
            <>
              {/* Status banner */}
              {!reportData.taken ? (
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-4 mb-4 text-sm text-ds-warning-text">
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
                  <div className="px-4 py-2 rounded-lg text-sm bg-ds-bg2 text-ds-text2 border border-ds-border">
                    Total: <strong>{totalStudents}</strong> &nbsp;|&nbsp; Marked: <strong>{marked}</strong>
                  </div>
                </div>
              )}

              {/* Attendance table */}
              {reportData.taken && reportData.records.length > 0 && (
                <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-ds-bg2">
                      <tr>
                        <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">#</th>
                        <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">Student</th>
                        <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ds-border">
                      {reportData.records.map((r, idx) => (
                        <tr key={r.student.id} className={r.status === 'absent' ? 'bg-red-50' : 'hover:bg-ds-bg2'}>
                          <td className="px-5 py-3 text-ds-text3 text-xs">{idx + 1}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-ds-text1">{r.student.firstName} {r.student.lastName}</div>
                            <div className="text-xs text-ds-text3 font-mono">{r.student.admissionNo}</div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[r.status] || 'bg-ds-bg2 text-ds-text2'}`}>
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
                <p className="text-xs text-ds-text3 mt-3">
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
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-5">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-ds-text2 block mb-1">Class</label>
                <select className={inp + ' w-full'} value={defUnit} onChange={(e) => setDefUnit(e.target.value)}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Month</label>
                <select className={inp} value={defMonth} onChange={(e) => setDefMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Year</label>
                <select className={inp} value={defYear} onChange={(e) => setDefYear(Number(e.target.value))}>
                  {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Below (%)</label>
                <input type="number" className={inp + ' w-20'} min="1" max="100"
                  value={defThreshold} onChange={(e) => setDefThreshold(Number(e.target.value))} />
              </div>
              <button onClick={loadDefaulters} disabled={!defUnit || loadingDef}
                className="btn-brand px-4 py-2 rounded-lg">
                {loadingDef ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          {defaulters.length === 0 && !loadingDef && defUnit && (
            <div className="text-center py-16 text-ds-text3 text-sm">
              No defaulters found — all students are above {defThreshold}% attendance.
            </div>
          )}

          {defaulters.length > 0 && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-ds-border flex items-center justify-between">
                <span className="text-sm font-medium text-ds-text1">{defaulters.length} defaulter(s) below {defThreshold}%</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-ds-bg2">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">Student</th>
                    <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">Present</th>
                    <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">Absent</th>
                    <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">Total</th>
                    <th className="px-5 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider text-left">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {defaulters.map((d) => (
                    <tr key={d.id} className="hover:bg-ds-bg2">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ds-text1">{d.firstName} {d.lastName}</div>
                        <div className="text-xs text-ds-text3 font-mono">{d.admissionNo}</div>
                      </td>
                      <td className="px-5 py-3 text-ds-success-text">{d.present}</td>
                      <td className="px-5 py-3 text-ds-error-text font-medium">{d.absent}</td>
                      <td className="px-5 py-3 text-ds-text2">{d.total}</td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${d.percentage < 50 ? 'text-ds-error-text' : 'text-orange-500'}`}>
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

      {/* ── Monthly Report ── */}
      {tab === 'monthly' && (
        <>
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-5">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-ds-text2 block mb-1">Class *</label>
                <select className={inp + ' w-full'} value={monthUnit} onChange={(e) => setMonthUnit(e.target.value)}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Month</label>
                <select className={inp} value={monthMonth} onChange={(e) => setMonthMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Year</label>
                <select className={inp} value={monthYear} onChange={(e) => setMonthYear(Number(e.target.value))}>
                  {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={loadMonthlyReport} disabled={!monthUnit || loadingMonth} className="btn-brand px-4 py-2 rounded-lg">
                {loadingMonth ? 'Loading…' : 'Generate'}
              </button>
              {monthReport && (
                <button
                  onClick={() => downloadMonthlyCSV(monthReport, units.find((u) => u.id === monthUnit)?.displayName ?? 'class', monthYear, monthMonth)}
                  className="px-4 py-2 rounded-lg border border-ds-border-strong text-sm font-medium text-ds-text1 hover:bg-ds-bg2"
                >
                  ↓ Download CSV
                </button>
              )}
            </div>
          </div>

          {monthReport && (
            monthReport.rows.length === 0 ? (
              <div className="text-center py-12 text-ds-text3 text-sm">No students in this class.</div>
            ) : (
              <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-x-auto">
                <table className="text-sm" style={{ minWidth: `${Math.max(600, 220 + monthReport.dates.length * 36)}px` }}>
                  <thead className="bg-ds-bg2">
                    <tr>
                      <th className="px-3 py-3 text-xs font-medium text-ds-text2 text-left sticky left-0 bg-ds-bg2 z-10">Roll</th>
                      <th className="px-3 py-3 text-xs font-medium text-ds-text2 text-left sticky left-10 bg-ds-bg2 z-10 whitespace-nowrap">Student</th>
                      {monthReport.dates.map((d) => (
                        <th key={d} className="px-1 py-3 text-xs font-medium text-ds-text2 text-center w-8">
                          {new Date(d).getDate()}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-xs font-medium text-ds-text2 text-center">P</th>
                      <th className="px-3 py-3 text-xs font-medium text-ds-text2 text-center">A</th>
                      <th className="px-3 py-3 text-xs font-medium text-ds-text2 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border">
                    {monthReport.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-ds-bg2">
                        <td className="px-3 py-2 text-ds-text3 text-xs sticky left-0 bg-ds-surface">{row.rollNo ?? '—'}</td>
                        <td className="px-3 py-2 sticky left-10 bg-ds-surface whitespace-nowrap">
                          <div className="font-medium text-ds-text1 text-xs">{row.firstName} {row.lastName}</div>
                        </td>
                        {row.daily.map((d, i) => (
                          <td key={i} className="px-1 py-2 text-center text-[10px] font-semibold">
                            {d === 'present' ? <span className="text-emerald-600">P</span>
                              : d === 'absent' ? <span className="text-red-600">A</span>
                              : d === 'late' ? <span className="text-yellow-600">L</span>
                              : d === 'leave' ? <span className="text-blue-500">LE</span>
                              : <span className="text-ds-border">·</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center text-emerald-600 font-semibold text-xs">{row.present}</td>
                        <td className="px-3 py-2 text-center text-red-600 font-semibold text-xs">{row.absent}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-bold ${row.percentage >= 75 ? 'text-emerald-600' : row.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {row.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
