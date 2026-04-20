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
    apiFetch('/fees/payments/summary')
      .then((summary: any) => {
        setStats({
          totalCollectedToday: summary?.todayTotal ?? 0,
          totalCollectedMonth: summary?.monthTotal ?? 0,
          totalDue: summary?.totalDue ?? 0,
          totalStudents: summary?.totalStudents ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const quickActions = [
    { label: 'Fee Collection', desc: 'View & record payments', path: '/portal/accountant/fees', gradient: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)' },
    { label: 'My Attendance',  desc: 'Mark your daily attendance', path: '/portal/accountant/staff-attendance', gradient: 'linear-gradient(135deg, #6b432f 0%, #3a1f0c 100%)' },
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
            className="rounded-xl p-5 text-left hover:opacity-90 transition-opacity"
            style={{ background: a.gradient, color: '#fcfbf7', border: '1px solid rgba(140,57,25,0.25)' }}
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
            { label: "Today's Collection", value: `₹${stats.totalCollectedToday.toLocaleString('en-IN')}`, color: 'text-ds-success-text' },
            { label: "This Month", value: `₹${stats.totalCollectedMonth.toLocaleString('en-IN')}`, color: 'text-ds-info-text' },
            { label: "Total Due", value: `₹${stats.totalDue.toLocaleString('en-IN')}`, color: 'text-ds-error-text' },
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
