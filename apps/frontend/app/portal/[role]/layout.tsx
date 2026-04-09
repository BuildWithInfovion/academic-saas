'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getRoleRoute, getRoleLabel } from '@/lib/auth-utils';
import PortalShell from '@/components/portal-shell';

const PORTAL_ROLES = {
  director: ['super_admin'],
  principal: ['principal'],
  teacher: ['teacher'],
  student: ['student'],
  parent: ['parent'],
};

type PortalLayoutProps = {
  children: ReactNode;
  params: { role: keyof typeof PORTAL_ROLES };
};

export default function PortalLayout({
  children,
  params,
}: PortalLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken
