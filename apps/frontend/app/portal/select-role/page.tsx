'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { silentRefresh } from '@/lib/api';
import { getRoleRoute, ROLE_LABELS, PORTAL_ROLES } from '@/lib/auth-utils';

const ROLE_ICONS: Record<string, string> = {
  principal:          '🏛️',
  teacher:            '📚',
  student:            '🎒',
  parent:             '👨‍👩‍👧',
  receptionist:       '🖥️',
  accountant:         '💰',
  non_teaching_staff: '🏢',
};

const ROLE_DESC: Record<string, string> = {
  principal:          'Manage staff, attendance & fees overview',
  teacher:            'Mark attendance, enter marks, manage classes',
  student:            'View attendance, marks & fee status',
  parent:             'Track your child\'s attendance, marks & fees',
  receptionist:       'Handle admissions, inquiries & desk tasks',
  accountant:         'Manage fee collection & financial records',
  non_teaching_staff: 'View announcements & mark your attendance',
};

export default function SelectRolePage() {
  const router        = useRouter();
  const user          = usePortalAuthStore((s) => s.user);
  const accessToken   = usePortalAuthStore((s) => s.accessToken);
  const logout        = usePortalAuthStore((s) => s.logout);
  const [ready, setReady] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (accessToken) { setReady(true); return; }
    silentRefresh().then((status) => {
      if (status === 'ok') { setReady(true); }
      else if (status === 'expired') { router.replace('/'); }
      // 'error' = transient — stay on page; user can retry.
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const currentUser = usePortalAuthStore.getState().user;
    if (!currentUser) { router.replace('/'); return; }
    const portalRoles = (currentUser.roles ?? []).filter((r) => PORTAL_ROLES.includes(r));
    if (portalRoles.length <= 1) router.replace(getRoleRoute(currentUser.roles));
  }, [ready, router]);

  if (!ready || !user) return null;

  const portalRoles = (user.roles ?? []).filter((r) => PORTAL_ROLES.includes(r));

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #fdf4e9, #f7ecdb, #faecd4)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {!logoError ? (
            <Image src="/logo.png" alt="Infovion" width={120} height={60}
              style={{ objectFit: 'contain', width: 'auto', maxHeight: 52 }}
              onError={() => setLogoError(true)} />
          ) : (
            <p className="font-bold text-xl" style={{ color: '#ae5525', letterSpacing: '0.1em' }}>INFOVION</p>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }}>
          <div className="px-7 py-5" style={{ background: 'linear-gradient(135deg,#2d1a0e,#3d1f0a)', borderBottom: '1px solid rgba(247,197,118,0.1)' }}>
            <h1 className="text-base font-bold" style={{ color: '#fcfbf7' }}>Select Your Portal</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(174,112,64,0.8)' }}>
              Your account has multiple roles. Choose how you want to proceed.
            </p>
          </div>

          <div className="p-5 space-y-3">
            {portalRoles.map((role) => (
              <button
                key={role}
                onClick={() => router.push(getRoleRoute([role]))}
                className="w-full text-left rounded-xl p-4 transition-all group"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(174,85,37,0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)';
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ROLE_ICONS[role] ?? '👤'}</span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                      {ROLE_LABELS[role] ?? role}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {ROLE_DESC[role] ?? ''}
                    </p>
                  </div>
                  <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)' }}>
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={() => {
                logout();
                void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/logout`, {
                  method: 'POST', credentials: 'include',
                }).catch(() => {});
                window.location.href = '/';
              }}
              className="w-full text-xs font-medium py-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-3)', background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              Sign out and use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
