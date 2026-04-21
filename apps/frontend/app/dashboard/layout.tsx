'use client';

import { ReactNode, ReactElement, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { silentRefreshOp, apiFetch } from '@/lib/api';
import { getRoleRoute, getRoleLabel, DASHBOARD_ROLES } from '@/lib/auth-utils';

// Most-specific match wins — prevents parent paths staying active on child pages
function getActivePath(pathname: string): string | undefined {
  const allItems = menuGroups.flatMap((g) => g.items);
  return [...allItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || (item.path.length > 1 && pathname.startsWith(item.path + '/')))
    ?.path;
}

const Icons: Record<string, () => ReactElement> = {
  overview:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  admission:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  directory:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  inquiries:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  promote:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>,
  classes:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  subjects:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  timetable:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  calendar:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
  attendance: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  exams:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  fees:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  staff:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  announce:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>,
  settings:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  staff_att:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>,
  tc:         () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/><polyline points="16 17 18 19 22 15"/></svg>,
};

const menuGroups = [
  {
    label: 'Students',
    items: [
      { label: 'Overview',          path: '/dashboard',                    icon: 'overview'   },
      { label: 'Admission',         path: '/dashboard/students',           icon: 'admission'  },
      { label: 'Student Directory', path: '/dashboard/students/directory', icon: 'directory'  },
      { label: 'Inquiries',         path: '/dashboard/inquiries',          icon: 'inquiries'  },
      { label: 'Year-End / Promote',     path: '/dashboard/promote',            icon: 'promote'    },
      { label: 'Transfer Certificates', path: '/dashboard/tc',               icon: 'tc'         },
    ],
  },
  {
    label: 'Academics',
    items: [
      { label: 'Classes',       path: '/dashboard/classes',    icon: 'classes'    },
      { label: 'Subjects',      path: '/dashboard/subjects',   icon: 'subjects'   },
      { label: 'Timetable',     path: '/dashboard/timetable',  icon: 'timetable'  },
      { label: 'Attendance',    path: '/dashboard/attendance', icon: 'attendance' },
      { label: 'Examinations',  path: '/dashboard/exams',      icon: 'exams'      },
      { label: 'Calendar',      path: '/dashboard/calendar',   icon: 'calendar'   },
    ],
  },
  {
    label: 'Finance & Staff',
    items: [
      { label: 'Fees',              path: '/dashboard/fees',              icon: 'fees'      },
      { label: 'Staff',             path: '/dashboard/staff',             icon: 'staff'     },
      { label: 'Staff Attendance',  path: '/dashboard/staff-attendance',  icon: 'staff_att' },
      { label: 'Announcements',     path: '/dashboard/announcements',     icon: 'announce'  },
      { label: 'Settings',          path: '/dashboard/settings',          icon: 'settings'  },
    ],
  },
];

function displayName(name?: string | null, email?: string | null, phone?: string | null): string {
  if (name) return name;
  if (email) {
    const prefix = email.split('@')[0];
    return prefix.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (phone) return phone;
  return 'User';
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router      = useRouter();
  const pathname    = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user        = useAuthStore((s) => s.user);
  const logout      = useAuthStore((s) => s.logout);
  const [ready,      setReady]      = useState(false);
  const [connError,  setConnError]  = useState(false);
  const [logoError,  setLogoError]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Support ticket modal
  const [supportOpen,    setSupportOpen]    = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportDone,    setSupportDone]    = useState(false);
  const [supportError,   setSupportError]   = useState<string | null>(null);

  const SUPPORT_TOPICS = [
    'Login / Access Issue',
    'Student Data Issue',
    'Fee / Payment Issue',
    'Attendance Issue',
    'Exam / Marks Issue',
    'Report / Download Issue',
    'Admission / Enrollment Issue',
    'Settings / Configuration',
    'Other',
  ];

  const submitSupport = async () => {
    if (!supportSubject || !supportMessage.trim()) return;
    setSupportSending(true);
    setSupportError(null);
    try {
      await apiFetch('/support/ticket', {
        method: 'POST',
        body: JSON.stringify({ subject: supportSubject, message: supportMessage.trim() }),
      });
      setSupportDone(true);
      setSupportSubject('');
      setSupportMessage('');
      setTimeout(() => { setSupportOpen(false); setSupportDone(false); }, 2000);
    } catch (e: unknown) {
      setSupportError(e instanceof Error ? e.message : 'Failed to submit ticket. Please try again.');
    } finally { setSupportSending(false); }
  };

  // On mount: if token is already in memory (same-tab navigation), proceed.
  // Otherwise attempt a silent refresh via the httpOnly auth_rt cookie.
  // Middleware already redirects to / when the cookie is absent, so failure
  // here is an edge case (cookie valid but server unreachable).
  useEffect(() => {
    // Read getState() here — React effects run after all microtasks including
    // zustand's sessionStorage hydration, so the token is already restored.
    const cached = useAuthStore.getState().accessToken;
    if (cached) { setReady(true); return; }
    silentRefreshOp().then((status) => {
      if (status === 'ok') {
        setReady(true);
      } else if (status === 'expired') {
        router.replace('/');
      } else {
        setConnError(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    const hasDashboardRole = currentUser.roles.some((r) => DASHBOARD_ROLES.includes(r));
    if (!hasDashboardRole) router.push(getRoleRoute(currentUser.roles));
  }, [ready, router]);

  if (connError) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center space-y-3">
        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Unable to connect to the server.</p>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>Check your connection and try again.</p>
        <button
          onClick={() => { setConnError(false); window.location.reload(); }}
          className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'var(--brand)' }}
        >
          Retry
        </button>
      </div>
    </div>
  );

  if (!ready || !accessToken) return null;

  const roleLabel    = user ? getRoleLabel(user.roles) : '';
  const userName     = user ? displayName(user.name, user.email, user.phone) : '';
  const activeNavPath = getActivePath(pathname);

  const sidebarContent = (
    <div className="overflow-y-auto flex-1 flex flex-col">
      {/* Brand — Infovion logo only */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center justify-between">
          {!logoError ? (
            <Image
              src="/logo.png"
              alt="Infovion"
              width={100}
              height={40}
              style={{ objectFit: 'contain', width: 'auto', maxHeight: 36 }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <p className="font-bold text-sm" style={{ color: '#f7c576', letterSpacing: '0.08em' }}>
              INFOVION
            </p>
          )}
          {/* Close button — mobile */}
          <button
            className="lg:hidden p-1 rounded"
            onClick={() => setSidebarOpen(false)}
            style={{ color: '#c4956a' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          <span className="badge badge-violet text-[10px]">{roleLabel}</span>
          {user?.institutionName && (
            <p className="text-[11px] font-semibold truncate" style={{ color: '#f7c576' }}>
              {user.institutionName}
            </p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-3 pb-4 flex-1">
        {menuGroups.map((group) => (
          <div key={group.label}>
            <p className="sidebar-section-label">{group.label}</p>
            {group.items.map((item) => {
              const active = item.path === activeNavPath;
              const IconComp = Icons[item.icon];
              return (
                <div key={item.path} onClick={() => router.push(item.path)}
                  className={`sidebar-item ${active ? 'active' : ''}`}>
                  <span className="shrink-0" style={{ opacity: active ? 0.9 : 0.55 }}>
                    <IconComp />
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ background: 'rgba(220,146,75,0.25)', border: '1px solid rgba(220,146,75,0.3)' }}>
            {(user?.email?.[0] ?? user?.phone?.[0] ?? 'U').toUpperCase()}
          </div>
          <p className="text-xs truncate" style={{ color: '#9b7050' }}>{user?.email || user?.phone}</p>
        </div>
        <button
          onClick={() => {
            const token = useAuthStore.getState().accessToken ?? '';
            void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/logout`, {
              method: 'POST', credentials: 'include',
              headers: { 'Authorization': `Bearer ${token}` },
            }).finally(() => {
              logout();
              window.location.href = '/';
            });
          }}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
        <button
          onClick={() => { setSupportOpen(true); setSupportError(null); setSupportSubject(''); setSupportMessage(''); }}
          className="flex items-center gap-1.5 text-xs font-medium mt-2 transition-colors"
          style={{ color: '#c4956a' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f7c576'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#c4956a'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Get Support
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* Support Modal */}
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
                  {supportError && (
                    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                      {supportError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Issue Type</label>
                    <select
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: supportSubject ? 'var(--text-1)' : 'var(--text-3)' }}
                    >
                      <option value="">Select an issue type…</option>
                      {SUPPORT_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Message</label>
                    <textarea
                      rows={4}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe your issue in detail…"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setSupportOpen(false); setSupportError(null); }}
                      className="flex-1 py-2 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void submitSupport()}
                      disabled={supportSending || !supportSubject || !supportMessage.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: 'var(--brand)' }}
                    >
                      {supportSending ? 'Sending…' : 'Submit Ticket'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          sidebar flex flex-col justify-between shrink-0 h-screen sticky top-0 z-40
          w-56 transition-transform duration-200
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0 fixed' : '-translate-x-full fixed lg:relative'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto flex flex-col min-h-screen">
        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-5 py-3"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile */}
            <button
              className="lg:hidden p-1.5 rounded-lg"
              style={{ color: 'var(--text-2)' }}
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-1)' }}>
                {user?.institutionName || 'School Portal'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--brand)' }}
            >
              {(user?.email?.[0] ?? user?.phone?.[0] ?? 'U').toUpperCase()}
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>
                {userName}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{roleLabel}</p>
            </div>
          </div>
        </header>

        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
