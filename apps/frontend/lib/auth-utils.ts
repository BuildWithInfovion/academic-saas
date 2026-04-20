export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Director',
  admin: 'Operator',
  principal: 'Principal',
  teacher: 'Teacher',
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
  if (roles.includes('parent')) return '/portal/parent';
  if (roles.includes('receptionist')) return '/portal/receptionist';
  if (roles.includes('accountant')) return '/portal/accountant';
  if (roles.includes('non_teaching_staff')) return '/portal/non-teaching-staff';
  return '/'; // Unknown role → back to login
}

export function getRoleLabel(roles: string[]): string {
  for (const role of ['super_admin', 'admin', 'principal', 'teacher', 'parent', 'receptionist', 'accountant', 'non_teaching_staff']) {
    if (roles.includes(role)) return ROLE_LABELS[role] ?? role;
  }
  return 'Staff';
}

// Only 'admin' (Operator) uses the dashboard store and auth_rt_op cookie.
// 'super_admin' (Director) gets auth_rt (portal cookie) and lives in usePortalAuthStore,
// landing at /portal/director — not /dashboard.
export const DASHBOARD_ROLES = ['admin'];

// All roles that land in a portal (not dashboard). Used to detect multi-role users
// who need to pick a portal on login. Must stay in sync with getRoleRoute() above.
// Note: 'student' is intentionally excluded — the student portal is not active.
export const PORTAL_ROLES = [
  'super_admin',
  'principal',
  'teacher',
  'parent',
  'receptionist',
  'accountant',
  'non_teaching_staff',
] as const;
