/**
 * One-time cleanup: purge all soft-deleted institutions and their data.
 *
 * Previous removeClient() only soft-deleted (set deletedAt + status=inactive).
 * This script finds every institution where deletedAt IS NOT NULL and hard-deletes
 * it. Prisma's onDelete: Cascade on every child model wipes all related data:
 * students, users, fees, attendance, exams, salary records, etc.
 *
 * Run: npm run purge:deleted-institutions
 * Safe to re-run — if no soft-deleted institutions exist it exits cleanly.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

async function main() {
  console.log('\n🔍 Scanning for soft-deleted institutions...\n');
  await prisma.$connect();

  const softDeleted = await prisma.institution.findMany({
    where: { deletedAt: { not: null } },
    select: {
      id: true,
      name: true,
      code: true,
      deletedAt: true,
      _count: {
        select: {
          students: true,
          users: true,
          feePayments: true,
          feeCollections: true,
          attendanceSessions: true,
        },
      },
    },
    orderBy: { deletedAt: 'asc' },
  });

  if (softDeleted.length === 0) {
    console.log('✅ No soft-deleted institutions found. Nothing to purge.\n');
    return;
  }

  console.log(`Found ${softDeleted.length} soft-deleted institution(s):\n`);
  softDeleted.forEach((inst, i) => {
    console.log(`  ${i + 1}. ${inst.name} (${inst.code})`);
    console.log(`     Soft-deleted: ${inst.deletedAt!.toISOString()}`);
    console.log(`     Data: ${inst._count.students} students, ${inst._count.users} users, ` +
      `${inst._count.feePayments + inst._count.feeCollections} fee records, ` +
      `${inst._count.attendanceSessions} attendance sessions`);
  });

  console.log('\n⚠️  About to permanently delete all of the above institutions and ALL their data.');
  console.log('   This cannot be undone.\n');

  // Give 3 seconds to abort (Ctrl+C)
  console.log('   Starting in 3 seconds — press Ctrl+C to abort...');
  await new Promise((r) => setTimeout(r, 3000));

  let purged = 0;
  let failed = 0;

  for (const inst of softDeleted) {
    try {
      await prisma.institution.delete({ where: { id: inst.id } });
      console.log(`  ✅ Purged: ${inst.name} (${inst.code})`);
      purged++;
    } catch (err: any) {
      console.error(`  ❌ Failed to purge ${inst.name}: ${err?.message ?? String(err)}`);
      failed++;
    }
  }

  console.log(`\n🏁 Done. Purged: ${purged}  Failed: ${failed}\n`);
}

main()
  .catch((e) => { console.error('❌ Script failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
