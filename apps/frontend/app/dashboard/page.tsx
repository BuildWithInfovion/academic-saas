'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { apiFetch } from '@/lib/api';

interface Stats        { totalStudents: number; unlinkedParents: number; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }

export default function DashboardPage() {
  const router          = useRouter();
  const user            = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadAuth        = useAuthStore((s) => s.loadAuth);

  const [stats,       setStats]       = useState<Stats | null>(null);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  useEffect(() => { loadAuth(); }, [loadAuth]);

  useEffect(() => {
    if (!isAuthenticated) return; // layout already handles redirect
    Promise.all([apiFetch('/students/count'), apiFetch('/academic/years')])
      .then(([s, y]) => {
        setStats(s as Stats);
        const years: AcademicYear[] = Array.isArray(y) ? y : ((y as { data?: AcademicYear[] }).data ?? []);
        setCurrentYear(years.find((yr) => yr.isCurrent) ?? null);
      }).catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center">
      <p style={{ color: 'var(--text-3)' }}>Redirecting…</p>
    </div>
  );

  const statCards = [
    {
      label: 'Total Students', value: stats?.totalStudents ?? '—', sub: 'Active enrollments',
      accent: 'stat-accent-violet', iconBg: '#fdf0e0', iconColor: '#ae5525',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
    },
    {
      label: 'Academic Year', value: currentYear?.name ?? '—', sub: 'Current session',
      accent: 'stat-accent-amber', iconBg: '#fff3cd', iconColor: '#9c6f00',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      label: 'Today',
      value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      sub: new Date().toLocaleDateString('en-IN', { weekday: 'long' }),
      accent: 'stat-accent-emerald', iconBg: '#d8f3dc', iconColor: '#2d6a4f',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label: 'Platform', value: 'v1.0', sub: 'Academic SaaS',
      accent: 'stat-accent-blue', iconBg: '#f7ecdb', iconColor: '#6b432f',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    },
  ];

  const quickActions = [
    {
      label: 'New Admission', desc: 'Admit a new student', path: '/dashboard/students',
      gradient: 'linear-gradient(135deg,#ae5525 0%,#8c3919 100%)',
      glow: 'rgba(174,85,37,0.45)', border: 'rgba(140,57,25,0.3)',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
    },
    {
      label: 'Mark Attendance', desc: "Today's class attendance", path: '/dashboard/attendance',
      gradient: 'linear-gradient(135deg,#0d9488 0%,#0f766e 100%)',
      glow: 'rgba(13,148,136,0.45)', border: 'rgba(15,118,110,0.3)',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    },
    {
      label: 'Collect Fee', desc: 'Record fee payment', path: '/dashboard/fees',
      gradient: 'linear-gradient(135deg,#dc924b 0%,#ae7040 100%)',
      glow: 'rgba(220,146,75,0.45)', border: 'rgba(174,112,64,0.3)',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: 'Enter Marks', desc: 'Exam score entry', path: '/dashboard/exams',
      gradient: 'linear-gradient(135deg,#6b432f 0%,#423129 100%)',
      glow: 'rgba(107,67,47,0.45)', border: 'rgba(66,49,41,0.3)',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
  ];

  const modules = [
    { label: 'Inquiries',         desc: 'Admission lead pipeline',            path: '/dashboard/inquiries',          dot: '#ae5525' },
    { label: 'Student Directory', desc: 'Search and manage student profiles',  path: '/dashboard/students/directory', dot: '#dc924b' },
    { label: 'Classes',           desc: 'Academic units & sections',           path: '/dashboard/classes',            dot: '#2d6a4f' },
    { label: 'Subjects',          desc: 'Subject master & class mapping',      path: '/dashboard/subjects',           dot: '#8c3919' },
    { label: 'Timetable',         desc: 'Weekly class schedule',               path: '/dashboard/timetable',          dot: '#c5692e' },
    { label: 'Examinations',      desc: 'Exams, marks & scorecards',           path: '/dashboard/exams',              dot: '#6b432f' },
    { label: 'Fees',              desc: 'Collections, receipts & dues',        path: '/dashboard/fees',               dot: '#dc924b' },
    { label: 'Announcements',     desc: 'Broadcast to all portals',            path: '/dashboard/announcements',      dot: '#ae5525' },
    { label: 'Staff',             desc: 'Staff profiles & credentials',        path: '/dashboard/staff',              dot: '#2d6a4f' },
  ];

  return (
    <div className="p-7 max-w-5xl">

      {/* ── Header ── */}
      <div className="page-header mb-8 fade-up-1">
        <div>
          <h1 className="page-title">
            {greeting},{' '}
            <span style={{ color: '#ae5525' }}>
              {user?.email?.split('@')[0] || 'Admin'}
            </span>
          </h1>
          <p className="page-subtitle">{todayDate}</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
          style={{ background: '#fdf0e0', border: '1px solid #e8d5bc', color: '#ae5525' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d6a4f',
            boxShadow: '0 0 5px rgba(45,106,79,0.6)', display: 'inline-block' }} />
          System Online
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 fade-up-2">
        {statCards.map((s) => (
          <div key={s.label} className={`card card-hover ${s.accent} p-5 cursor-default`}>
            <div className="mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: s.iconBg, color: s.iconColor }}>
                {s.icon}
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.025em', lineHeight: 1 }}>
              {s.value}
            </p>
            <p className="text-sm font-medium mt-1.5" style={{ color: 'var(--text-2)' }}>{s.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Unlinked Parents Alert ── */}
      {stats && stats.unlinkedParents > 0 && (
        <div className="mb-6 fade-up-2 flex items-center justify-between px-5 py-4 rounded-xl border"
          style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: '#fef3c7', color: '#92400e' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                {stats.unlinkedParents} student{stats.unlinkedParents !== 1 ? 's' : ''} without parent portal access
              </p>
              <p className="text-xs" style={{ color: '#b45309' }}>
                Link parent accounts via Student Directory so parents can log in
              </p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard/students/directory')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: '#fde68a', color: '#92400e', border: '1px solid #fcd34d' }}>
            Go to Directory →
          </button>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="mb-8 fade-up-3">
        <p className="section-label">Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((q) => (
            <button key={q.label} onClick={() => router.push(q.path)}
              className="action-card rounded-xl p-4 text-left"
              style={{ background: q.gradient, border: `1px solid ${q.border}`, color: '#fff' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 24px ${q.glow}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}>
              <div className="mb-2.5 opacity-90">{q.icon}</div>
              <p className="font-semibold text-sm">{q.label}</p>
              <p className="text-xs mt-0.5 opacity-75">{q.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── All modules ── */}
      <div className="fade-up-4">
        <p className="section-label">All Modules</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {modules.map((m) => (
            <button key={m.label} onClick={() => router.push(m.path)}
              className="card card-hover p-4 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: m.dot, boxShadow: `0 0 5px ${m.dot}60` }} />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{m.label}</p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)', paddingLeft: '16px' }}>{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
