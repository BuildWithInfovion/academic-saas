'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
  note: string | null;
};

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewNote: string | null;
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

export default function StaffSelfAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves]   = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [markStatus, setMarkStatus] = useState<'present' | 'late' | 'half_day'>('present');
  const [note, setNote]       = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab]         = useState<'attendance' | 'leave'>('attendance');

  // Leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd,   setLeaveEnd]   = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const todayStr = now.toISOString().split('T')[0];
  const todayRecord = records.find((r) => r.date.startsWith(todayStr));

  const load = async () => {
    setLoading(true);
    try {
      const [att, lv] = await Promise.all([
        apiFetch(`/staff-attendance/my?year=${year}&month=${month}`),
        apiFetch('/staff-attendance/leave/my'),
      ]);
      setRecords(Array.isArray(att) ? att : []);
      setLeaves(Array.isArray(lv) ? lv : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleClockOut = async () => {
    setClockingOut(true); setError(null);
    try {
      await apiFetch('/staff-attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
      setSuccess('Clocked out successfully');
      await load();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message || 'Failed to clock out');
    } finally { setClockingOut(false); }
  };

  const handleMark = async () => {
    setMarking(true); setError(null);
    try {
      await apiFetch('/staff-attendance/mark-own', {
        method: 'POST',
        body: JSON.stringify({ status: markStatus, note: note.trim() || undefined }),
      });
      setSuccess('Attendance marked successfully');
      setNote('');
      await load();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message || 'Failed to mark attendance');
    } finally { setMarking(false); }
  };

  const handleLeaveSubmit = async () => {
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) return;
    setSubmittingLeave(true); setError(null);
    try {
      await apiFetch('/staff-attendance/leave', {
        method: 'POST',
        body: JSON.stringify({ startDate: leaveStart, endDate: leaveEnd, reason: leaveReason.trim() }),
      });
      setSuccess('Leave request submitted');
      setShowLeaveForm(false);
      setLeaveStart(''); setLeaveEnd(''); setLeaveReason('');
      await load();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message || 'Failed to submit leave');
    } finally { setSubmittingLeave(false); }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const presentDays = records.filter((r) => ['present', 'late', 'half_day'].includes(r.status)).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">My Attendance</h1>
      <p className="text-sm text-ds-text3 mb-6">
        Mark your daily attendance and manage leave requests
      </p>

      {error   && <div className="alert alert-error mb-4 text-sm">{error}</div>}
      {success && <div className="alert alert-success mb-4 text-sm">{success}</div>}

      {/* Today's mark card */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Today — {fmt(todayStr)}</p>
        {todayRecord ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border capitalize ${STATUS_STYLE[todayRecord.status]}`}>
              {todayRecord.status.replace('_', ' ')}
            </span>
            {todayRecord.clockIn && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                In: {new Date(todayRecord.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {todayRecord.clockOut ? (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                Out: {new Date(todayRecord.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <button
                onClick={handleClockOut}
                disabled={clockingOut}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 bg-red-50 text-ds-error-text hover:bg-red-100 disabled:opacity-50"
              >
                {clockingOut ? 'Clocking out…' : 'Clock Out'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(['present', 'late', 'half_day'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setMarkStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize ${
                    markStatus === s ? STATUS_STYLE[s] : 'border-ds-border text-ds-text2 hover:border-ds-border-strong'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="field flex-1"
                placeholder="Optional note (e.g. working from home)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                onClick={handleMark}
                disabled={marking}
                className="btn-primary px-5"
              >
                {marking ? 'Marking…' : 'Mark'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Present', val: presentDays, color: '#2d6a4f' },
          { label: 'Absent', val: records.filter((r) => r.status === 'absent').length, color: '#9b2226' },
          { label: 'Total Marked', val: records.length, color: 'var(--brand)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {(['attendance', 'leave'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t === 'attendance' ? 'Monthly Records' : 'Leave Requests'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>
      ) : tab === 'attendance' ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {records.length === 0 ? (
            <p className="p-6 text-sm text-center" style={{ color: 'var(--text-3)' }}>No attendance records this month.</p>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>{fmt(r.date)}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[r.status]}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-3)' }}>{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowLeaveForm(true)} className="btn-primary text-sm">
              + Apply for Leave
            </button>
          </div>

          {showLeaveForm && (
            <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--brand)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>New Leave Request</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>From Date</label>
                  <input type="date" className="field" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>To Date</label>
                  <input type="date" className="field" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Reason</label>
                <textarea className="field" rows={2} placeholder="Reason for leave…" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleLeaveSubmit} disabled={submittingLeave} className="btn-primary text-sm">
                  {submittingLeave ? 'Submitting…' : 'Submit Request'}
                </button>
                <button onClick={() => setShowLeaveForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {leaves.length === 0 ? (
              <p className="p-6 text-sm text-center" style={{ color: 'var(--text-3)' }}>No leave requests yet.</p>
            ) : (
              <table className="data-table w-full">
                <thead><tr><th>Period</th><th>Reason</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td className="text-xs">{fmt(l.startDate)} – {fmt(l.endDate)}</td>
                      <td className="text-xs">{l.reason}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[l.status]}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-3)' }}>{l.reviewNote || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
