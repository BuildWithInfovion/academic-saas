'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type DailyRecord = {
  id: string;
  userId: string;
  date: string;
  status: string;
  clockIn: string | null;
  note: string | null;
  user: { id: string; email: string | null; phone: string | null; roles: { role: { code: string; label: string } }[] };
};

type MonthlySummary = {
  user: { id: string; email: string | null; phone: string | null };
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  total: number;
};

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewNote: string | null;
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
  if (u.email) return u.email;
  return u.phone ?? '—';
}

export default function StaffAttendanceDashboardPage() {
  const [tab, setTab]               = useState<'daily' | 'monthly' | 'leave'>('daily');
  const [dailyDate, setDailyDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [monthly, setMonthly]       = useState<MonthlySummary[]>([]);
  const [leaves, setLeaves]         = useState<LeaveRequest[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const showMsg = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

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

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>Staff Attendance</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>
        View daily records, monthly summaries, and approve leave requests
      </p>

      {error   && <div className="alert alert-error mb-4 text-sm">{error}</div>}
      {success && <div className="alert alert-success mb-4 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {([['daily', 'Daily View'], ['monthly', 'Monthly Report'], ['leave', 'Leave Requests']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Daily */}
      {tab === 'daily' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input type="date" className="field w-auto" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
          </div>
          {loading ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p> : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {dailyRecords.length === 0 ? (
                <p className="p-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>
                  No staff attendance records for this date.
                  <br/>
                  <span className="text-xs">Staff self-mark attendance from their portal.</span>
                </p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Clock In</th><th>Note</th></tr></thead>
                  <tbody>
                    {dailyRecords.map((r) => (
                      <tr key={r.id}>
                        <td>{userLabel(r.user)}</td>
                        <td className="text-xs">
                          {r.user.roles.map((ur) => ur.role.label).join(', ')}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[r.status]}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text-3)' }}>{r.note || '—'}</td>
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
            <select className="form-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="form-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {loading ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p> : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {monthly.length === 0 ? (
                <p className="p-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>No records for this month.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Half Day</th>
                      <th>Absent</th>
                      <th>Days Marked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.user.id}>
                        <td>{userLabel(m.user)}</td>
                        <td><span className="text-green-700 font-semibold">{m.present}</span></td>
                        <td><span className="text-yellow-700 font-semibold">{m.late}</span></td>
                        <td><span className="text-blue-700 font-semibold">{m.halfDay}</span></td>
                        <td><span className="text-red-700 font-semibold">{m.absent}</span></td>
                        <td style={{ color: 'var(--text-3)' }}>{m.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Leave requests — view only for Operator/Director; approval is done by Principal */}
      {tab === 'leave' && (
        <>
          <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            Leave approval is managed by the Principal. This view is read-only.
          </div>
          {loading ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p> : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {leaves.length === 0 ? (
                <p className="p-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>No leave requests.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Staff</th><th>Period</th><th>Reason</th><th>Status</th><th>Review Note</th></tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => (
                      <tr key={l.id}>
                        <td>{userLabel(l.user)}</td>
                        <td className="text-xs">{fmt(l.startDate)} – {fmt(l.endDate)}</td>
                        <td className="text-xs max-w-[200px] truncate">{l.reason}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[l.status]}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {l.reviewNote || '—'}
                        </td>
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
