/**
 * seed-fix-roles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time fix: updates all role permission sets for every institution to match
 * the authoritative definitions below. Safe to re-run.
 *
 * Run: npm run seed:fix-roles   (from apps/backend)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

const ROLE_DEFS = [
  {
    code: 'super_admin',
    label: 'Director',
    permissions: [
      'users.read','users.write','users.assignRole','roles.read','roles.write',
      'students.read','students.write','fees.read','fees.write',
      'attendance.read','attendance.write','exams.read','exams.write',
      'subjects.read','subjects.write','academic.read','academic.write',
      'institution.read','institution.write',
    ],
  },
  {
    code: 'admin',
    label: 'Operator',
    permissions: [
      'users.read','users.write','users.assignRole','roles.read',
      'students.read','students.write','fees.read','fees.write',
      'attendance.read','attendance.write','exams.read','exams.write',
      'subjects.read','subjects.write','academic.read','academic.write',
      'institution.read','institution.write',
    ],
  },
  {
    code: 'principal',
    label: 'Principal',
    permissions: [
      'students.read','attendance.read','exams.read','fees.read',
      'users.read','subjects.read','academic.read','academic.write',
    ],
  },
  {
    code: 'teacher',
    label: 'Teacher',
    permissions: [
      'attendance.read','attendance.write','exams.read','exams.write',
      'subjects.read','students.read','academic.read',
    ],
  },
  {
    code: 'student',
    label: 'Student',
    permissions: ['attendance.read','exams.read','fees.read'],
  },
  {
    code: 'parent',
    label: 'Parent',
    permissions: ['attendance.read','exams.read','fees.read'],
  },
  {
    code: 'receptionist',
    label: 'Desk / Reception',
    permissions: ['inquiry.read','inquiry.write','students.read','users.read'],
  },
];

async function main() {
  await prisma.$connect();
  console.log('✅ Connected\n');

  const institutions = await prisma.institution.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
  });

  console.log(`Found ${institutions.length} institution(s)\n`);

  for (const inst of institutions) {
    console.log(`🏫  ${inst.name} (${inst.code})`);
    for (const def of ROLE_DEFS) {
      const result = await prisma.role.updateMany({
        where: { institutionId: inst.id, code: def.code },
        data: { permissions: def.permissions, label: def.label },
      });
      if (result.count > 0) {
        console.log(`  ✅  ${def.code} — permissions updated`);
      } else {
        // Create if missing
        await prisma.role.create({
          data: {
            institutionId: inst.id,
            code: def.code,
            label: def.label,
            permissions: def.permissions,
          },
        }).catch(() => { /* already exists */ });
        console.log(`  ➕  ${def.code} — created`);
      }
    }
    console.log('');
  }

  console.log('🎉  All role permissions updated!');
  console.log('⚠️  Users must log out and log back in for new permissions to take effect.\n');
}

main()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
