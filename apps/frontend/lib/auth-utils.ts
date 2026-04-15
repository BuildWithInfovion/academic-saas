export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Director',
  admin: 'Operator',
  principal: 'Principal',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  receptionist: 'Desk / Reception',
  accountant: 'Accountant',
  non_teaching_staff: 'Non-Teaching Staff',
};

export function getRoleRoute(roles: string[]): string {
  if (roles.includes('super_admin')) return '/portal/director';
  if (roles.includes('admin')) return '/dashboard';
  if (roles.includes('principal')) return '/portal/principal';
  if (roles.includes('teacher')) return '/portal/teacher';
  if (roles.includes('student')) return '/portal/student';
  if (roles.includes('parent')) return '/portal/parent';
  if (roles.includes('receptionist')) return '/portal/receptionist';
  if (roles.includes('accountant')) return '/portal/accountant';
  if (roles.includes('non_teaching_staff')) return '/portal/non-teaching-staff';
  return '/'; // Unknown role → back to login
}

export function getRoleLabel(roles: string[]): string {
  for (const role of ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent', 'receptionist', 'accountant', 'non_teaching_staff']) {
    if (roles.includes(role)) return ROLE_LABELS[role] ?? role;
  }
  return 'Staff';
}

// Both admin (Operator) and super_admin (Director) can access /dashboard.
// Director is primarily routed to /portal/director on login but can visit /dashboard as an operations view.
export const DASHBOARD_ROLES = ['admin', 'super_admin'];

// All roles that land in a portal (not dashboard). Used to detect multi-role users
// who need to pick a portal on login. Must stay in sync with getRoleRoute() above.
export const PORTAL_ROLES = [
  'principal',
  'teacher',
  'student',
  'parent',
  'receptionist',
  'accountant',
  'non_teaching_staff',
] as const;
