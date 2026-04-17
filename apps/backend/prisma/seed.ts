import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error'],
});

const INSTITUTION_ID = 'cmms6jl0k0000q3repb3w13hv';

async function main() {
  console.log('🌱 Seeding for institution:', INSTITUTION_ID);

  // ✅ Test connection first
  await prisma.$connect();
  console.log('✅ Database connected');

  const institution = await prisma.institution.findUnique({
    where: { id: INSTITUTION_ID },
  });

  if (!institution) {
    throw new Error(`Institution ${INSTITUTION_ID} not found.`);
  }

  // Ensure the institution has the readable code set for login
  if (!institution.code || institution.code === INSTITUTION_ID) {
    await prisma.institution.update({
      where: { id: INSTITUTION_ID },
      data: { code: 'infovion' },
    });
    console.log('✅ Institution code set to: infovion');
  }

  console.log('✅ Institution found:', institution.name, '| Login code:', institution.code || 'infovion');

  // ✅ Upsert current academic year
  const academicYear = await prisma.academicYear.upsert({
    where: {
      institutionId_name: {
        institutionId: INSTITUTION_ID,
        name: '2025-26',
      },
    },
    update: {},
    create: {
      id: 'seed-ay-2025-26-' + INSTITUTION_ID,
      institutionId: INSTITUTION_ID,
      name: '2025-26',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-03-31'),
      isCurrent: true,
    },
  });
  console.log('✅ Academic Year ready:', academicYear.name);

  // ✅ Soft-delete legacy Primary/Secondary group containers (if they exist)
  await prisma.academicUnit.updateMany({
    where: {
      institutionId: INSTITUTION_ID,
      id: { in: ['seed-primary-' + INSTITUTION_ID, 'seed-secondary-' + INSTITUTION_ID] },
    },
    data: { deletedAt: new Date() },
  });

  // ✅ Flat class structure: KG, LKG, UKG + Class 1-12 at root level (no grouping)
  const classes = [
    { id: `seed-lkg-${INSTITUTION_ID}`,  displayName: 'LKG',      name: 'lkg' },
    { id: `seed-ukg-${INSTITUTION_ID}`,  displayName: 'UKG',      name: 'ukg' },
    { id: `seed-kg-${INSTITUTION_ID}`,   displayName: 'KG',       name: 'kg' },
    { id: `seed-c1-${INSTITUTION_ID}`,   displayName: 'Class 1',  name: 'class_1' },
    { id: `seed-c2-${INSTITUTION_ID}`,   displayName: 'Class 2',  name: 'class_2' },
    { id: `seed-c3-${INSTITUTION_ID}`,   displayName: 'Class 3',  name: 'class_3' },
    { id: `seed-c4-${INSTITUTION_ID}`,   displayName: 'Class 4',  name: 'class_4' },
    { id: `seed-c5-${INSTITUTION_ID}`,   displayName: 'Class 5',  name: 'class_5' },
    { id: `seed-c6-${INSTITUTION_ID}`,   displayName: 'Class 6',  name: 'class_6' },
    { id: `seed-c7-${INSTITUTION_ID}`,   displayName: 'Class 7',  name: 'class_7' },
    { id: `seed-c8-${INSTITUTION_ID}`,   displayName: 'Class 8',  name: 'class_8' },
    { id: `seed-c9-${INSTITUTION_ID}`,   displayName: 'Class 9',  name: 'class_9' },
    { id: `seed-c10-${INSTITUTION_ID}`,  displayName: 'Class 10', name: 'class_10' },
    { id: `seed-c11-${INSTITUTION_ID}`,  displayName: 'Class 11', name: 'class_11' },
    { id: `seed-c12-${INSTITUTION_ID}`,  displayName: 'Class 12', name: 'class_12' },
  ];

  for (const cls of classes) {
    await prisma.academicUnit.upsert({
      where: { id: cls.id },
      // Move any legacy children back to root + clear deleted state
      update: { academicYearId: academicYear.id, parentId: null, deletedAt: null, level: 1 },
      create: {
        id: cls.id,
        institutionId: INSTITUTION_ID,
        academicYearId: academicYear.id,
        name: cls.name,
        displayName: cls.displayName,
        level: 1,
        parentId: null,
      },
    });
    console.log(`  ✅ ${cls.displayName}`);
  }
  console.log('✅ Standard class structure (LKG → Class 12) ready');

  // ✅ Seed admin user
  const existingUser = await prisma.user.findFirst({
    where: { institutionId: INSTITUTION_ID, email: 'admin@infovion.in' },
  });

  let adminUser = existingUser;
  if (!existingUser) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    adminUser = await prisma.user.create({
      data: {
        institutionId: INSTITUTION_ID,
        email: 'admin@infovion.in',
        passwordHash,
        isActive: true,
      },
    });
    console.log('✅ Admin user created: admin@infovion.in / admin123');
  } else {
    console.log('⏭️  Admin user already exists');
  }

  // ✅ Seed roles
  const roleDefinitions = [
    {
      code: 'super_admin',
      label: 'Director',
      permissions: [
        'users.read', 'users.write', 'users.assignRole',
        'roles.read', 'roles.write',
        'students.read', 'students.write',
        'fees.read', 'fees.write',
        'attendance.read', 'attendance.write',
        'exams.read', 'exams.write',
        'subjects.read', 'subjects.write',
        'academic.read', 'academic.write',
        'institution.read', 'institution.write',
      ],
    },
    {
      code: 'admin',
      label: 'Operator',
      permissions: [
        'users.read', 'users.write', 'users.assignRole',
        'roles.read',
        'students.read', 'students.write',
        'fees.read', 'fees.write',
        'attendance.read', 'attendance.write',
        'exams.read', 'exams.write',
        'subjects.read', 'subjects.write',
        'academic.read', 'academic.write',
      ],
    },
    {
      code: 'principal',
      label: 'Principal',
      permissions: ['students.read', 'attendance.read', 'exams.read', 'fees.read', 'users.read', 'subjects.read'],
    },
    {
      code: 'teacher',
      label: 'Teacher',
      permissions: ['attendance.read', 'attendance.write', 'exams.read', 'exams.write', 'subjects.read', 'students.read'],
    },
    {
      code: 'student',
      label: 'Student',
      permissions: ['attendance.read', 'exams.read', 'fees.read'],
    },
    {
      code: 'parent',
      label: 'Parent',
      permissions: ['attendance.read', 'exams.read', 'fees.read'],
    },
    {
      code: 'receptionist',
      label: 'Desk / Reception',
      permissions: ['inquiry.read', 'inquiry.write', 'students.read', 'users.read'],
    },
    {
      code: 'non_teaching_staff',
      label: 'Non-Teaching Staff',
      permissions: ['attendance.read'],
    },
    {
      code: 'accountant',
      label: 'Accountant',
      permissions: ['fees.read', 'fees.write', 'students.read', 'attendance.read', 'institution.read', 'subjects.read'],
    },
  ];

  for (const roleDef of roleDefinitions) {
    await prisma.role.upsert({
      where: { institutionId_code: { institutionId: INSTITUTION_ID, code: roleDef.code } },
      update: { permissions: roleDef.permissions, label: roleDef.label },
      create: {
        institutionId: INSTITUTION_ID,
        code: roleDef.code,
        label: roleDef.label,
        permissions: roleDef.permissions,
      },
    });
    console.log(`  ✅ Role: ${roleDef.code}`);
  }

  // ✅ Seed operator user
  const existingOperator = await prisma.user.findFirst({
    where: { institutionId: INSTITUTION_ID, email: 'operator@infovion.in' },
  });

  let operatorUser = existingOperator;
  if (!existingOperator) {
    const passwordHash = await bcrypt.hash('operator123', 10);
    operatorUser = await prisma.user.create({
      data: {
        institutionId: INSTITUTION_ID,
        email: 'operator@infovion.in',
        passwordHash,
        isActive: true,
      },
    });
    console.log('✅ Operator user created: operator@infovion.in / operator123');
  } else {
    console.log('⏭️  Operator user already exists');
  }

  // ✅ Assign admin role to operator user
  if (operatorUser) {
    const adminRole = await prisma.role.findFirst({
      where: { institutionId: INSTITUTION_ID, code: 'admin' },
    });
    if (adminRole) {
      const existingAssignment = await prisma.userRole.findFirst({
        where: { userId: operatorUser.id, roleId: adminRole.id },
      });
      if (!existingAssignment) {
        await prisma.userRole.create({
          data: { userId: operatorUser.id, roleId: adminRole.id, institutionId: INSTITUTION_ID },
        });
        console.log('✅ admin (Operator) role assigned to operator@infovion.in');
      } else {
        console.log('⏭️  admin role already assigned to operator');
      }
    }
  }

  // ✅ Assign super_admin role to admin user
  if (adminUser) {
    const superAdminRole = await prisma.role.findFirst({
      where: { institutionId: INSTITUTION_ID, code: 'super_admin' },
    });

    if (superAdminRole) {
      const existingAssignment = await prisma.userRole.findFirst({
        where: { userId: adminUser.id, roleId: superAdminRole.id },
      });

      if (!existingAssignment) {
        await prisma.userRole.create({
          data: { userId: adminUser.id, roleId: superAdminRole.id, institutionId: INSTITUTION_ID },
        });
        console.log('✅ super_admin role assigned to admin@infovion.in');
      } else {
        console.log('⏭️  super_admin already assigned to admin');
      }
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log('\n⚠️  SECURITY WARNING ─────────────────────────────────────────────');
  console.log('   Default credentials are active. Change them immediately:');
  console.log('   Director  → admin@infovion.in    / admin123');
  console.log('   Operator  → operator@infovion.in / operator123');
  console.log('   Use the dashboard to update passwords before going to production.');
  console.log('──────────────────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });