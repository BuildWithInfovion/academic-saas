'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { getRoleRoute } from '@/lib/auth-utils';

const PORTAL_ROLES: Record<string, string[]> = {
  director: ['super_admin'],
  principal: ['principal'],
  teacher: ['teacher'],
  student: ['student'],
  parent: ['parent'],
  receptionist: ['receptionist'],
  accountant: ['accountant'],
  'non-teaching-staff': ['non_teaching_staff'],
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const role = params?.role as string;
  const { accessToken, user } = usePortalAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Defer auth check by one tick so Zustand can rehydrate from localStorage.
  // Without this, accessToken is null on the first render and the user gets
  // immediately redirected to the login page on every page load/refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsHydrated(true); }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!accessToken || !user) {
      router.replace('/');
      return;
    }

    const allowedRoles = PORTAL_ROLES[role];
    if (!allowedRoles) return;

    const hasRole = user.roles.some((r: string) => allowedRoles.includes(r));
    if (!hasRole) {
      router.replace(getRoleRoute(user.roles));
    }
  }, [isHydrated, accessToken, user, role, router]);

  if (!isHydrated) return null;

  return <>{children}</>;
}
