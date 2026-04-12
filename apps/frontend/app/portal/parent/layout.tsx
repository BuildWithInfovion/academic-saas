'use client';

import { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';

const menuItems = [
  { label: 'Overview', path: '/portal/parent' },
  { label: 'Attendance', path: '/portal/parent/attendance' },
  { label: 'Marks', path: '/portal/parent/marks' },
  { label: 'Timetable', path: '/portal/parent/timetable' },
  { label: 'Exam Schedule', path: '/portal/parent/exams' },
  { label: 'Fees', path: '/portal/parent/fees' },
  { label: 'Announcements', path: '/portal/parent/announcements' },
];

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={['parent']}
      portalTitle="Parent Portal"
      menuItems={menuItems}
    >
      {children}
    </PortalShell>
  );
}
