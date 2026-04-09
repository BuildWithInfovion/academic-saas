'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getRoleRoute, getRoleLabel } from '@/lib/auth-utils';

type MenuItem = { label: string; path: string };

type PortalShellProps = {
  children: ReactNode;
  allowedRoles: string[];
  portalTitle: string;
  menuItems: MenuItem[];
};

export default function PortalShell({ children, allowedRoles, portalTitle, menuItems }: PortalShellProps) {
  const router   = usePathname ? useRouter() : useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user        = useAuthStore((s) => s.user);
  const loadAuth    = useAuthStore((s) => s.loadAuth);
  const logout      = useAuthStore((s) => s.logout);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => { loadAuth(); setIsHydrated(true); }, [loadAuth]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!accessToken || !user) { router.push('/'); return; }
    const hasRole = user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) router.push(getRoleRoute(user.roles));
  }, [accessToken, user, isHydrated, allowedRoles, router]);

  if (!isHydrated || !accessToken) return null;

  const roleLabel = user ? getRoleLabel(user.roles) : '';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside className="sidebar w-56 flex flex-col justify-between shrink-0 h-screen sticky top-0">
        {/* Brand */}
        <div className="overflow-y-auto flex-1">
          <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: 'var(--brand)' }}
              >
                {(user?.institutionName?.[0] ?? 'S').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate leading-tight">
                  {user?.institutionName || 'School Portal'}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#52525b' }}>
                  Powered by Infovion
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge badge-violet text-[10px] px-2 py-0.5">{roleLabel}</span>
              <span className="text-[10px]" style={{ color: '#52525b' }}>{portalTitle}</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="px-2 pt-3 pb-4">
            <p className="sidebar-section-label">Navigation</p>
            {menuItems.map((item) => {
              const active = pathname === item.path;
              return (
                <div
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`sidebar-item ${active ? 'active' : ''}`}
                >
                  {item.label}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <p className="text-xs truncate mb-2.5" style={{ color: '#52525b' }}>
            {user?.email || user?.phone}
          </p>
          <button
            onClick={() => { logout(); localStorage.removeItem('auth'); window.location.href = '/'; }}
            className="text-xs font-medium transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#ef4444')}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
