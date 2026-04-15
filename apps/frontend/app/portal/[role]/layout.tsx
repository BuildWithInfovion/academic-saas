'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { silentRefresh } from '@/lib/api';
import { getRoleRoute } from '@/lib/auth-utils';

const PORTAL_ROLES: Record<string, string[]> = {
  director: ['super_admin'],
  principal: ['principal'],
  teacher: ['teacher'],
  parent: ['parent'],
  receptionist: ['receptionist'],
  accountant: ['accountant'],
  'non-teaching-staff': ['non_teaching_staff'],
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const role = params?.role as string;
  const { accessToken } = usePortalAuthStore();
  const [ready, setReady] = useState(false);
  const [connError, setConnError] = useState(false);

  // On mount: if token is already in memory (same-tab navigation), proceed.
  // Otherwise attempt a silent refresh via the httpOnly auth_rt cookie.
  // Middleware already redirects to / when the cookie is absent, so failure
  // here is an edge case (cookie expired after middleware check).
  useEffect(() => {
    if (accessToken) { setReady(true); return; }
    silentRefresh().then((status) => {
      if (status === 'ok') {
        setReady(true);
      } else if (status === 'expired') {
        router.replace('/');
      } else {
        setConnError(true);
      }
      // 'error' = transient network/server issue — show retry prompt, not forced logout.
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const currentUser = usePortalAuthStore.getState().user;
    if (!currentUser) return;

    const allowedRoles = PORTAL_ROLES[role];
    if (!allowedRoles) return;

    const hasRole = currentUser.roles.some((r: string) => allowedRoles.includes(r));
    if (!hasRole) {
      router.replace(getRoleRoute(currentUser.roles));
    }
  }, [ready, role, router]);

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

  return <>{children}</>;
}
