'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview',       path: '/portal/teacher' },
  { label: 'Attendance',     path: '/portal/teacher/attendance' },
  { label: 'Mark Entry',     path: '/portal/teacher/marks' },
  { label: 'Promote',        path: '/portal/teacher/promote' },
  { label: 'My Attendance',  path: '/portal/teacher/staff-attendance' },
  { label: 'Announcements',  path: '/portal/teacher/announcements' },
];

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['teacher']}
      portalTitle="Teacher Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
