import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

async function main() {
  console.log('🌱 Seeding platform admin...');
  await prisma.$connect();

  const email = 'dev@infovion.in';
  const password = 'platform@dev123'; // change after first login

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log('⏭️  Platform admin already exists:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.platformAdmin.create({
    data: {
      email,
      passwordHash,
      name: 'Infovion Dev',
      isActive: true,
    },
  });

  console.log('✅ Platform admin created!');
  console.log('   Email   :', admin.email);
  console.log('   Password:', password);
  console.log('   Login at: http://localhost:3001/platform/login');
  console.log('\n⚠️  Change this password immediately after first login.');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
