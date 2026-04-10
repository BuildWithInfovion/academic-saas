/**
 * Database Cleanup Script
 * Deletes all tenant data EXCEPT the anchor institution (infovion).
 * Resets infovion to clean state — removes all dummy students, fake schools,
 * test data. Keeps only the institution record, roles, and seed users.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

const ANCHOR_INSTITUTION_ID = 'cmms6jl0k0000q3repb3w13hv';

async function main() {
  console.log('🧹 Starting database cleanup...\n');

  await prisma.$connect();
  console.log('✅ Connected to database\n');

  // ── 1. Delete ALL other institutions (fake/demo schools onboarded via platform) ──
  const otherInstitutions = await prisma.institution.findMany({
    where: { id: { not: ANCHOR_INSTITUTION_ID } },
    select: { id: true, name: true, code: true },
  });

  if (otherInstitutions.length > 0) {
    console.log(`Found ${otherInstitutions.length} other institution(s) to delete:`);
    for (const inst of otherInstitutions) {
      console.log(`  - ${inst.name} (${inst.code})`);
    }
    await prisma.institution.deleteMany({
      where: { id: { not: ANCHOR_INSTITUTION_ID } },
    });
    console.log('✅ Other institutions deleted\n');
  } else {
    console.log('✅ No other institutions found\n');
  }

  // ── 2. Clean anchor institution tenant data (keep institution + roles + seed users) ──
  console.log(`Cleaning anchor institution: ${ANCHOR_INSTITUTION_ID}`);

  // Exam data
  const examResults = await prisma.examResult.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${examResults.count} exam results`);

  // ExamSubject has no institutionId — deleted via cascade from Exam above
  // (already handled by exam deleteMany cascade)
  const examSubjects = { count: 0 };
  console.log(`  Exam subjects deleted via cascade`);

  const exams = await prisma.exam.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${exams.count} exams`);

  // Attendance
  const attendanceRecords = await prisma.attendanceRecord.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${attendanceRecords.count} attendance records`);

  const attendanceSessions = await prisma.attendanceSession.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${attendanceSessions.count} attendance sessions`);

  // Fees
  const feePayments = await prisma.feePayment.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${feePayments.count} fee payments`);

  const feeStructures = await prisma.feeStructure.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${feeStructures.count} fee structures`);

  const feeHeads = await prisma.feeHead.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${feeHeads.count} fee heads`);

  // Students
  const students = await prisma.student.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${students.count} students`);

  // Inquiries
  const inquiries = await prisma.inquiry.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${inquiries.count} inquiries`);

  // Announcements
  const announcements = await prisma.announcement.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${announcements.count} announcements`);

  // Subjects + unit assignments
  const unitSubjects = await prisma.academicUnitSubject.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${unitSubjects.count} unit-subject assignments`);

  const subjects = await prisma.subject.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${subjects.count} subjects`);

  // Timetable
  const timetable = await prisma.timetableSlot.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${timetable.count} timetable slots`);

  // Academic units (classes) + years
  const academicUnits = await prisma.academicUnit.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${academicUnits.count} academic units`);

  const academicYears = await prisma.academicYear.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${academicYears.count} academic years`);

  // Password reset requests
  const resetRequests = await prisma.passwordResetRequest.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${resetRequests.count} password reset requests`);

  // Audit logs
  const auditLogs = await prisma.auditLog.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${auditLogs.count} audit logs`);

  // Refresh tokens
  const refreshTokens = await prisma.refreshToken.deleteMany({ where: { institutionId: ANCHOR_INSTITUTION_ID } });
  console.log(`  Deleted ${refreshTokens.count} refresh tokens`);

  // ── 3. Delete non-seed users (keep only admin + operator seed users) ──
  const seedEmails = ['admin@infovion.in', 'operator@infovion.in'];
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      institutionId: ANCHOR_INSTITUTION_ID,
      email: { notIn: seedEmails },
    },
  });
  console.log(`  Deleted ${deletedUsers.count} non-seed users`);

  // ── 4. Delete platform admin data (subscriptions, keep platform admin account) ──
  const subscriptions = await prisma.subscription.deleteMany({});
  console.log(`\n  Deleted ${subscriptions.count} subscriptions`);

  console.log('\n✅ Cleanup complete!\n');
  console.log('Run seed next to restore clean demo data:');
  console.log('  npx ts-node -r tsconfig-paths/register prisma/seed.ts');
  console.log('  npx ts-node -r tsconfig-paths/register prisma/seed-platform-admin.ts');
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
