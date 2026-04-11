/**
 * seed-bulk.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulk-seeds two institutions with realistic Indian student & staff data.
 *
 * Institution 1 (Infovion)  – existing – gets 1 000 students + ~55 staff
 * Institution 2 (Greenfield Public School) – new – gets 500 students + ~35 staff
 *
 * Run: npx prisma db seed --seed-script prisma/seed-bulk.ts
 *   OR: npm run seed:bulk   (from apps/backend)
 *
 * Safe to re-run – uses upsert / skipDuplicates throughout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

// ── Institution constants ─────────────────────────────────────────────────────
const INST1 = {
  id:   'cmms6jl0k0000q3repb3w13hv',
  code: 'infovion',
  name: 'Infovion',
  admPrefix: 'INF',
  emailDomain: 'infovion.in',
};

const INST2 = {
  id:   'seed-inst2-greenfield-2025',
  code: 'greenfield',
  name: 'Greenfield Public School',
  admPrefix: 'GPS',
  emailDomain: 'greenfield.edu.in',
};

// ── Name pools (realistic Indian names) ──────────────────────────────────────
const MALE_FIRST = [
  'Aarav','Arjun','Vivaan','Aditya','Vihaan','Sai','Ayaan','Krishna','Ishaan','Shivam',
  'Rahul','Rohan','Karan','Nikhil','Amit','Suresh','Ramesh','Vijay','Rajesh','Sandeep',
  'Akash','Deepak','Ravi','Ajay','Vikram','Gaurav','Manish','Piyush','Tushar','Harsh',
  'Yash','Dev','Parth','Neel','Omkar','Pratik','Siddharth','Kunal','Sahil','Mohit',
  'Varun','Ankit','Nitin','Pradeep','Rakesh','Manoj','Sunil','Anil','Dinesh','Girish',
  'Tejas','Rushikesh','Abhishek','Soham','Aniket','Shreyas','Pranav','Sumit','Yogesh','Hitesh',
  'Kartik','Shubham','Vishal','Sachin','Ninad','Mihir','Vedant','Tanmay','Rupesh','Amol',
];

const FEMALE_FIRST = [
  'Aarohi','Ananya','Priya','Kavya','Riya','Sneha','Pooja','Neha','Divya','Shreya',
  'Swati','Anjali','Nisha','Meera','Sana','Tanvi','Kriti','Diya','Simran','Pallavi',
  'Bhavna','Rekha','Sunita','Geeta','Usha','Lata','Sushma','Madhuri','Archana','Vandana',
  'Savita','Shalini','Preeti','Asha','Kiran','Shweta','Sapna','Manasi','Rucha','Rashmi',
  'Smita','Varsha','Nandini','Sanika','Gauri','Vrinda','Ishika','Tara','Mira','Aisha',
  'Rutuja','Mugdha','Sayali','Kimaya','Vaishnavi','Yashoda','Prajakta','Swapna','Namrata','Apurva',
  'Tejal','Chaitali','Shital','Madhura','Shraddha','Amruta','Chandani','Leena','Sonali','Revati',
];

const LAST_NAMES = [
  'Sharma','Verma','Patel','Joshi','Singh','Kumar','Gupta','Mehta','Shah','Desai',
  'Nair','Reddy','Rao','Iyer','Kulkarni','Patil','Shinde','Jadhav','More','Ghosh',
  'Das','Sinha','Mishra','Tiwari','Pandey','Tripathi','Dwivedi','Yadav','Chauhan','Rajput',
  'Solanki','Bhatt','Jain','Bansal','Agarwal','Saxena','Srivastava','Chaudhary','Malhotra','Kapoor',
  'Wagh','Kale','Sawant','Gaikwad','Mane','Pawar','Bhosale','Kadam','Lokhande','Salunkhe',
  'Naik','Bhat','Hegde','Shetty','Kamath','Pillai','Menon','Varma','Krishnan','Subramaniam',
];

const ADDRESSES = [
  'Plot 12, Shivaji Nagar', 'Flat 302, Ganesh Apartment, Deccan', 'House 45, Gandhi Road',
  'Bldg 7, Lokesh Society', '23 MG Road', 'B-104 Sunrise Heights', 'Near Balaji Temple, Sector 5',
  'Railway Colony, Block C', '78 Parvati Road', 'Opp Municipal School, Main Bazar',
  'Wing A, Pratiksha CHS', '14 Tilak Path', 'Bharat Nagar, Lane 3', 'Green Valley, Plot 6',
  'Near Bus Stand, Ward 2', 'Old City, Sadar Bazaar', 'Model Colony', 'Hanuman Nagar, Row 4',
];

const CITIES = [
  'Pune','Mumbai','Nashik','Nagpur','Aurangabad','Thane','Kolhapur','Solapur','Nanded','Sangli',
];

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const RELIGIONS    = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain'];
const CASTE_CATS   = ['General','OBC','SC','ST'];

// ── Deterministic pseudo-random helpers ──────────────────────────────────────
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function gender(seed: number): 'Male' | 'Female' {
  return seed % 2 === 0 ? 'Male' : 'Female';
}

function firstName(seed: number): string {
  return gender(seed) === 'Male' ? pick(MALE_FIRST, seed) : pick(FEMALE_FIRST, seed);
}

function dob(classLevel: number, seed: number): Date {
  // LKG~3yrs old … Class 12 ~18 yrs old
  const ageYears = 3 + classLevel + (seed % 2);
  const base = new Date('2025-06-01');
  base.setFullYear(base.getFullYear() - ageYears);
  base.setDate(1 + (seed % 28));
  base.setMonth(seed % 12);
  return base;
}

function phone(seed: number): string {
  const prefix = ['98','97','96','95','94','93','91','90','88','87'][seed % 10];
  return `${prefix}${String(seed % 100000000).padStart(8,'0')}`;
}

function address(seed: number): string {
  return `${pick(ADDRESSES, seed)}, ${pick(CITIES, seed % 7)}`;
}

// ── Class structure (15 classes: LKG, UKG, KG, 1-12) ────────────────────────
function classDefinitions(institutionId: string) {
  const classes = [
    { name: 'lkg',     displayName: 'LKG',      level: 0 },
    { name: 'ukg',     displayName: 'UKG',      level: 1 },
    { name: 'kg',      displayName: 'KG',       level: 2 },
    { name: 'class_1', displayName: 'Class 1',  level: 3  },
    { name: 'class_2', displayName: 'Class 2',  level: 4  },
    { name: 'class_3', displayName: 'Class 3',  level: 5  },
    { name: 'class_4', displayName: 'Class 4',  level: 6  },
    { name: 'class_5', displayName: 'Class 5',  level: 7  },
    { name: 'class_6', displayName: 'Class 6',  level: 8  },
    { name: 'class_7', displayName: 'Class 7',  level: 9  },
    { name: 'class_8', displayName: 'Class 8',  level: 10 },
    { name: 'class_9', displayName: 'Class 9',  level: 11 },
    { name: 'class_10',displayName: 'Class 10', level: 12 },
    { name: 'class_11',displayName: 'Class 11', level: 13 },
    { name: 'class_12',displayName: 'Class 12', level: 14 },
  ];
  return classes.map(c => ({
    ...c,
    id: `seed-${c.name}-${institutionId}`,
  }));
}

// Students per class: ~67 per class for 1000-student school, ~33 for 500-student school
// Distribution: LKG-KG slightly fewer, Class 1-10 bulk, Class 11-12 slightly fewer
function studentsPerClass(totalTarget: number) {
  // 15 classes
  const share = Math.floor(totalTarget / 15);
  return [
    share - 5, share - 5, share - 5,    // LKG, UKG, KG
    share,share,share,share,share,       // 1-5
    share,share,share,share,share,       // 6-10
    share + 5, share + 5,                // 11, 12
  ];
}

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLE_DEFS = [
  {
    code: 'super_admin', label: 'Director',
    permissions: [
      'users.read','users.write','users.assignRole','roles.read','roles.write',
      'students.read','students.write','fees.read','fees.write',
      'attendance.read','attendance.write','exams.read','exams.write',
      'subjects.read','subjects.write','academic.read','academic.write',
      'institution.read','institution.write',
    ],
  },
  {
    code: 'admin', label: 'Operator',
    permissions: [
      'users.read','users.write','users.assignRole','roles.read',
      'students.read','students.write','fees.read','fees.write',
      'attendance.read','attendance.write','exams.read','exams.write',
      'subjects.read','subjects.write','academic.read','academic.write',
    ],
  },
  {
    code: 'principal', label: 'Principal',
    permissions: ['students.read','attendance.read','exams.read','fees.read','users.read','subjects.read'],
  },
  {
    code: 'teacher', label: 'Teacher',
    permissions: ['attendance.read','attendance.write','exams.read','exams.write','subjects.read','students.read'],
  },
  {
    code: 'student', label: 'Student',
    permissions: ['attendance.read','exams.read','fees.read'],
  },
  {
    code: 'parent', label: 'Parent',
    permissions: ['attendance.read','exams.read','fees.read'],
  },
  {
    code: 'receptionist', label: 'Desk / Reception',
    permissions: ['inquiry.read','inquiry.write','students.read','users.read'],
  },
];

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function ensureAcademicYear(institutionId: string) {
  return prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId, name: '2025-26' } },
    update: {},
    create: {
      id: `seed-ay-2025-26-${institutionId}`,
      institutionId,
      name: '2025-26',
      startDate: new Date('2025-06-01'),
      endDate:   new Date('2026-03-31'),
      isCurrent: true,
    },
  });
}

async function ensureClasses(institutionId: string, academicYearId: string) {
  const defs = classDefinitions(institutionId);
  for (const cls of defs) {
    await prisma.academicUnit.upsert({
      where: { id: cls.id },
      update: { academicYearId, deletedAt: null, level: 1 },
      create: {
        id: cls.id,
        institutionId,
        academicYearId,
        name: cls.name,
        displayName: cls.displayName,
        level: 1,
        parentId: null,
      },
    });
  }
  return defs;
}

async function ensureRoles(institutionId: string) {
  for (const r of ROLE_DEFS) {
    await prisma.role.upsert({
      where: { institutionId_code: { institutionId, code: r.code } },
      update: { permissions: r.permissions, label: r.label },
      create: { institutionId, code: r.code, label: r.label, permissions: r.permissions },
    });
  }
  // Return as map
  const roles = await prisma.role.findMany({ where: { institutionId } });
  return Object.fromEntries(roles.map(r => [r.code, r]));
}

async function ensureUser(
  institutionId: string,
  email: string,
  passwordHash: string,
) {
  const existing = await prisma.user.findFirst({ where: { institutionId, email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { institutionId, email, passwordHash, isActive: true },
  });
}

async function assignRole(userId: string, roleId: string, institutionId: string) {
  const exists = await prisma.userRole.findFirst({ where: { userId, roleId } });
  if (!exists) {
    await prisma.userRole.create({ data: { userId, roleId, institutionId } });
  }
}

// ── Seed staff (teachers + principal + receptionist) ──────────────────────────
async function seedStaff(
  inst: typeof INST1,
  roles: Record<string, { id: string }>,
  teacherHash: string,
  teacherCount: number,
  offset = 0,
) {
  console.log(`  👩‍🏫  Creating ${teacherCount} teachers…`);

  // Principal
  const principal = await ensureUser(inst.id, `principal@${inst.emailDomain}`, teacherHash);
  await assignRole(principal.id, roles['principal'].id, inst.id);

  // Receptionist
  const reception = await ensureUser(inst.id, `reception@${inst.emailDomain}`, teacherHash);
  await assignRole(reception.id, roles['receptionist'].id, inst.id);

  // Teachers
  const teacherIds: string[] = [];
  for (let i = 1; i <= teacherCount; i++) {
    const seed = offset + i * 7;
    const g    = gender(seed);
    const fn   = g === 'Male' ? pick(MALE_FIRST, seed) : pick(FEMALE_FIRST, seed);
    const ln   = pick(LAST_NAMES, seed + 3);
    const email = `teacher${i}@${inst.emailDomain}`;
    const user  = await ensureUser(inst.id, email, teacherHash);
    await assignRole(user.id, roles['teacher'].id, inst.id);
    teacherIds.push(user.id);
  }

  console.log(`  ✅  Staff done: 1 principal, 1 receptionist, ${teacherCount} teachers`);
  return teacherIds;
}

// ── Seed students ─────────────────────────────────────────────────────────────
async function seedStudents(
  inst: typeof INST1,
  classes: { id: string; name: string; displayName: string; level: number }[],
  totalTarget: number,
  startAdmNo = 1,
) {
  const distribution = studentsPerClass(totalTarget);
  let admCounter = startAdmNo;
  let totalCreated = 0;

  for (let ci = 0; ci < classes.length; ci++) {
    const cls     = classes[ci];
    const count   = distribution[ci];
    const records: any[] = [];

    for (let s = 0; s < count; s++) {
      const seed   = admCounter * 13;
      const g      = gender(seed);
      const fn     = g === 'Male' ? pick(MALE_FIRST, seed) : pick(FEMALE_FIRST, seed);
      const ln     = pick(LAST_NAMES, seed + 5);
      const fatherFirst = pick(MALE_FIRST, seed + 2);
      const motherFirst = pick(FEMALE_FIRST, seed + 4);
      const admNo  = `${inst.admPrefix}-2025-${String(admCounter).padStart(4, '0')}`;

      records.push({
        institutionId:  inst.id,
        admissionNo:    admNo,
        firstName:      fn,
        lastName:       ln,
        dateOfBirth:    dob(ci, seed),
        gender:         g,
        phone:          phone(seed),
        fatherName:     `${fatherFirst} ${ln}`,
        motherName:     `${motherFirst} ${ln}`,
        parentPhone:    phone(seed + 1),
        address:        address(seed),
        bloodGroup:     pick(BLOOD_GROUPS, seed),
        nationality:    'Indian',
        religion:       pick(RELIGIONS, seed),
        casteCategory:  pick(CASTE_CATS, seed),
        admissionDate:  new Date('2025-06-10'),
        academicUnitId: cls.id,
        status:         'active',
        rollNo:         String(s + 1),
      });

      admCounter++;
    }

    // Bulk insert, skip duplicates
    const result = await prisma.student.createMany({
      data: records,
      skipDuplicates: true,
    });
    totalCreated += result.count;
    process.stdout.write(`    ${cls.displayName}: ${result.count} students\n`);
  }

  console.log(`  ✅  Students total inserted: ${totalCreated}`);
  return admCounter;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await prisma.$connect();
  console.log('✅ Database connected\n');

  // Hash once, reuse for all staff (performance)
  console.log('🔐 Pre-computing password hash…');
  const teacherHash = await bcrypt.hash('teacher123', 10);
  const adminHash   = await bcrypt.hash('admin123', 10);
  const operatorHash = await bcrypt.hash('operator123', 10);

  // ──────────────────────────────────────────────────────────────────────────
  // INSTITUTION 1 – Infovion (existing) – 1 000 students + 55 staff
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏫  Institution 1: ${INST1.name} (${INST1.code})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const inst1 = await prisma.institution.findUnique({ where: { id: INST1.id } });
  if (!inst1) throw new Error(`Institution 1 (${INST1.id}) not found. Run prisma db seed first.`);

  const ay1     = await ensureAcademicYear(INST1.id);
  const cls1    = await ensureClasses(INST1.id, ay1.id);
  const roles1  = await ensureRoles(INST1.id);

  await seedStaff(INST1, roles1, teacherHash, 50);
  await seedStudents(INST1, cls1, 1000, 1);

  // ──────────────────────────────────────────────────────────────────────────
  // INSTITUTION 2 – Greenfield Public School (new) – 500 students + 35 staff
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏫  Institution 2: ${INST2.name} (${INST2.code})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Create Institution 2 if it doesn't exist
  await prisma.institution.upsert({
    where: { id: INST2.id },
    update: {},
    create: {
      id:              INST2.id,
      name:            INST2.name,
      code:            INST2.code,
      planCode:        'standard',
      institutionType: 'school',
      status:          'active',
      board:           'CBSE',
      address:         '14 Tilak Path, Model Colony, Pune 411016',
      phone:           '9800000001',
      email:           `admin@${INST2.emailDomain}`,
    },
  });
  console.log(`  ✅  Institution record ready: ${INST2.name}`);

  const ay2    = await ensureAcademicYear(INST2.id);
  const cls2   = await ensureClasses(INST2.id, ay2.id);
  const roles2 = await ensureRoles(INST2.id);
  console.log('  ✅  Academic year + classes + roles ready');

  // Admin (Director) for Institution 2
  const dir2 = await ensureUser(INST2.id, `admin@${INST2.emailDomain}`, adminHash);
  await assignRole(dir2.id, roles2['super_admin'].id, INST2.id);
  console.log(`  ✅  Director: admin@${INST2.emailDomain} / admin123`);

  // Operator for Institution 2
  const op2 = await ensureUser(INST2.id, `operator@${INST2.emailDomain}`, operatorHash);
  await assignRole(op2.id, roles2['admin'].id, INST2.id);
  console.log(`  ✅  Operator: operator@${INST2.emailDomain} / operator123`);

  await seedStaff(INST2, roles2, teacherHash, 30, 999);
  await seedStudents(INST2, cls2, 500, 2001);

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🎉  Bulk seed complete!\n');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                    LOGIN CREDENTIALS                            │');
  console.log('├─────────────────┬────────────────────────────────┬──────────────┤');
  console.log('│ Institution     │ Email                          │ Password     │');
  console.log('├─────────────────┼────────────────────────────────┼──────────────┤');
  console.log(`│ Infovion        │ admin@infovion.in               │ admin123     │`);
  console.log(`│ Infovion        │ operator@infovion.in            │ operator123  │`);
  console.log(`│ Infovion        │ teacher1@infovion.in            │ teacher123   │`);
  console.log(`│ Infovion        │ principal@infovion.in           │ teacher123   │`);
  console.log('├─────────────────┼────────────────────────────────┼──────────────┤');
  console.log(`│ Greenfield      │ admin@greenfield.edu.in         │ admin123     │`);
  console.log(`│ Greenfield      │ operator@greenfield.edu.in      │ operator123  │`);
  console.log(`│ Greenfield      │ teacher1@greenfield.edu.in      │ teacher123   │`);
  console.log(`│ Greenfield      │ principal@greenfield.edu.in     │ teacher123   │`);
  console.log('├─────────────────┼────────────────────────────────┼──────────────┤');
  console.log('│ Login code      │ infovion  /  greenfield         │              │');
  console.log('└─────────────────┴────────────────────────────────┴──────────────┘');
  console.log('\n⚠️  Change all passwords before going to production!\n');
}

main()
  .catch(e => { console.error('❌ Bulk seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
