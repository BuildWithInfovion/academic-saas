import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

// The two authorised Infovion platform admins.
// Only these two accounts may ever exist (MAX_PLATFORM_ADMINS = 2 in platform.service.ts).
// Passwords must be changed on first login — complexity enforced: 12+ chars, uppercase, number, special char.
const ADMINS = [
  { email: 'sankalp.deshpande@infovion.in', name: 'Sankalp Deshpande', password: 'Infovion@Admin1' },
  { email: 'pratik.gore@infovion.in',        name: 'Pratik Gore',       password: 'Infovion@Admin2' },
];

async function main() {
  console.log('🌱 Seeding platform admins...\n');
  await prisma.$connect();

  // Remove any stale seed/dev accounts that are not in the authorised list
  const authorisedEmails = ADMINS.map((a) => a.email);
  const staleAccounts = await prisma.platformAdmin.findMany({
    where: { email: { notIn: authorisedEmails } },
  });
  if (staleAccounts.length > 0) {
    await prisma.platformAdmin.deleteMany({
      where: { email: { notIn: authorisedEmails } },
    });
    console.log(`🗑️  Removed ${staleAccounts.length} stale account(s): ${staleAccounts.map((a) => a.email).join(', ')}\n`);
  }

  for (const admin of ADMINS) {
    const existing = await prisma.platformAdmin.findUnique({ where: { email: admin.email } });

    if (existing) {
      console.log(`⏭️  Already exists: ${admin.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);
    await prisma.platformAdmin.create({
      data: { email: admin.email, name: admin.name, passwordHash, isActive: true },
    });

    console.log(`✅ Created: ${admin.email}`);
    console.log(`   Name    : ${admin.name}`);
    console.log(`   Password: ${admin.password}  ← change on first login\n`);
  }

  console.log('⚠️  Change passwords immediately after first login.');
  console.log('   Password rules: 12+ chars, uppercase, number, special character.');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
