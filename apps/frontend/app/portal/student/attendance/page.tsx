'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type MonthlyRecord = {
  date: string; status: string;
};

type MonthlySummary = {
  present: number; absent: number; late: number; leave: number;
  total: number; percentage: number;
  records: MonthlyRecord[];
};

export default function StudentAttendancePage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    apiFetch('/students/me')
      .then((s) => setStudentId(s.id))
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!studentId || !selectedMonth) return;
    const [year, month] = selectedMonth.split('-');
    setLoading(true);
    apiFetch(`/attendance/students/${studentId}/monthly?year=${year}&month=${month}`)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [studentId, selectedMonth]);

  if (notLinked) return (
    <div className="p-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
        Student profile not linked. Contact school admin.
      </div>
    </div>
  );

  const [year, month] = selectedMonth.split('-');
  const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const STATUS_COLORS: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
    leave: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">My Attendance</h1>
      <p className="text-sm text-gray-400 mb-6">Month-wise attendance record</p>

      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !summary ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm">No attendance data for {monthLabel}.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{summary.present}</p>
              <p className="text-xs text-green-600 mt-1">Present</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{summary.absent}</p>
              <p className="text-xs text-red-600 mt-1">Absent</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{summary.late}</p>
              <p className="text-xs text-amber-600 mt-1">Late</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${summary.percentage < 75 ? 'text-red-600' : 'text-gray-800'}`}>
                {summary.percentage}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Overall</p>
            </div>
          </div>

          {summary.percentage < 75 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              Your attendance is below 75%. Please contact your class teacher.
            </div>
          )}

          {/* Day-by-day record */}
          {summary.records && summary.records.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Day-by-Day Record — {monthLabel}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {summary.records.map((r) => (
                  <div key={r.date} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
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
