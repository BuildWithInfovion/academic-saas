'use client';

import { ReactNode, ReactElement, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { silentRefresh, apiFetch } from '@/lib/api';
import { getRoleRoute, getRoleLabel } from '@/lib/auth-utils';
import { SUPPORT_TOPICS } from '@/lib/constants';

type MenuItem = { label: string; path: string; icon?: () => ReactElement };

type PortalShellProps = {
  children: ReactNode;
  allowedRoles: string[];
  portalTitle: string;
  menuItems: MenuItem[];
};

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp as number) * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

function displayName(name?: string | null, email?: string, phone?: string): string {
  if (name?.trim()) return name.trim();
  if (email) {
    const prefix = email.split('@')[0];
    return prefix.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (phone) return phone;
  return 'User';
}

export default function PortalShell({ children, allowedRoles, portalTitle, menuItems }: PortalShellProps) {
  const router      = useRouter();
  const pathname    = usePathname();
  const accessToken = usePortalAuthStore((s) => s.accessToken);
  const user        = usePortalAuthStore((s) => s.user);
  const logout      = usePortalAuthStore((s) => s.logout);
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

  // On mount: effects run after zustand's sessionStorage hydration, so getState()
  // already has the cached token. Avoids a network round-trip on every page refresh.
  useEffect(() => {
    const cached = usePortalAuthStore.getState().accessToken;
    if (cached && !isJwtExpired(cached)) { setReady(true); return; }
    silentRefresh().then((status) => {
      if (status === 'ok') { setReady(true); }
      else if (status === 'expired') { router.replace('/'); }
      else { setConnError(true); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After session is ready, enforce role access.
  useEffect(() => {
    if (!ready) return;
    const currentUser = usePortalAuthStore.getState().user;
    if (!currentUser) { router.replace('/'); return; }
    const hasRole = currentUser.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) router.replace(getRoleRoute(currentUser.roles));
  }, [ready, allowedRoles, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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

  const roleLabel = user ? getRoleLabel(user.roles) : '';
  const userName  = user ? displayName(user.name, user.email, user.phone) : '';

  // Most-specific match wins — prevents parent paths staying highlighted on sub-pages
  const activeItemPath = [...menuItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find((m) => pathname === m.path || (m.path.length > 1 && pathname.startsWith(m.path + '/')))
    ?.path;

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
      <nav className="px-2 pt-1 pb-4 flex-1">
        <p className="sidebar-section-label">Navigation</p>
        {menuItems.map((item) => {
          const active = item.path === activeItemPath;
          return (
            <Link
              key={item.path}
              href={item.path}
              prefetch={true}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              {item.icon && (
                <span className="shrink-0" style={{ opacity: active ? 0.9 : 0.55 }}>
                  <item.icon />
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </Link>
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
            {(user?.name?.[0] ?? user?.email?.[0] ?? user?.phone?.[0] ?? 'U').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#c4956a' }}>{userName}</p>
            {user?.email && <p className="text-[10px] truncate" style={{ color: '#7a5538' }}>{user.email}</p>}
          </div>
        </div>
        <button
          onClick={() => { setSupportOpen(true); setSupportError(null); setSupportSubject(''); setSupportMessage(''); }}
          className="flex items-center gap-1.5 text-xs font-medium mb-2 transition-colors"
          style={{ color: '#c4956a' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f7c576')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#c4956a')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Get Support
        </button>
        <button
          onClick={() => {
            const token = usePortalAuthStore.getState().accessToken ?? '';
            void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/logout`, {
              method: 'POST', credentials: 'include',
              headers: { 'Authorization': `Bearer ${token}` },
            }).finally(() => {
              logout();
              window.location.href = '/';
            });
          }}
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
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

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

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
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
              {(user?.name?.[0] ?? user?.email?.[0] ?? user?.phone?.[0] ?? 'U').toUpperCase()}
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
