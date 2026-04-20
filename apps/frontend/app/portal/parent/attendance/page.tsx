'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Child = { id: string; firstName: string; lastName: string; admissionNo: string; academicUnit?: { displayName?: string; name: string } };
type MonthlyRecord = { date: string; status: string };
type MonthlySummary = {
  present: number; absent: number; late: number; leave: number;
  total: number; percentage: number; records: MonthlyRecord[];
};

export default function ParentAttendancePage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/students/child')
      .then((res) => {
        const kids = Array.isArray(res) ? res : [];
        setChildren(kids);
        if (kids.length > 0) setSelectedChildId(kids[0].id);
        if (kids.length === 0) setNotLinked(true);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!selectedChildId || !selectedMonth) return;
    const [year, month] = selectedMonth.split('-');
    setLoading(true);
    apiFetch(`/attendance/students/${selectedChildId}/monthly?year=${year}&month=${month}`)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [selectedChildId, selectedMonth]);

  if (notLinked) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5 text-sm text-ds-warning-text">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  const [year, month] = selectedMonth.split('-');
  const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const STATUS_COLORS: Record<string, string> = {
    present: 'bg-ds-success-bg text-ds-success-text',
    absent: 'bg-ds-error-bg text-ds-error-text',
    late: 'bg-ds-warning-bg text-ds-warning-text',
    leave: 'bg-ds-info-bg text-ds-info-text',
  };

  const child = children.find((c) => c.id === selectedChildId);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Child's Attendance</h1>
      <p className="text-sm text-ds-text3 mb-6">Monthly attendance record</p>

      <div className="flex flex-wrap gap-4 mb-6">
        {children.length > 1 && (
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand"
          />
        </div>
      </div>

      {child && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4 mb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ds-bg2 flex items-center justify-center text-ds-text2 font-semibold text-sm">
            {child.firstName[0]}{child.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-ds-text1 text-sm">{child.firstName} {child.lastName}</p>
            <p className="text-xs text-ds-text3">
              {child.academicUnit?.displayName ?? child.academicUnit?.name ?? 'Class not assigned'} · {child.admissionNo}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ds-text3">Loading...</p>
      ) : !summary ? (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-8 text-center">
          <p className="text-ds-text3 text-sm">No attendance data for {monthLabel}.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-ds-success-bg border border-ds-success-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ds-success-text">{summary.present}</p>
              <p className="text-xs text-ds-success-text mt-1">Present</p>
            </div>
            <div className="bg-ds-error-bg border border-ds-error-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ds-error-text">{summary.absent}</p>
              <p className="text-xs text-ds-error-text mt-1">Absent</p>
            </div>
            <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ds-warning-text">{summary.late}</p>
              <p className="text-xs text-ds-warning-text mt-1">Late</p>
            </div>
            <div className="bg-ds-surface border border-ds-border rounded-xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${summary.percentage < 75 ? 'text-ds-error-text' : 'text-ds-text1'}`}>
                {summary.percentage}%
              </p>
              <p className="text-xs text-ds-text2 mt-1">Overall</p>
            </div>
          </div>

          {summary.percentage < 75 && (
            <div className="bg-ds-error-bg border border-ds-error-border rounded-lg p-3 mb-4 text-sm text-ds-error-text">
              Attendance is below 75%. Please speak to the class teacher.
            </div>
          )}

          {summary.records && summary.records.length > 0 && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-ds-border">
                <h2 className="font-semibold text-ds-text1 text-sm">Day-by-Day Record — {monthLabel}</h2>
              </div>
              <div className="divide-y divide-ds-border">
                {summary.records.map((r) => (
                  <div key={r.date} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-ds-text1">
                      {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
