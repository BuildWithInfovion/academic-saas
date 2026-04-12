'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Stats = {
  totalCollectedToday: number;
  totalCollectedMonth: number;
  totalDue: number;
  totalStudents: number;
};

export default function AccountantOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  useEffect(() => {
    Promise.all([
      apiFetch('/fees/payments/summary').catch(() => null),
      apiFetch('/students').catch(() => []),
    ])
      .then(([summary, students]) => {
        const s = summary as any;
        setStats({
          totalCollectedToday: s?.todayTotal ?? 0,
          totalCollectedMonth: s?.monthTotal ?? 0,
          totalDue: s?.totalDue ?? 0,
          totalStudents: Array.isArray(students) ? students.length : (s?.totalStudents ?? 0),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const quickActions = [
    { label: 'Fee Collection', desc: 'View & record payments', path: '/portal/accountant/fees', color: 'bg-black text-white' },
    { label: 'My Attendance',  desc: 'Mark your daily attendance', path: '/portal/accountant/staff-attendance', color: 'bg-gray-800 text-white' },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>{todayDate}</p>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-1)' }}>Accountant Overview</h1>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => router.push(a.path)}
            className={`rounded-xl p-5 text-left hover:opacity-90 transition-opacity ${a.color}`}
          >
            <p className="font-semibold">{a.label}</p>
            <p className="text-sm mt-1 opacity-70">{a.desc}</p>
          </button>
        ))}
      </div>

      {/* Stats */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading stats…</p>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Collection", value: `₹${stats.totalCollectedToday.toLocaleString('en-IN')}`, color: 'text-green-700' },
            { label: "This Month", value: `₹${stats.totalCollectedMonth.toLocaleString('en-IN')}`, color: 'text-blue-700' },
            { label: "Total Due", value: `₹${stats.totalDue.toLocaleString('en-IN')}`, color: 'text-red-600' },
            { label: "Total Students", value: String(stats.totalStudents), color: 'var(--text-1)' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
