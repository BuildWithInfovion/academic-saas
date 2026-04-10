'use client';

import { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getRoleRoute, getRoleLabel } from '@/lib/auth-utils';

const DASHBOARD_ROLES = ['admin', 'super_admin'];

const Icons: Record<string, () => JSX.Element> = {
  overview:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  admission:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  directory:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  inquiries:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  promote:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>,
  classes:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  subjects:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  timetable:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  attendance: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  exams:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  fees:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  staff:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  announce:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>,
  settings:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  staff_att:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>,
};

const menuGroups = [
  {
    label: 'Students',
    items: [
      { label: 'Overview',          path: '/dashboard',                    icon: 'overview'   },
      { label: 'Admission',         path: '/dashboard/students',           icon: 'admission'  },
      { label: 'Student Directory', path: '/dashboard/students/directory', icon: 'directory'  },
      { label: 'Inquiries',         path: '/dashboard/inquiries',          icon: 'inquiries'  },
      { label: 'Promote',           path: '/dashboard/promote',            icon: 'promote'    },
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

function displayName(email?: string | null, phone?: string | null): string {
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
  const loadAuth    = useAuthStore((s) => s.loadAuth);
  const logout      = useAuthStore((s) => s.logout);
  const [isHydrated, setIsHydrated]   = useState(false);
  const [logoError,  setLogoError]    = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { loadAuth(); }, [loadAuth]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsHydrated(true); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!accessToken || !user) { router.push('/'); return; }
    const hasDashboardRole = user.roles.some((r) => DASHBOARD_ROLES.includes(r));
    if (!hasDashboardRole) router.push(getRoleRoute(user.roles));
  }, [accessToken, user, isHydrated, router]);

  if (!isHydrated || !accessToken) return null;

  const roleLabel = user ? getRoleLabel(user.roles) : '';
  const userName  = user ? displayName(user.email, user.phone) : '';

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
        <div className="mt-3">
          <span className="badge badge-violet text-[10px]">{roleLabel}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-3 pb-4 flex-1">
        {menuGroups.map((group) => (
          <div key={group.label}>
            <p className="sidebar-section-label">{group.label}</p>
            {group.items.map((item) => {
              const active = pathname === item.path ||
                (item.path !== '/dashboard' && pathname.startsWith(item.path));
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
          onClick={() => { logout(); sessionStorage.removeItem('auth'); window.location.href = '/'; }}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: '#6b7280' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>

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
