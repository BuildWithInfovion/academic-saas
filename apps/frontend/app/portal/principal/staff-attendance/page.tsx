'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type DailyRecord = {
  id: string; userId: string; date: string; status: string;
  clockIn: string | null; clockOut: string | null; note: string | null;
  user: { id: string; email: string | null; phone: string | null; roles: { role: { code: string; label: string } }[] };
};
type MonthlySummary = {
  user: { id: string; email: string | null; phone: string | null };
  present: number; late: number; halfDay: number; absent: number; total: number;
};
type LeaveRequest = {
  id: string; startDate: string; endDate: string; reason: string; status: string; reviewNote: string | null;
  user: { id: string; email: string | null; phone: string | null };
};

const STATUS_STYLE: Record<string, string> = {
  present:  'bg-green-100 text-green-700 border-green-200',
  late:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  half_day: 'bg-blue-100 text-blue-700 border-blue-200',
  absent:   'bg-red-100 text-red-700 border-red-200',
  pending:  'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

function userLabel(u: { email: string | null; phone: string | null }) {
  return u.email || u.phone || '—';
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function PrincipalStaffAttendancePage() {
  const [tab, setTab] = useState<'daily' | 'monthly' | 'leave'>('leave');
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const showMsg = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const loadDaily = async () => {
    setLoading(true);
    try { setDailyRecords(await apiFetch(`/staff-attendance/daily?date=${dailyDate}`) as DailyRecord[]); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  const loadMonthly = async () => {
    setLoading(true);
    try { setMonthly(await apiFetch(`/staff-attendance/monthly?year=${year}&month=${month}`) as MonthlySummary[]); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  const loadLeaves = async () => {
    setLoading(true);
    try { setLeaves(await apiFetch('/staff-attendance/leave') as LeaveRequest[]); }
    catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'daily') loadDaily();
    else if (tab === 'monthly') loadMonthly();
    else loadLeaves();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dailyDate, year, month]);

  const handleLeaveReview = async (id: string, action: 'approved' | 'rejected') => {
    setError(null);
    try {
      await apiFetch(`/staff-attendance/leave/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      showMsg(`Leave request ${action}`);
      await loadLeaves();
    } catch (e: any) { setError(e.message || 'Failed to update'); }
  };

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-1 text-gray-800">Staff Attendance</h1>
      <p className="text-sm text-gray-400 mb-6">View attendance, monthly reports, and approve leave requests</p>

      {error   && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit bg-gray-100 border border-gray-200">
        {([
          ['leave', `Leave Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['daily', 'Daily View'],
          ['monthly', 'Monthly Report'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Leave Requests — Principal approves */}
      {tab === 'leave' && (
        loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm">
            {leaves.length === 0 ? (
              <p className="p-8 text-sm text-center text-gray-400">No leave requests.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Staff</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Period</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Reason</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-3 text-sm text-gray-800">{userLabel(l.user)}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{fmt(l.startDate)} – {fmt(l.endDate)}</td>
                      <td className="px-5 py-3 text-xs text-gray-600 max-w-[200px] truncate">{l.reason}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[l.status]}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {l.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleLeaveReview(l.id, 'approved')}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                              Approve
                            </button>
                            <button onClick={() => handleLeaveReview(l.id, 'rejected')}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{l.reviewNote || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {/* Daily */}
      {tab === 'daily' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input type="date" className="border border-gray-300 rounded-lg p-2 text-sm"
              value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            <div className="rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm">
              {dailyRecords.length === 0 ? (
                <p className="p-8 text-sm text-center text-gray-400">No staff attendance records for this date.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Staff</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Role</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Clock In</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Clock Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dailyRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 text-sm text-gray-800">{userLabel(r.user)}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {r.user.roles.map((ur) => ur.role.label).join(', ')}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[r.status]}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{fmtTime(r.clockIn)}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{fmtTime(r.clockOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Monthly */}
      {tab === 'monthly' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <select className="border border-gray-300 rounded-lg p-2 text-sm"
              value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="border border-gray-300 rounded-lg p-2 text-sm"
              value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            <div className="rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm">
              {monthly.length === 0 ? (
                <p className="p-8 text-sm text-center text-gray-400">No records for this month.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Staff</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Present</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Late</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Half Day</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Absent</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Days Marked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthly.map((m) => (
                      <tr key={m.user.id}>
                        <td className="px-5 py-3 text-sm text-gray-800">{userLabel(m.user)}</td>
                        <td className="px-5 py-3 text-center font-semibold text-green-700">{m.present}</td>
                        <td className="px-5 py-3 text-center font-semibold text-yellow-700">{m.late}</td>
                        <td className="px-5 py-3 text-center font-semibold text-blue-700">{m.halfDay}</td>
                        <td className="px-5 py-3 text-center font-semibold text-red-700">{m.absent}</td>
                        <td className="px-5 py-3 text-center text-gray-500">{m.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
