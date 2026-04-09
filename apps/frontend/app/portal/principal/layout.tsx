'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview', path: '/portal/principal' },
  { label: 'TC Approvals', path: '/portal/principal/tc' },
  { label: 'Announcements', path: '/portal/principal/announcements' },
  { label: 'Attendance Reports', path: '/portal/principal/attendance' },
  { label: 'Fee Reports', path: '/portal/principal/fees' },
];

export default function PrincipalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['principal']}
      portalTitle="Principal Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
