'use client';

import { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getRoleRoute, getRoleLabel } from '@/lib/auth-utils';

type MenuItem = { label: string; path: string; icon?: () => JSX.Element };

type PortalShellProps = {
  children: ReactNode;
  allowedRoles: string[];
  portalTitle: string;
  menuItems: MenuItem[];
};

function displayName(email?: string, phone?: string): string {
  if (email) {
    const prefix = email.split('@')[0];
    // Capitalise first letter, replace dots/underscores with spaces
    return prefix.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (phone) return phone;
  return 'User';
}

export default function PortalShell({ children, allowedRoles, portalTitle, menuItems }: PortalShellProps) {
  const router      = useRouter();
  const pathname    = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user        = useAuthStore((s) => s.user);
  const loadAuth    = useAuthStore((s) => s.loadAuth);
  const logout      = useAuthStore((s) => s.logout);
  const [isHydrated, setIsHydrated] = useState(false);
  const [logoError,  setLogoError]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { loadAuth(); setIsHydrated(true); }, [loadAuth]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!accessToken || !user) { router.push('/'); return; }
    const hasRole = user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) router.push(getRoleRoute(user.roles));
  }, [accessToken, user, isHydrated, allowedRoles, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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
          {/* Close button on mobile */}
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
          <span className="badge badge-violet text-[10px] px-2 py-0.5">{roleLabel}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-3 pb-4 flex-1">
        <p className="sidebar-section-label">Navigation</p>
        {menuItems.map((item) => {
          const active = pathname === item.path || (item.path.length > 1 && pathname.startsWith(item.path + '/'));
          return (
            <div
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              {item.icon && (
                <span className="shrink-0" style={{ opacity: active ? 0.9 : 0.55 }}>
                  <item.icon />
                </span>
              )}
              {item.label}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ background: 'rgba(220,146,75,0.25)', border: '1px solid rgba(220,146,75,0.3)' }}
          >
            {(user?.email?.[0] ?? user?.phone?.[0] ?? 'U').toUpperCase()}
          </div>
          <p className="text-xs truncate" style={{ color: '#9b7050' }}>
            {user?.email || user?.phone}
          </p>
        </div>
        <button
          onClick={() => { logout(); sessionStorage.removeItem('auth'); window.location.href = '/'; }}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#ef4444')}
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

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
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

      {/* ── Content ── */}
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
            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden p-1.5 rounded-lg transition-colors"
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
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{portalTitle}</p>
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

        {/* Page content */}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
