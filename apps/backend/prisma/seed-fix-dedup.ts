/**
 * seed-fix-dedup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixes the duplicate academic unit problem caused by running seed-bulk.ts
 * on top of seed.ts for Institution 1 (Infovion).
 *
 * Problem:
 *   seed.ts  created Class 1-12 with IDs: seed-c1-INSTID … seed-c12-INSTID
 *   seed-bulk.ts created Class 1-12 with IDs: seed-class_1-INSTID … seed-class_12-INSTID
 *   → Students were enrolled in bulk-seed units
 *   → Class teacher assignments are on original-seed units
 *   → Dropdowns show every class twice
 *
 * Fix:
 *   1. Move classTeacher assignments from original → bulk unit
 *   2. Move any attendance sessions from original → bulk unit
 *   3. Soft-delete the original empty units
 *
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed-fix-dedup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

const INST_ID = 'cmms6jl0k0000q3repb3w13hv';

// Each pair: original (empty) → bulk (has students)
const MERGE_PAIRS = [
  { original: `seed-c1-${INST_ID}`,  bulk: `seed-class_1-${INST_ID}` },
  { original: `seed-c2-${INST_ID}`,  bulk: `seed-class_2-${INST_ID}` },
  { original: `seed-c3-${INST_ID}`,  bulk: `seed-class_3-${INST_ID}` },
  { original: `seed-c4-${INST_ID}`,  bulk: `seed-class_4-${INST_ID}` },
  { original: `seed-c5-${INST_ID}`,  bulk: `seed-class_5-${INST_ID}` },
  { original: `seed-c6-${INST_ID}`,  bulk: `seed-class_6-${INST_ID}` },
  { original: `seed-c7-${INST_ID}`,  bulk: `seed-class_7-${INST_ID}` },
  { original: `seed-c8-${INST_ID}`,  bulk: `seed-class_8-${INST_ID}` },
  { original: `seed-c9-${INST_ID}`,  bulk: `seed-class_9-${INST_ID}` },
  { original: `seed-c10-${INST_ID}`, bulk: `seed-class_10-${INST_ID}` },
  { original: `seed-c11-${INST_ID}`, bulk: `seed-class_11-${INST_ID}` },
  { original: `seed-c12-${INST_ID}`, bulk: `seed-class_12-${INST_ID}` },
];

async function main() {
  await prisma.$connect();
  console.log('✅ Connected\n');
  console.log('🔧 Fixing duplicate academic units for Infovion institution…\n');

  for (const { original, bulk } of MERGE_PAIRS) {
    const origUnit = await prisma.academicUnit.findUnique({ where: { id: original } });
    const bulkUnit = await prisma.academicUnit.findUnique({
      where: { id: bulk },
      include: { _count: { select: { students: true } } },
    });

    if (!origUnit) {
      console.log(`  ⏭️  ${original} — not found, skipping`);
      continue;
    }
    if (!bulkUnit) {
      console.log(`  ⏭️  ${bulk} — not found, skipping`);
      continue;
    }

    const label = bulkUnit.displayName || bulkUnit.name;
    console.log(`\n── ${label} ──────────────────────────────────────────`);
    console.log(`   Original : ${original} (students: 0, teacher: ${origUnit.classTeacherUserId ?? 'none'})`);
    console.log(`   Bulk     : ${bulk} (students: ${bulkUnit._count.students})`);

    // 1. Move classTeacher assignment
    if (origUnit.classTeacherUserId && !bulkUnit.classTeacherUserId) {
      await prisma.academicUnit.update({
        where: { id: bulk },
        data: { classTeacherUserId: origUnit.classTeacherUserId },
      });
      console.log(`   ✅ Moved classTeacher (${origUnit.classTeacherUserId}) → bulk unit`);
    } else if (origUnit.classTeacherUserId) {
      console.log(`   ℹ️  Bulk unit already has classTeacher, skipping assignment move`);
    } else {
      console.log(`   ℹ️  No classTeacher to move`);
    }

    // 2. Move attendance sessions from original → bulk
    const sessions = await prisma.attendanceSession.findMany({
      where: { academicUnitId: original },
    });
    if (sessions.length > 0) {
      await prisma.attendanceSession.updateMany({
        where: { academicUnitId: original },
        data: { academicUnitId: bulk },
      });
      console.log(`   ✅ Moved ${sessions.length} attendance session(s) → bulk unit`);
    }

    // 3. Move any exam subjects referencing original unit
    const examSubjects = await prisma.examSubject.findMany({
      where: { academicUnitId: original },
    });
    if (examSubjects.length > 0) {
      await prisma.examSubject.updateMany({
        where: { academicUnitId: original },
        data: { academicUnitId: bulk },
      });
      console.log(`   ✅ Moved ${examSubjects.length} exam subject(s) → bulk unit`);
    }

    // 4. Move fee structures referencing original unit
    const feeStructures = await prisma.feeStructure.findMany({
      where: { academicUnitId: original },
    });
    if (feeStructures.length > 0) {
      await prisma.feeStructure.updateMany({
        where: { academicUnitId: original },
        data: { academicUnitId: bulk },
      });
      console.log(`   ✅ Moved ${feeStructures.length} fee structure(s) → bulk unit`);
    }

    // 5. Move academic unit subjects (subject assignments) referencing original unit
    const unitSubjects = await prisma.academicUnitSubject.findMany({
      where: { academicUnitId: original },
    });
    if (unitSubjects.length > 0) {
      await prisma.academicUnitSubject.updateMany({
        where: { academicUnitId: original },
        data: { academicUnitId: bulk },
      });
      console.log(`   ✅ Moved ${unitSubjects.length} subject assignment(s) → bulk unit`);
    }

    // 6. Move any students accidentally in original (safety net)
    const stragglerCount = await prisma.student.count({
      where: { academicUnitId: original },
    });
    if (stragglerCount > 0) {
      await prisma.student.updateMany({
        where: { academicUnitId: original },
        data: { academicUnitId: bulk },
      });
      console.log(`   ✅ Moved ${stragglerCount} straggler student(s) → bulk unit`);
    }

    // 7. Soft-delete the original empty unit
    await prisma.academicUnit.update({
      where: { id: original },
      data: { deletedAt: new Date() },
    });
    console.log(`   ✅ Soft-deleted original unit`);
  }

  // Summary
  const totalUnits = await prisma.academicUnit.count({
    where: { institutionId: INST_ID, deletedAt: null },
  });
  const totalStudents = await prisma.student.count({
    where: { institutionId: INST_ID, status: 'active' },
  });
  console.log('\n────────────────────────────────────────────────────────');
  console.log('🎉 Dedup fix complete!');
  console.log(`   Active units : ${totalUnits}`);
  console.log(`   Active students: ${totalStudents}`);
  console.log('\nYou should now see each class exactly once in all dropdowns.');
}

main()
  .catch((e) => { console.error('❌ Fix failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
