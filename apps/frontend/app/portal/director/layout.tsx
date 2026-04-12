'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview',     path: '/portal/director' },
  { label: 'Reports',      path: '/portal/director/reports' },
  { label: 'Staff',        path: '/portal/director/staff' },
  { label: 'School Info',  path: '/portal/director/settings' },
];

export default function DirectorLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['super_admin']}
      portalTitle="Director Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
