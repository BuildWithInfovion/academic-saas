'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Inquiries', path: '/portal/receptionist' },
  { label: 'Announcements', path: '/portal/receptionist/announcements' },
];

export default function ReceptionistLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['receptionist']}
      portalTitle="Reception Desk"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
