'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { apiFetch } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';

interface Stats        { totalStudents: number; unlinkedParents: number; boys: number; girls: number; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface FeeSummary   { todayTotal: number; monthTotal: number; totalDue: number; totalStudents: number; }
interface TrendPoint   { month: string; label: string; amount: number; }
interface ClassStat    { unitId: string; name: string; percentage: number; totalRecords: number; }

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const router          = useRouter();
  const user            = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [stats,       setStats]       = useState<Stats | null>(null);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [feeSummary,  setFeeSummary]  = useState<FeeSummary | null>(null);
  const [trend,       setTrend]       = useState<TrendPoint[]>([]);
  const [classStat,   setClassStat]   = useState<ClassStat[]>([]);

  const [supportOpen,    setSupportOpen]    = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportDone,    setSupportDone]    = useState(false);
  const [supportError,   setSupportError]   = useState<string | null>(null);

  const SUPPORT_TOPICS = [
    'Login / Access Issue','Student Data Issue','Fee / Payment Issue',
    'Attendance Issue','Exam / Marks Issue','Report / Download Issue',
    'Admission / Enrollment Issue','Settings / Configuration','Other',
  ];

  const submitSupport = async () => {
    if (!supportSubject || !supportMessage.trim()) return;
    setSupportSending(true); setSupportError(null);
    try {
      await apiFetch('/support/ticket', { method: 'POST', body: JSON.stringify({ subject: supportSubject, message: supportMessage.trim() }) });
      setSupportDone(true); setSupportSubject(''); setSupportMessage('');
      setTimeout(() => { setSupportOpen(false); setSupportDone(false); }, 2000);
    } catch (e: unknown) {
      setSupportError(e instanceof Error ? e.message : 'Failed to submit ticket.');
    } finally { setSupportSending(false); }
  };

  const todayDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  useEffect(() => {
    if (!isAuthenticated) return;
    const now = new Date();
    Promise.allSettled([
      apiFetch('/students/count'),
      apiFetch('/academic/years'),
      apiFetch('/fees/payments/summary'),
      apiFetch('/fees/payments/monthly-trend?months=6'),
      apiFetch(`/attendance/class-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
    ]).then(([s, y, fs, tr, cs]) => {
      if (s.status === 'fulfilled') setStats(s.value as Stats);
      if (y.status === 'fulfilled') {
        const years: AcademicYear[] = Array.isArray(y.value) ? y.value : ((y.value as { data?: AcademicYear[] }).data ?? []);
        setCurrentYear(years.find((yr) => yr.isCurrent) ?? null);
      }
      if (fs.status === 'fulfilled') setFeeSummary(fs.value as FeeSummary);
      if (tr.status === 'fulfilled') setTrend(Array.isArray(tr.value) ? tr.value : []);
      if (cs.status === 'fulfilled') setClassStat(Array.isArray(cs.value) ? cs.value.slice(0, 10) : []);
    });
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center"><p style={{ color: 'var(--text-3)' }}>Redirecting…</p></div>;

  const statCards = [
    {
      label: 'Total Students', value: stats?.totalStudents ?? '—',
      sub: stats ? `Boys ${stats.boys} · Girls ${stats.girls}` : 'Loading…',
      accent: 'stat-accent-violet', iconBg: '#fdf0e0', iconColor: '#ae5525',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
    },
    {
      label: 'Today Collection', value: feeSummary ? formatINR(feeSummary.todayTotal) : '—',
      sub: feeSummary ? `Month: ${formatINR(feeSummary.monthTotal)}` : 'Loading…',
      accent: 'stat-accent-emerald', iconBg: '#d8f3dc', iconColor: '#2d6a4f',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: 'Outstanding Dues', value: feeSummary ? formatINR(feeSummary.totalDue) : '—',
      sub: 'Current academic year',
      accent: 'stat-accent-amber', iconBg: '#fff3cd', iconColor: '#9c6f00',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    },
    {
      label: 'Support', value: 'Help', sub: 'Raise a ticket',
      accent: 'stat-accent-blue', iconBg: '#f7ecdb', iconColor: '#6b432f',
      onClick: true,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    },
  ];

  const quickActions = [
    { label: 'New Admission', desc: 'Admit a new student', path: '/dashboard/students', gradient: 'linear-gradient(135deg,#ae5525 0%,#8c3919 100%)', glow: 'rgba(174,85,37,0.45)', border: 'rgba(140,57,25,0.3)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
    { label: 'Mark Attendance', desc: "Today's class attendance", path: '/dashboard/attendance', gradient: 'linear-gradient(135deg,#0d9488 0%,#0f766e 100%)', glow: 'rgba(13,148,136,0.45)', border: 'rgba(15,118,110,0.3)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { label: 'Collect Fee', desc: 'Record fee payment', path: '/dashboard/fees', gradient: 'linear-gradient(135deg,#dc924b 0%,#ae7040 100%)', glow: 'rgba(220,146,75,0.45)', border: 'rgba(174,112,64,0.3)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { label: 'Enter Marks', desc: 'Exam score entry', path: '/dashboard/exams', gradient: 'linear-gradient(135deg,#6b432f 0%,#423129 100%)', glow: 'rgba(107,67,47,0.45)', border: 'rgba(66,49,41,0.3)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> },
  ];

  const modules = [
    { label: 'Inquiries',         desc: 'Admission lead pipeline',           path: '/dashboard/inquiries',          dot: '#ae5525' },
    { label: 'Student Directory', desc: 'Search and manage student profiles', path: '/dashboard/students/directory', dot: '#dc924b' },
    { label: 'Classes',           desc: 'Academic units & sections',          path: '/dashboard/classes',            dot: '#2d6a4f' },
    { label: 'Subjects',          desc: 'Subject master & class mapping',     path: '/dashboard/subjects',           dot: '#8c3919' },
    { label: 'Timetable',         desc: 'Weekly class schedule',              path: '/dashboard/timetable',          dot: '#c5692e' },
    { label: 'Examinations',      desc: 'Exams, marks & scorecards',          path: '/dashboard/exams',              dot: '#6b432f' },
    { label: 'Fees',              desc: 'Collections, receipts & dues',       path: '/dashboard/fees',               dot: '#dc924b' },
    { label: 'Announcements',     desc: 'Broadcast to all portals',           path: '/dashboard/announcements',      dot: '#ae5525' },
    { label: 'Staff',             desc: 'Staff profiles & credentials',       path: '/dashboard/staff',              dot: '#2d6a4f' },
    { label: 'Salary',            desc: 'Staff salary & payslips',            path: '/dashboard/salary',             dot: '#6b432f' },
    { label: 'Calendar',          desc: 'School events & holidays',           path: '/dashboard/calendar',           dot: '#c5692e' },
    { label: 'Audit Log',         desc: 'Activity trail & security events',   path: '/dashboard/audit',              dot: '#8c3919' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="page-header mb-8 fade-up-1">
        <div>
          <h1 className="page-title">
            {greeting},{' '}
            <span style={{ color: '#ae5525' }}>{user?.name || user?.email?.split('@')[0] || 'Admin'}</span>
          </h1>
          <p className="page-subtitle">{todayDate}{currentYear ? ` · AY ${currentYear.name}` : ''}</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
          style={{ background: '#fdf0e0', border: '1px solid #e8d5bc', color: '#ae5525' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d6a4f', boxShadow: '0 0 5px rgba(45,106,79,0.6)', display: 'inline-block' }} />
          System Online
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 fade-up-2">
        {statCards.map((s) => (
          <div key={s.label}
            className={`card card-hover ${s.accent} p-5 ${'onClick' in s ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={'onClick' in s ? () => { setSupportOpen(true); setSupportError(null); setSupportSubject(''); setSupportMessage(''); } : undefined}>
            <div className="mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.iconBg, color: s.iconColor }}>
                {s.icon}
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.025em', lineHeight: 1 }}>{s.value}</p>
            <p className="text-sm font-medium mt-1.5" style={{ color: 'var(--text-2)' }}>{s.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 fade-up-3">

        {/* Fee collection trend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Fee Collection Trend</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Last 6 months</p>
            </div>
            <button onClick={() => router.push('/dashboard/fees')}
              className="text-xs font-medium px-3 py-1 rounded-lg"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              View all →
            </button>
          </div>
          {trend.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>No payment data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  formatter={(v: unknown) => [formatINR(Number(v)), 'Collected']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--brand-subtle)' }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {trend.map((_, i) => (
                    <Cell key={i} fill={i === trend.length - 1 ? '#ae5525' : '#dc924b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance by class */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Attendance This Month</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>% present by class</p>
            </div>
            <button onClick={() => router.push('/dashboard/attendance')}
              className="text-xs font-medium px-3 py-1 rounded-lg"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              View all →
            </button>
          </div>
          {classStat.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>No attendance data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={classStat} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  formatter={(v: unknown) => [`${Number(v)}%`, 'Attendance']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--brand-subtle)' }}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                  {classStat.map((c, i) => (
                    <Cell key={i} fill={c.percentage >= 75 ? '#2d6a4f' : c.percentage >= 60 ? '#dc924b' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Unlinked Parents Alert ── */}
      {stats && stats.unlinkedParents > 0 && (
        <div className="mb-6 fade-up-3 flex items-center justify-between px-5 py-4 rounded-xl border"
          style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#fef3c7', color: '#92400e' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                {stats.unlinkedParents} student{stats.unlinkedParents !== 1 ? 's' : ''} without parent portal access
              </p>
              <p className="text-xs" style={{ color: '#b45309' }}>Link parent accounts via Student Directory</p>
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
      <div className="mb-8 fade-up-4">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {modules.map((m) => (
            <button key={m.label} onClick={() => router.push(m.path)} className="card card-hover p-4 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.dot, boxShadow: `0 0 5px ${m.dot}60` }} />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{m.label}</p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)', paddingLeft: '16px' }}>{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Support Modal ── */}
      {supportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {supportDone ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f0fdf4' }}>
                  <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Ticket submitted!</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Our team will get back to you shortly.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Get Support</h2>
                  <button onClick={() => setSupportOpen(false)} style={{ color: 'var(--text-3)' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="space-y-3">
                  {supportError && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{supportError}</div>}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Issue Type</label>
                    <select value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: supportSubject ? 'var(--text-1)' : 'var(--text-3)' }}>
                      <option value="">Select an issue type…</option>
                      {SUPPORT_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Message</label>
                    <textarea rows={4} value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe your issue in detail…"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setSupportOpen(false); setSupportError(null); }}
                      className="flex-1 py-2 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>Cancel</button>
                    <button onClick={() => void submitSupport()}
                      disabled={supportSending || !supportSubject || !supportMessage.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: 'var(--brand)' }}>
                      {supportSending ? 'Sending…' : 'Submit Ticket'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
