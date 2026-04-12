export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Director',
  admin: 'Operator',
  principal: 'Principal',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  receptionist: 'Desk / Reception',
};

export function getRoleRoute(roles: string[]): string {
  if (roles.includes('super_admin')) return '/portal/director';
  if (roles.includes('admin')) return '/dashboard';
  if (roles.includes('principal')) return '/portal/principal';
  if (roles.includes('teacher')) return '/portal/teacher';
  if (roles.includes('student')) return '/portal/student';
  if (roles.includes('parent')) return '/portal/parent';
  if (roles.includes('receptionist')) return '/portal/receptionist';
  return '/'; // Unknown role → back to login
}

export function getRoleLabel(roles: string[]): string {
  for (const role of ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent', 'receptionist']) {
    if (roles.includes(role)) return ROLE_LABELS[role] ?? role;
  }
  return 'Staff';
}

// Both admin (Operator) and super_admin (Director) can access /dashboard.
// Director is primarily routed to /portal/director on login but can visit /dashboard as an operations view.
export const DASHBOARD_ROLES = ['admin', 'super_admin'];
