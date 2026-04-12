/**
 * clean.ts — Full database wipe
 * ─────────────────────────────────────────────────────────────────────────────
 * Deletes ALL institutions and every record that cascades from them.
 * The only table left untouched is platform_admins so the dev platform
 * login still works after the wipe.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register prisma/clean.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

async function main() {
  console.log('🧹  Full database wipe starting...\n');
  await prisma.$connect();
  console.log('✅  Connected\n');

  // Count before so the output is informative
  const [institutions, students, users, auditLogs] = await Promise.all([
    prisma.institution.count(),
    prisma.student.count(),
    prisma.user.count(),
    prisma.auditLog.count(),
  ]);

  console.log('  Before wipe:');
  console.log(`    Institutions : ${institutions}`);
  console.log(`    Students     : ${students}`);
  console.log(`    Users        : ${users}`);
  console.log(`    Audit logs   : ${auditLogs}`);
  console.log();

  // Deleting all institutions cascades to every related table:
  // users, roles, user_roles, students, academic_years, academic_units,
  // subjects, attendance_sessions, attendance_records, fee_heads,
  // fee_structures, fee_payments, exams, exam_subjects, exam_results,
  // announcements, timetable_slots, inquiries, audit_logs,
  // refresh_tokens, password_reset_requests, subscriptions,
  // staff_attendance, staff_leave_requests
  const deleted = await prisma.institution.deleteMany({});
  console.log(`✅  Deleted ${deleted.count} institution(s) + all cascaded tenant data`);

  // platform_admins has no institution FK — intentionally left intact
  const platformAdmins = await prisma.platformAdmin.count();
  console.log(`✅  Platform admins preserved: ${platformAdmins}`);

  console.log('\n🎉  Wipe complete. Database is empty and ready for fresh onboarding.');
  console.log('    Log in at: http://localhost:3001/platform/login');
  console.log('    Email   : dev@infovion.in');
  console.log('    Password: platform@dev123\n');
}

main()
  .catch((e) => { console.error('❌  Wipe failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
