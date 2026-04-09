'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview', path: '/portal/student' },
  { label: 'My Attendance', path: '/portal/student/attendance' },
  { label: 'My Marks', path: '/portal/student/marks' },
  { label: 'My Fees', path: '/portal/student/fees' },
  { label: 'Announcements', path: '/portal/student/announcements' },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['student']}
      portalTitle="Student Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
