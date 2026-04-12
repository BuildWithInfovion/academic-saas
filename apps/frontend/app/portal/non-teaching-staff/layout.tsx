'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview',       path: '/portal/non-teaching-staff' },
  { label: 'My Attendance',  path: '/portal/non-teaching-staff/staff-attendance' },
  { label: 'Announcements',  path: '/portal/non-teaching-staff/announcements' },
];

export default function NonTeachingStaffLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['non_teaching_staff']}
      portalTitle="Staff Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
