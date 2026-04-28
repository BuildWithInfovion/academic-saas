/**
 * One-time script: creates "Demo International School" institution
 * and prints the institution code so seed:demo can be run.
 * Run with: ts-node --project tsconfig.seed.json prisma/seed-demo-school.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
  log: ['error'],
});

const DEFAULT_ROLES = [
  { code: 'super_admin', label: 'Director', permissions: ['users.read','roles.read','students.read','fees.read','attendance.read','exams.read','subjects.read','institution.read','academic.read'] },
  { code: 'admin', label: 'Operator', permissions: ['users.read','users.write','users.assignRole','roles.read','students.read','students.write','fees.read','fees.write','attendance.read','attendance.write','exams.read','exams.write','subjects.read','subjects.write','academic.read','academic.write','institution.read','institution.write','inquiry.read','inquiry.write'] },
  { code: 'principal', label: 'Principal', permissions: ['students.read','attendance.read','attendance.write','exams.read','fees.read','fees.write','users.read','users.write','subjects.read','subjects.write','academic.read','academic.write','institution.read','institution.write','inquiry.read','inquiry.write'] },
  { code: 'teacher', label: 'Teacher', permissions: ['attendance.read','attendance.write','exams.read','exams.write','subjects.read','students.read'] },
  { code: 'student', label: 'Student', permissions: ['attendance.read','exams.read','fees.read'] },
  { code: 'parent', label: 'Parent', permissions: ['attendance.read','exams.read','fees.read'] },
  { code: 'receptionist', label: 'Desk / Reception', permissions: ['inquiry.read','inquiry.write','students.read','users.read'] },
  { code: 'accountant', label: 'Accountant', permissions: ['fees.read','fees.write','students.read','attendance.read','institution.read','subjects.read'] },
  { code: 'non_teaching_staff', label: 'Non-Teaching Staff', permissions: ['attendance.read'] },
];

const SCHOOL_CLASSES = [
  { name: 'lkg', displayName: 'LKG' }, { name: 'ukg', displayName: 'UKG' },
  { name: 'class_1', displayName: 'Class 1' }, { name: 'class_2', displayName: 'Class 2' },
  { name: 'class_3', displayName: 'Class 3' }, { name: 'class_4', displayName: 'Class 4' },
  { name: 'class_5', displayName: 'Class 5' }, { name: 'class_6', displayName: 'Class 6' },
  { name: 'class_7', displayName: 'Class 7' }, { name: 'class_8', displayName: 'Class 8' },
  { name: 'class_9', displayName: 'Class 9' }, { name: 'class_10', displayName: 'Class 10' },
  { name: 'class_11', displayName: 'Class 11' }, { name: 'class_12', displayName: 'Class 12' },
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(10), (b) => chars[b % chars.length]).join('');
}

async function main() {
  await prisma.$connect();

  // Check if already exists
  const existing = await prisma.institution.findFirst({
    where: { name: 'Demo International School', deletedAt: null },
  });
  if (existing) {
    console.log(`✅ Institution already exists!`);
    console.log(`   Code: ${existing.code}`);
    console.log(`\nRun seed:demo with:`);
    console.log(`   SEED_INST_CODE=${existing.code} npm run seed:demo`);
    return;
  }

  console.log('🏫 Creating Demo International School...\n');

  const code = 'demointl';

  // 1. Institution
  const inst = await prisma.institution.create({
    data: { name: 'Demo International School', code, planCode: 'standard', institutionType: 'school', status: 'active' },
  });

  // 2. Roles
  await prisma.role.createMany({
    data: DEFAULT_ROLES.map((r) => ({ institutionId: inst.id, code: r.code, label: r.label, permissions: r.permissions })),
  });
  const roleRows = await prisma.role.findMany({ where: { institutionId: inst.id }, select: { id: true, code: true } });
  const roles = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

  // 3. Admin user
  const adminPass = generatePassword();
  const adminHash = await bcrypt.hash(adminPass, 12);
  const adminUser = await prisma.user.create({
    data: { institutionId: inst.id, name: 'Demo Admin', email: 'admin@demointl.school', passwordHash: adminHash, isActive: true },
  });
  await prisma.userRole.create({ data: { userId: adminUser.id, roleId: roles['admin'], institutionId: inst.id } });

  // 4. Director user
  const dirPass = generatePassword();
  const dirHash = await bcrypt.hash(dirPass, 12);
  const dirUser = await prisma.user.create({
    data: { institutionId: inst.id, name: 'Demo Director', email: 'director@demointl.school', passwordHash: dirHash, isActive: true },
  });
  await prisma.userRole.create({ data: { userId: dirUser.id, roleId: roles['super_admin'], institutionId: inst.id } });

  // 5. Subscription
  const start = new Date();
  const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
  await prisma.subscription.create({
    data: { institutionId: inst.id, planName: 'standard', maxStudents: 1500, pricePerUser: 50, billingCycleYears: 1, totalAmount: 75000, startDate: start, endDate: end, status: 'active' },
  });

  // 6. Academic year
  const ay = await prisma.academicYear.create({
    data: { institutionId: inst.id, name: '2025-26', startDate: new Date('2025-06-01'), endDate: new Date('2026-03-31'), isCurrent: true },
  });

  // 7. Classes
  await prisma.academicUnit.createMany({
    data: SCHOOL_CLASSES.map((c) => ({ institutionId: inst.id, academicYearId: ay.id, name: c.name, displayName: c.displayName, level: 1, parentId: null })),
  });

  // 8. Subjects + Fee heads
  const subjects = ['English','Hindi','Mathematics','Environmental Studies','Science','Social Studies','Sanskrit','Physics','Chemistry','Biology','Computer Science','Physical Education'];
  const feeHeads = ['Tuition Fee','Exam Fee','Library Fee','Lab Fee','Sports Fee','Activity Fee','Development Fee','Admission Fee'];
  await Promise.all([
    prisma.subject.createMany({ data: subjects.map((n) => ({ institutionId: inst.id, name: n })), skipDuplicates: true }),
    prisma.feeHead.createMany({ data: feeHeads.map((n) => ({ institutionId: inst.id, name: n, isCustom: false })), skipDuplicates: true }),
  ]);

  console.log(`✅ Demo International School created!\n`);
  console.log(`   Institution Code : ${code}`);
  console.log(`   Admin email      : admin@demointl.school   | password: ${adminPass}`);
  console.log(`   Director email   : director@demointl.school | password: ${dirPass}`);
  console.log(`\n🌱 Now run the full demo seed:`);
  console.log(`   SEED_INST_CODE=${code} npm run seed:demo`);
}

main()
  .catch((e) => { console.error('❌ Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
