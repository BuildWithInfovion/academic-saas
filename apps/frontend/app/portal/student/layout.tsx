'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

export default function StudentPortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['student']}
      portalTitle="Student Portal"
      menuItems={[
        { label: 'Overview', path: '/portal/student' },
      ]}
    >
      {children}
    </PortalShell>
  );
}
