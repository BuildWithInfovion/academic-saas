'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview',          path: '/portal/accountant' },
  { label: 'Fee Collection',    path: '/portal/accountant/fees' },
  { label: 'My Attendance',     path: '/portal/accountant/staff-attendance' },
  { label: 'Announcements',     path: '/portal/accountant/announcements' },
];

export default function AccountantLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['accountant']}
      portalTitle="Accountant Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
