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
  present:  'bg-ds-success-bg text-ds-success-text border-green-200',
  late:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  half_day: 'bg-ds-info-bg text-ds-info-text border-blue-200',
  absent:   'bg-ds-error-bg text-ds-error-text border-red-200',
  pending:  'bg-ds-warning-bg text-ds-warning-text border-amber-200',
  approved: 'bg-ds-success-bg text-ds-success-text border-green-200',
  rejected: 'bg-ds-error-bg text-ds-error-text border-red-200',
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-ds-text1">Staff Attendance</h1>
      <p className="text-sm text-ds-text3 mb-6">View attendance, monthly reports, and approve leave requests</p>

      {error   && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit bg-ds-bg2 border border-ds-border">
        {([
          ['leave', `Leave Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['daily', 'Daily View'],
          ['monthly', 'Monthly Report'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Leave Requests — Principal approves */}
      {tab === 'leave' && (
        loading ? <p className="text-sm text-ds-text3">Loading…</p> : (
          <div className="rounded-xl overflow-hidden bg-ds-surface border border-ds-border shadow-sm">
            {leaves.length === 0 ? (
              <p className="p-8 text-sm text-center text-ds-text3">No leave requests.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ds-bg2">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Staff</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Period</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Reason</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-3 text-sm text-ds-text1">{userLabel(l.user)}</td>
                      <td className="px-5 py-3 text-xs text-ds-text2">{fmt(l.startDate)} – {fmt(l.endDate)}</td>
                      <td className="px-5 py-3 text-xs text-ds-text2 max-w-[200px] truncate">{l.reason}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[l.status]}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {l.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleLeaveReview(l.id, 'approved')}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-green-50 text-ds-success-text border border-green-200 hover:bg-green-100">
                              Approve
                            </button>
                            <button onClick={() => handleLeaveReview(l.id, 'rejected')}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-red-50 text-ds-error-text border border-red-200 hover:bg-red-100">
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-ds-text3">{l.reviewNote || '—'}</span>
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
            <input type="date" className="border border-ds-border-strong rounded-lg p-2 text-sm"
              value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
          </div>
          {loading ? <p className="text-sm text-ds-text3">Loading…</p> : (
            <div className="rounded-xl overflow-hidden bg-ds-surface border border-ds-border shadow-sm">
              {dailyRecords.length === 0 ? (
                <p className="p-8 text-sm text-center text-ds-text3">No staff attendance records for this date.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-ds-bg2">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Staff</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Role</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Clock In</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Clock Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border">
                    {dailyRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 text-sm text-ds-text1">{userLabel(r.user)}</td>
                        <td className="px-5 py-3 text-xs text-ds-text2">
                          {r.user.roles.map((ur) => ur.role.label).join(', ')}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[r.status]}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-ds-text2">{fmtTime(r.clockIn)}</td>
                        <td className="px-5 py-3 text-xs text-ds-text2">{fmtTime(r.clockOut)}</td>
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
            <select className="border border-ds-border-strong rounded-lg p-2 text-sm"
              value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="border border-ds-border-strong rounded-lg p-2 text-sm"
              value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {loading ? <p className="text-sm text-ds-text3">Loading…</p> : (
            <div className="rounded-xl overflow-hidden bg-ds-surface border border-ds-border shadow-sm">
              {monthly.length === 0 ? (
                <p className="p-8 text-sm text-center text-ds-text3">No records for this month.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-ds-bg2">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-ds-text2">Staff</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-ds-text2">Present</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-ds-text2">Late</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-ds-text2">Half Day</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-ds-text2">Absent</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-ds-text2">Days Marked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border">
                    {monthly.map((m) => (
                      <tr key={m.user.id}>
                        <td className="px-5 py-3 text-sm text-ds-text1">{userLabel(m.user)}</td>
                        <td className="px-5 py-3 text-center font-semibold text-ds-success-text">{m.present}</td>
                        <td className="px-5 py-3 text-center font-semibold text-yellow-700">{m.late}</td>
                        <td className="px-5 py-3 text-center font-semibold text-ds-info-text">{m.halfDay}</td>
                        <td className="px-5 py-3 text-center font-semibold text-ds-error-text">{m.absent}</td>
                        <td className="px-5 py-3 text-center text-ds-text2">{m.total}</td>
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
