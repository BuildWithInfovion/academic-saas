'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type AttendanceRecord = { date: string; status: string };
type LeaveRequest = { id: string; status: string };

export default function NonTeachingStaffOverviewPage() {
  const router = useRouter();
  const [todayStatus, setTodayStatus] = useState<string | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    Promise.all([
      apiFetch(`/staff-attendance/my?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).catch(() => []),
      apiFetch('/staff-attendance/leave/my').catch(() => []),
    ]).then(([monthly, leaves]) => {
      const records = monthly as AttendanceRecord[];
      const todayRecord = records.find((r) => r.date?.slice(0, 10) === todayStr);
      setTodayStatus(todayRecord?.status ?? null);
      const pending = (leaves as LeaveRequest[]).filter((l) => l.status === 'pending').length;
      setPendingLeaves(pending);
    }).finally(() => setStatsLoading(false));
  }, []);

  const statusLabel: Record<string, string> = {
    present: 'Present',
    late: 'Late',
    half_day: 'Half Day',
    absent: 'Absent',
    leave: 'On Leave',
  };
  const statusColor: Record<string, string> = {
    present: 'text-ds-success-text bg-ds-success-bg border-ds-success-border',
    late: 'text-ds-warning-text bg-ds-warning-bg border-ds-warning-border',
    half_day: 'text-ds-warning-text bg-ds-warning-bg border-ds-warning-border',
    absent: 'text-ds-error-text bg-ds-error-bg border-ds-error-border',
    leave: 'text-ds-info-text bg-ds-info-bg border-ds-info-border',
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Staff Overview</h1>
      <p className="text-sm text-ds-text3 mb-6">{todayDate}</p>

      {/* Live status bar */}
      {!statsLoading && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-ds-border bg-ds-surface p-4">
            <p className="text-xs font-medium text-ds-text3 mb-1">Today's Attendance</p>
            {todayStatus ? (
              <span className={`inline-block px-2 py-1 rounded-md text-sm font-semibold border ${statusColor[todayStatus] ?? 'text-ds-text2 bg-ds-surface border-ds-border'}`}>
                {statusLabel[todayStatus] ?? todayStatus}
              </span>
            ) : (
              <span className="inline-block px-2 py-1 rounded-md text-sm font-semibold border text-ds-warning-text bg-ds-warning-bg border-ds-warning-border">
                Not Marked
              </span>
            )}
          </div>
          <div className="rounded-xl border border-ds-border bg-ds-surface p-4">
            <p className="text-xs font-medium text-ds-text3 mb-1">Pending Leave Requests</p>
            <p className={`text-2xl font-bold ${pendingLeaves > 0 ? 'text-ds-warning-text' : 'text-ds-success-text'}`}>
              {pendingLeaves}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => router.push('/portal/non-teaching-staff/staff-attendance')}
          className="rounded-xl p-5 text-left hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)', color: '#fcfbf7', border: '1px solid rgba(140,57,25,0.25)' }}
        >
          <p className="text-sm font-semibold">My Attendance</p>
          <p className="text-xs mt-1 opacity-75">Mark your daily attendance &amp; apply for leave</p>
        </button>
        <button
          onClick={() => router.push('/portal/non-teaching-staff/announcements')}
          className="rounded-xl p-5 text-left hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #6b432f 0%, #3a1f0c 100%)', color: '#fcfbf7', border: '1px solid rgba(140,57,25,0.25)' }}
        >
          <p className="text-sm font-semibold">Announcements</p>
          <p className="text-xs mt-1 opacity-75">Notices from school management</p>
        </button>
      </div>
    </div>
  );
}
