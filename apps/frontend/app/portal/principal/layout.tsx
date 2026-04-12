'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview',            path: '/portal/principal' },
  { label: 'Timetable',           path: '/portal/principal/timetable' },
  { label: 'Exam Results',        path: '/portal/principal/exams' },
  { label: 'Attendance Reports',  path: '/portal/principal/attendance' },
  { label: 'Staff Attendance',    path: '/portal/principal/staff-attendance' },
  { label: 'Fee Reports',         path: '/portal/principal/fees' },
  { label: 'Announcements',       path: '/portal/principal/announcements' },
  { label: 'Settings',            path: '/portal/principal/settings' },
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
