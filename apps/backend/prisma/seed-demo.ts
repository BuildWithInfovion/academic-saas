/**
 * seed-demo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive demo seed for "Demo International School" (or any institution).
 *
 * Populates: staff, classes (sections), subjects, students, parent accounts,
 * fee heads + structures + payments, attendance (60 days), 2 exams + results,
 * announcements, and salary structures.
 *
 * Usage:
 *   SEED_INST_CODE=demo npx ts-node --project tsconfig.seed.json prisma/seed-demo.ts
 *
 * If SEED_INST_CODE is not set, prints all available institution codes and exits.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

// ── Name pools ────────────────────────────────────────────────────────────────
const MALE_FIRST = [
  'Aarav','Arjun','Vivaan','Aditya','Vihaan','Sai','Ayaan','Krishna','Ishaan','Shivam',
  'Rahul','Rohan','Karan','Nikhil','Amit','Akash','Deepak','Yash','Dev','Parth',
  'Neel','Omkar','Siddharth','Kunal','Sahil','Mohit','Varun','Ankit','Tejas','Soham',
  'Shreyas','Pranav','Sumit','Kartik','Shubham','Vishal','Mihir','Vedant','Tanmay','Amol',
];
const FEMALE_FIRST = [
  'Aarohi','Ananya','Priya','Kavya','Riya','Sneha','Pooja','Neha','Divya','Shreya',
  'Swati','Anjali','Nisha','Meera','Sana','Tanvi','Kriti','Diya','Simran','Pallavi',
  'Bhavna','Rekha','Sunita','Geeta','Usha','Manasi','Rucha','Rashmi','Smita','Varsha',
  'Nandini','Sanika','Gauri','Vrinda','Ishika','Tara','Mira','Rutuja','Sayali','Kimaya',
];
const LAST_NAMES = [
  'Sharma','Verma','Patel','Joshi','Singh','Kumar','Gupta','Mehta','Shah','Desai',
  'Kulkarni','Patil','Shinde','Jadhav','More','Ghosh','Das','Sinha','Mishra','Tiwari',
  'Pandey','Yadav','Solanki','Bhatt','Jain','Bansal','Agarwal','Saxena','Malhotra','Kapoor',
  'Wagh','Kale','Sawant','Gaikwad','Mane','Pawar','Bhosale','Kadam','Naik','Shetty',
];
const FATHER_FIRST = ['Ramesh','Suresh','Vijay','Rajesh','Sandeep','Mahesh','Dinesh','Girish','Pradeep','Rakesh','Manoj','Sunil','Anil','Hemant','Nilesh','Kishore','Prakash','Sanjay','Ajay','Vikram'];
const MOTHER_FIRST = ['Sunita','Rekha','Meena','Anita','Savita','Shalini','Preeti','Asha','Kiran','Shweta','Sapna','Vaishali','Seema','Kavita','Archana','Vandana','Smita','Mamta','Shobha','Usha'];
const ADDRESSES = [
  'Plot 12, Shivaji Nagar, Pune','Flat 302, Ganesh Apartment, Deccan, Pune',
  'House 45, Gandhi Road, Nagpur','Bldg 7, Lokesh Society, Nashik',
  '23 MG Road, Aurangabad','B-104 Sunrise Heights, Thane',
  'Near Balaji Temple, Sector 5, Pune','78 Parvati Road, Pune',
  'Wing A, Pratiksha CHS, Mumbai','14 Tilak Path, Kolhapur',
  'Green Valley Plot 6, Solapur','Hanuman Nagar Row 4, Pune',
  'Model Colony, Pune','Old City Sadar Bazaar, Nagpur',
  'Bharat Nagar Lane 3, Nashik','Rail Colony Block C, Pune',
];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const RELIGIONS    = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain'];
const CASTE_CATS   = ['General','OBC','SC','ST'];

function pick<T>(arr: T[], seed: number): T { return arr[((seed % arr.length) + arr.length) % arr.length]; }
function isMale(seed: number) { return seed % 2 === 0; }
function firstName(seed: number) { return isMale(seed) ? pick(MALE_FIRST, seed) : pick(FEMALE_FIRST, seed); }
function gender(seed: number) { return isMale(seed) ? 'Male' : 'Female'; }
function phone(seed: number) {
  const prefix = ['98','97','96','95','94','93','91','90','88','87'][seed % 10];
  return `${prefix}${String(Math.abs(seed * 7919) % 100000000).padStart(8,'0')}`;
}
function dob(classIdx: number, seed: number): Date {
  const ageYears = 5 + classIdx + (seed % 2);
  const d = new Date('2025-06-01');
  d.setFullYear(d.getFullYear() - ageYears);
  d.setDate(1 + (seed % 28));
  d.setMonth(Math.abs(seed) % 12);
  return d;
}
function businessDays(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLE_DEFS = [
  { code: 'super_admin', label: 'Director', permissions: [
    'users.read','users.write','users.assignRole','roles.read','roles.write',
    'students.read','students.write','fees.read','fees.write',
    'attendance.read','attendance.write','exams.read','exams.write',
    'subjects.read','subjects.write','academic.read','academic.write',
    'institution.read','institution.write','inquiry.read','inquiry.write',
    'salary.read','salary.write',
  ]},
  { code: 'admin', label: 'Operator', permissions: [
    'users.read','users.write','users.assignRole','roles.read',
    'students.read','students.write','fees.read','fees.write',
    'attendance.read','attendance.write','exams.read','exams.write',
    'subjects.read','subjects.write','academic.read','academic.write',
    'institution.read','institution.write','inquiry.read','inquiry.write',
    'salary.read','salary.write',
  ]},
  { code: 'principal', label: 'Principal', permissions: [
    'students.read','attendance.read','exams.read','fees.read',
    'users.read','subjects.read','academic.read','academic.write','salary.read',
  ]},
  { code: 'teacher', label: 'Teacher', permissions: [
    'attendance.read','attendance.write','exams.read','exams.write',
    'subjects.read','students.read','academic.read',
  ]},
  { code: 'accountant', label: 'Accountant', permissions: [
    'fees.read','fees.write','students.read','attendance.read',
    'institution.read','subjects.read','salary.read','salary.write',
  ]},
  { code: 'receptionist', label: 'Desk / Reception', permissions: [
    'inquiry.read','inquiry.write','students.read','users.read',
  ]},
  { code: 'non_teaching_staff', label: 'Non-Teaching Staff', permissions: ['attendance.read']},
  { code: 'student', label: 'Student', permissions: ['attendance.read','exams.read','fees.read']},
  { code: 'parent',  label: 'Parent',  permissions: ['attendance.read','exams.read','fees.read']},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function upsertRole(institutionId: string, def: (typeof ROLE_DEFS)[0]) {
  return prisma.role.upsert({
    where: { institutionId_code: { institutionId, code: def.code } },
    update: { permissions: def.permissions, label: def.label },
    create: { institutionId, code: def.code, label: def.label, permissions: def.permissions },
  });
}

async function ensureUser(
  institutionId: string,
  email: string,
  passwordHash: string,
  name?: string,
  phone?: string,
) {
  const existing = await prisma.user.findFirst({ where: { institutionId, email } });
  if (existing) {
    if (name && !existing.name) await prisma.user.update({ where: { id: existing.id }, data: { name, phone } });
    return existing;
  }
  return prisma.user.create({ data: { institutionId, email, passwordHash, isActive: true, name, phone } });
}

async function assignRole(userId: string, roleId: string, institutionId: string) {
  const exists = await prisma.userRole.findFirst({ where: { userId, roleId } });
  if (!exists) await prisma.userRole.create({ data: { userId, roleId, institutionId } });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await prisma.$connect();
  console.log('✅ Connected to database\n');

  // ── Find institution ────────────────────────────────────────────────────────
  const instCode = process.env.SEED_INST_CODE;
  if (!instCode) {
    const all = await prisma.institution.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    console.log('⚠️  SEED_INST_CODE not set. Available institutions:\n');
    all.forEach(i => console.log(`   code="${i.code}"  →  ${i.name}  (id: ${i.id})`));
    console.log('\nRun: SEED_INST_CODE=<code> npx ts-node --project tsconfig.seed.json prisma/seed-demo.ts\n');
    process.exit(0);
  }

  const institution = await prisma.institution.findUnique({ where: { code: instCode } });
  if (!institution) throw new Error(`Institution with code "${instCode}" not found.`);

  const INST = institution.id;
  const INST_NAME = institution.name;
  console.log(`🏫  Seeding: ${INST_NAME} (code: ${instCode}, id: ${INST})\n`);

  // ── Pre-compute password hashes (do once, reuse) ──────────────────────────
  console.log('🔐 Pre-computing password hashes...');
  const staffHash  = await bcrypt.hash('Demo@2025!', 10);
  const parentHash = await bcrypt.hash('parent123',  10);
  console.log('   Done.\n');

  // ── 1. Roles ───────────────────────────────────────────────────────────────
  console.log('── 1. Roles ──────────────────────────────────────────────────');
  const roleMap: Record<string, string> = {};
  for (const def of ROLE_DEFS) {
    const r = await upsertRole(INST, def);
    roleMap[def.code] = r.id;
    process.stdout.write(`   ✅ ${def.code}\n`);
  }

  // ── 2. Staff users ─────────────────────────────────────────────────────────
  console.log('\n── 2. Staff Users ────────────────────────────────────────────');
  const DOMAIN = 'demointl.edu.in';

  const director = await ensureUser(INST, `director@${DOMAIN}`, staffHash, 'Dr. Suresh Patil', '9800000001');
  await assignRole(director.id, roleMap['super_admin'], INST);
  console.log(`   ✅ Director: director@${DOMAIN} / Demo@2025!`);

  const operator = await ensureUser(INST, `operator@${DOMAIN}`, staffHash, 'Vedant Kulkarni', '9800000002');
  await assignRole(operator.id, roleMap['admin'], INST);
  console.log(`   ✅ Operator: operator@${DOMAIN} / Demo@2025!`);

  const principal = await ensureUser(INST, `principal@${DOMAIN}`, staffHash, 'Mrs. Anjali Joshi', '9800000003');
  await assignRole(principal.id, roleMap['principal'], INST);
  console.log(`   ✅ Principal: principal@${DOMAIN} / Demo@2025!`);

  const accountant = await ensureUser(INST, `accountant@${DOMAIN}`, staffHash, 'Mr. Ramesh Gupta', '9800000004');
  await assignRole(accountant.id, roleMap['accountant'], INST);
  console.log(`   ✅ Accountant: accountant@${DOMAIN} / Demo@2025!`);

  const reception = await ensureUser(INST, `reception@${DOMAIN}`, staffHash, 'Ms. Priya Sharma', '9800000005');
  await assignRole(reception.id, roleMap['receptionist'], INST);
  console.log(`   ✅ Receptionist: reception@${DOMAIN} / Demo@2025!`);

  const nonTeaching = await ensureUser(INST, `staff1@${DOMAIN}`, staffHash, 'Mr. Dinesh More', '9800000006');
  await assignRole(nonTeaching.id, roleMap['non_teaching_staff'], INST);
  console.log(`   ✅ Non-Teaching: staff1@${DOMAIN} / Demo@2025!`);

  // Teachers
  const teacherNames = ['Mr. Anil Desai','Mrs. Kavita Singh','Mr. Vijay Mehta','Ms. Sunita Jain','Mr. Prakash Rao'];
  const teacherSubjectMap = ['Mathematics','English','Science','Hindi','Social Studies'];
  const teachers: any[] = [];
  for (let i = 0; i < 5; i++) {
    const t = await ensureUser(INST, `teacher${i+1}@${DOMAIN}`, staffHash, teacherNames[i], `980000${(10+i).toString().padStart(4,'0')}`);
    await assignRole(t.id, roleMap['teacher'], INST);
    teachers.push(t);
    console.log(`   ✅ Teacher ${i+1}: teacher${i+1}@${DOMAIN} / Demo@2025!`);
  }

  // ── 3. Academic Year ───────────────────────────────────────────────────────
  console.log('\n── 3. Academic Year ──────────────────────────────────────────');
  const ay = await prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId: INST, name: '2025-26' } },
    update: { isCurrent: true },
    create: {
      id: `demo-ay-2025-26-${INST}`,
      institutionId: INST,
      name: '2025-26',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-03-31'),
      isCurrent: true,
    },
  });
  console.log(`   ✅ ${ay.name} (current)`);

  // ── 4. Class structure (Classes 1–8 with Div A & B; Classes 9–10 single) ──
  console.log('\n── 4. Class Structure ────────────────────────────────────────');

  const classParents: { id: string; displayName: string; classIdx: number }[] = [];
  const leafUnits:    { id: string; displayName: string; classIdx: number; div: string }[] = [];

  const classNames = ['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10'];

  for (let ci = 0; ci < classNames.length; ci++) {
    const cn = classNames[ci];
    const parentId = `demo-cls-${ci+1}-parent-${INST}`.slice(0, 30) + `${ci}p`;

    await prisma.academicUnit.upsert({
      where: { id: parentId },
      update: { academicYearId: ay.id, deletedAt: null, level: 1, parentId: null },
      create: {
        id: parentId,
        institutionId: INST,
        academicYearId: ay.id,
        name: `class_${ci+1}`,
        displayName: cn,
        level: 1,
        parentId: null,
      },
    });
    classParents.push({ id: parentId, displayName: cn, classIdx: ci });

    // Sections A and B (for all classes)
    for (const div of ['A','B']) {
      const sectionId = `demo-cls-${ci+1}-${div.toLowerCase()}-${INST}`.slice(0, 32) + `${ci}${div}`;
      await prisma.academicUnit.upsert({
        where: { id: sectionId },
        update: { academicYearId: ay.id, deletedAt: null, level: 2, parentId: parentId },
        create: {
          id: sectionId,
          institutionId: INST,
          academicYearId: ay.id,
          name: `class_${ci+1}_div_${div.toLowerCase()}`,
          displayName: `${cn} - Div ${div}`,
          level: 2,
          parentId: parentId,
          classTeacherUserId: div === 'A' ? teachers[ci % 5].id : teachers[(ci + 2) % 5].id,
        },
      });
      leafUnits.push({ id: sectionId, displayName: `${cn} - Div ${div}`, classIdx: ci, div });
    }
    process.stdout.write(`   ✅ ${cn} (Div A + B)\n`);
  }

  // ── 5. Subjects ────────────────────────────────────────────────────────────
  console.log('\n── 5. Subjects ───────────────────────────────────────────────');
  const SUBJECT_NAMES = ['English','Mathematics','Science','Hindi','Social Studies','Computer Science','Physical Education','Art & Craft'];
  const subjectMap: Record<string, string> = {};

  for (const name of SUBJECT_NAMES) {
    const s = await prisma.subject.upsert({
      where: { institutionId_name: { institutionId: INST, name } },
      update: { deletedAt: null },
      create: { institutionId: INST, name, code: name.slice(0,4).toUpperCase() },
    });
    subjectMap[name] = s.id;
    console.log(`   ✅ ${name}`);
  }

  // Assign subjects to leaf units with teachers
  const coreSubjects = ['English','Mathematics','Science','Hindi','Social Studies'];
  for (const leaf of leafUnits) {
    for (let si = 0; si < coreSubjects.length; si++) {
      const subName = coreSubjects[si];
      const teacherId = teachers[si % 5].id;
      try {
        await prisma.academicUnitSubject.upsert({
          where: { academicUnitId_subjectId: { academicUnitId: leaf.id, subjectId: subjectMap[subName] } },
          update: { teacherUserId: teacherId },
          create: {
            institutionId: INST,
            academicUnitId: leaf.id,
            subjectId: subjectMap[subName],
            teacherUserId: teacherId,
          },
        });
      } catch { /* skip duplicate */ }
    }
  }
  console.log('   ✅ Subjects assigned to all sections');

  // ── 6. Fee Heads ───────────────────────────────────────────────────────────
  console.log('\n── 6. Fee Heads ──────────────────────────────────────────────');
  const FEE_HEADS = [
    { name: 'Tuition Fee',     isCustom: false },
    { name: 'Development Fund',isCustom: false },
    { name: 'Exam Fee',        isCustom: false },
    { name: 'Library Fee',     isCustom: true  },
    { name: 'Sports Fee',      isCustom: true  },
  ];
  const feeHeadMap: Record<string, string> = {};
  for (const fh of FEE_HEADS) {
    const h = await prisma.feeHead.upsert({
      where: { institutionId_name: { institutionId: INST, name: fh.name } },
      update: { deletedAt: null, isCustom: fh.isCustom },
      create: { institutionId: INST, name: fh.name, isCustom: fh.isCustom },
    });
    feeHeadMap[fh.name] = h.id;
    console.log(`   ✅ ${fh.name}`);
  }

  // Fee structures per leaf unit
  console.log('\n── 7. Fee Structures ─────────────────────────────────────────');
  const feeStructureMap: Record<string, Record<string, string>> = {}; // unitId -> headName -> structId

  for (const leaf of leafUnits) {
    feeStructureMap[leaf.id] = {};
    const isSenior = leaf.classIdx >= 5; // Class 6+

    const structs = [
      { head: 'Tuition Fee',     amount: isSenior ? 2000 : 1500, installment: 'Annual' },
      { head: 'Development Fund',amount: isSenior ? 8000 : 5000, installment: 'Annual' },
      { head: 'Exam Fee',        amount: isSenior ? 700  : 500,  installment: 'Term 1' },
      { head: 'Library Fee',     amount: 300, installment: 'Annual' },
      { head: 'Sports Fee',      amount: 500, installment: 'Annual' },
    ];

    for (const s of structs) {
      try {
        const fs = await prisma.feeStructure.upsert({
          where: {
            academicUnitId_academicYearId_feeHeadId_installmentName: {
              academicUnitId: leaf.id,
              academicYearId: ay.id,
              feeHeadId: feeHeadMap[s.head],
              installmentName: s.installment,
            },
          },
          update: { amount: s.amount, deletedAt: null },
          create: {
            institutionId: INST,
            academicUnitId: leaf.id,
            academicYearId: ay.id,
            feeHeadId: feeHeadMap[s.head],
            amount: s.amount,
            installmentName: s.installment,
            dueDate: new Date('2025-07-15'),
          },
        });
        feeStructureMap[leaf.id][s.head] = fs.id;
      } catch { /* skip */ }
    }
  }
  console.log('   ✅ Fee structures created for all 20 sections');

  // ── 7. Students + Parent Accounts ─────────────────────────────────────────
  console.log('\n── 8. Students + Parents ─────────────────────────────────────');

  // 10 students per section = 200 total
  const STUDENTS_PER_SECTION = 10;
  const allStudents: { id: string; unitId: string; classIdx: number; seed: number }[] = [];
  let admCounter = 1;
  let receiptCounter = 1;

  for (const leaf of leafUnits) {
    const studentsInSection: any[] = [];

    for (let si = 0; si < STUDENTS_PER_SECTION; si++) {
      const seed = admCounter * 37 + leaf.classIdx * 13;
      const fn   = firstName(seed);
      const ln   = pick(LAST_NAMES, seed + 5);
      const admNo = `DIS-25-${String(admCounter).padStart(4,'0')}`;

      // Create parent user first
      const parentPhone = phone(seed + 9000);
      const parentEmail = `parent.${fn.toLowerCase()}${seed}@gmail.com`;
      let parentUser: any;
      try {
        parentUser = await prisma.user.upsert({
          where: { id: `demo-parent-${admCounter}-${INST}`.slice(0, 25) + `p${admCounter}` },
          update: {},
          create: {
            id: `demo-parent-${admCounter}-${INST}`.slice(0, 25) + `p${admCounter}`,
            institutionId: INST,
            email: parentEmail,
            phone: parentPhone,
            passwordHash: parentHash,
            name: `${pick(FATHER_FIRST, seed)} ${ln}`,
            isActive: true,
          },
        });
      } catch {
        parentUser = await prisma.user.findFirst({ where: { institutionId: INST, email: parentEmail } });
        if (!parentUser) {
          parentUser = await prisma.user.create({
            data: {
              institutionId: INST,
              email: `parent${admCounter}@demointl.edu.in`,
              phone: parentPhone,
              passwordHash: parentHash,
              name: `${pick(FATHER_FIRST, seed)} ${ln}`,
              isActive: true,
            },
          });
        }
      }
      await assignRole(parentUser.id, roleMap['parent'], INST);

      // Create student record
      try {
        const student = await prisma.student.upsert({
          where: { institutionId_admissionNo: { institutionId: INST, admissionNo: admNo } },
          update: { academicUnitId: leaf.id, parentUserId: parentUser.id },
          create: {
            institutionId: INST,
            admissionNo: admNo,
            rollNo: String(si + 1),
            firstName: fn,
            lastName: ln,
            dateOfBirth: dob(leaf.classIdx, seed),
            gender: gender(seed),
            phone: phone(seed),
            fatherName: `${pick(FATHER_FIRST, seed)} ${ln}`,
            motherName: `${pick(MOTHER_FIRST, seed)} ${ln}`,
            parentPhone: parentPhone,
            address: pick(ADDRESSES, seed),
            bloodGroup: pick(BLOOD_GROUPS, seed),
            nationality: 'Indian',
            religion: pick(RELIGIONS, seed),
            casteCategory: pick(CASTE_CATS, seed),
            admissionDate: new Date('2025-06-10'),
            academicUnitId: leaf.id,
            status: 'active',
            parentUserId: parentUser.id,
          },
        });
        studentsInSection.push(student);
        allStudents.push({ id: student.id, unitId: leaf.id, classIdx: leaf.classIdx, seed });
      } catch (e: any) {
        if (!e.message?.includes('Unique constraint')) throw e;
        const existing = await prisma.student.findUnique({
          where: { institutionId_admissionNo: { institutionId: INST, admissionNo: admNo } },
        });
        if (existing) {
          await prisma.student.update({ where: { id: existing.id }, data: { parentUserId: parentUser.id, academicUnitId: leaf.id } });
          studentsInSection.push(existing);
          allStudents.push({ id: existing.id, unitId: leaf.id, classIdx: leaf.classIdx, seed });
        }
      }

      admCounter++;
    }

    process.stdout.write(`   ✅ ${leaf.displayName}: ${studentsInSection.length} students\n`);
  }
  console.log(`\n   Total students: ${allStudents.length}`);

  // ── 8. Fee Payments (70% students paid Tuition Fee, 50% paid Development Fund) ──
  console.log('\n── 9. Fee Payments ───────────────────────────────────────────');
  const paymentRows: any[] = [];
  for (let i = 0; i < allStudents.length; i++) {
    const s = allStudents[i];
    const fsMap = feeStructureMap[s.unitId] ?? {};

    if (i % 10 < 7 && fsMap['Tuition Fee']) {
      paymentRows.push({
        institutionId: INST,
        studentId: s.id,
        feeHeadId: feeHeadMap['Tuition Fee'],
        feeStructureId: fsMap['Tuition Fee'],
        academicYearId: ay.id,
        installmentName: 'Annual',
        amount: s.classIdx >= 5 ? 2000 : 1500,
        paymentMode: ['cash','upi','bank_transfer'][i % 3],
        receiptNo: `DIS-RCP-${String(receiptCounter++).padStart(5,'0')}`,
        paidOn: new Date('2025-07-10'),
      });
    }
    if (i % 2 === 0 && fsMap['Development Fund']) {
      paymentRows.push({
        institutionId: INST,
        studentId: s.id,
        feeHeadId: feeHeadMap['Development Fund'],
        feeStructureId: fsMap['Development Fund'],
        academicYearId: ay.id,
        installmentName: 'Annual',
        amount: s.classIdx >= 5 ? 8000 : 5000,
        paymentMode: 'cash',
        receiptNo: `DIS-RCP-${String(receiptCounter++).padStart(5,'0')}`,
        paidOn: new Date('2025-07-12'),
      });
    }
  }
  const pmtResult = await prisma.feePayment.createMany({ data: paymentRows, skipDuplicates: true });
  console.log(`   ✅ ${pmtResult.count} fee payments created (30% are defaulters)`);

  // ── 9. Attendance (past 60 business days) ─────────────────────────────────
  console.log('\n── 10. Attendance Records ────────────────────────────────────');

  const today     = new Date('2026-04-21');
  const sixtyBack = new Date(today);
  sixtyBack.setDate(sixtyBack.getDate() - 90);
  const days = businessDays(sixtyBack, new Date('2026-04-18')).slice(-60);

  // For each leaf unit, create daily attendance sessions
  // Most students: 90%+ attendance; 3 students per section < 75% (defaulters)
  let sessionCount = 0;
  let recordCount  = 0;

  // Use first 10 days only for full seeding to keep it fast (still shows data)
  const ATTENDANCE_DAYS = days.slice(-20); // last 20 working days

  for (const leaf of leafUnits) {
    const unitStudents = allStudents.filter(s => s.unitId === leaf.id);
    if (unitStudents.length === 0) continue;

    // 3 students in this section are "defaulters" (attend < 60% of days)
    const defaulterIndices = new Set([0, 3, 7]);

    for (const day of ATTENDANCE_DAYS) {
      try {
        let session = await prisma.attendanceSession.findFirst({
          where: { academicUnitId: leaf.id, date: day, subjectId: null },
        });
        if (!session) {
          session = await prisma.attendanceSession.create({
            data: {
              institutionId: INST,
              academicUnitId: leaf.id,
              subjectId: null,
              date: day,
              takenByUserId: teachers[leaf.classIdx % 5].id,
            },
          });
        }
        sessionCount++;

        const recordsToCreate = unitStudents.map((student, si) => {
          const isDefaulter = defaulterIndices.has(si);
          const isAbsent = isDefaulter
            ? (day.getDate() % 2 === 0)
            : (day.getDate() === 7 || day.getDate() === 14 || day.getDate() === 21);
          return {
            institutionId: INST,
            sessionId: session.id,
            studentId: student.id,
            status: isAbsent ? 'absent' : 'present',
          };
        });
        const res = await prisma.attendanceRecord.createMany({
          data: recordsToCreate,
          skipDuplicates: true,
        });
        recordCount += res.count;
      } catch { /* skip session duplicate */ }
    }
    process.stdout.write(`   ✅ ${leaf.displayName}: ${ATTENDANCE_DAYS.length} days\n`);
  }
  console.log(`   Sessions: ${sessionCount} | Records: ${recordCount}`);

  // ── 10. Exams + Results ────────────────────────────────────────────────────
  console.log('\n── 11. Exams + Results ───────────────────────────────────────');

  const exam1 = await prisma.exam.upsert({
    where: { id: `demo-exam-ut1-${INST}` },
    update: {},
    create: {
      id: `demo-exam-ut1-${INST}`,
      institutionId: INST,
      academicYearId: ay.id,
      name: 'Unit Test 1',
      startDate: new Date('2025-08-10'),
      endDate: new Date('2025-08-15'),
      status: 'published',
      examCenter: 'Main Block',
    },
  });

  const exam2 = await prisma.exam.upsert({
    where: { id: `demo-exam-mid-${INST}` },
    update: {},
    create: {
      id: `demo-exam-mid-${INST}`,
      institutionId: INST,
      academicYearId: ay.id,
      name: 'Mid-Term Examination',
      startDate: new Date('2025-10-05'),
      endDate: new Date('2025-10-15'),
      status: 'published',
      examCenter: 'Main Block',
      reportingTime: '30 minutes before exam',
    },
  });
  console.log('   ✅ Exams: Unit Test 1, Mid-Term Examination');

  // Exam subjects + results (for first 5 core subjects, all leaf units)
  const coreSubjectNames = ['English','Mathematics','Science','Hindi','Social Studies'];
  let resultCount = 0;

  for (const exam of [exam1, exam2]) {
    const examResultRows: any[] = [];
    for (const leaf of leafUnits) {
      const unitStudents = allStudents.filter(s => s.unitId === leaf.id);
      for (const subName of coreSubjectNames) {
        const subId = subjectMap[subName];
        try {
          await prisma.examSubject.upsert({
            where: { examId_academicUnitId_subjectId: { examId: exam.id, academicUnitId: leaf.id, subjectId: subId } },
            update: {},
            create: { examId: exam.id, academicUnitId: leaf.id, subjectId: subId, maxMarks: 100, passingMarks: 35, examDate: exam.startDate },
          });
        } catch { /* skip */ }

        for (let si = 0; si < unitStudents.length; si++) {
          const student = unitStudents[si];
          const baseMarks = 45 + (student.seed % 45);
          const marks = subName === 'Mathematics' ? baseMarks : baseMarks + (si % 10);
          examResultRows.push({
            institutionId: INST,
            examId: exam.id,
            studentId: student.id,
            subjectId: subId,
            academicUnitId: leaf.id,
            marksObtained: Math.min(marks, 100),
            isAbsent: false,
          });
        }
      }
    }
    const r = await prisma.examResult.createMany({ data: examResultRows, skipDuplicates: true });
    resultCount += r.count;
    console.log(`   ✅ ${exam.name}: ${r.count} results`);
  }
  console.log(`   ✅ Total: ${resultCount} exam results`);

  // ── 11. Announcements ──────────────────────────────────────────────────────
  console.log('\n── 12. Announcements ─────────────────────────────────────────');
  const ANNOUNCEMENTS = [
    {
      title: 'Welcome Back — Academic Year 2025-26',
      body: 'We warmly welcome all students, parents, and staff to the new academic year. School begins 2 June 2025. All students must report in full uniform.',
      targetRoles: ['all'],
      isPinned: true,
    },
    {
      title: 'Unit Test 1 Schedule Released',
      body: 'Unit Test 1 will be held from 10–15 August 2025. Detailed timetable is available on the notice board. Students must carry their hall tickets.',
      targetRoles: ['student','parent','teacher'],
      isPinned: false,
    },
    {
      title: 'Fee Payment Reminder',
      body: 'Annual tuition fee and development fund are due by 15 July 2025. Kindly ensure timely payment to avoid late charges.',
      targetRoles: ['parent'],
      isPinned: false,
    },
    {
      title: 'Staff Meeting — 28 April 2025',
      body: 'All teaching and non-teaching staff are required to attend the staff meeting on 28 April 2025 at 4:00 PM in the conference hall.',
      targetRoles: ['teacher','receptionist','non_teaching_staff','accountant','principal'],
      isPinned: false,
    },
    {
      title: 'Mid-Term Examination Notice',
      body: 'Mid-Term Examinations will be held from 5–15 October 2025. Syllabus coverage is up to Chapter 6 in all subjects. Students are advised to start revision.',
      targetRoles: ['student','parent','teacher'],
      isPinned: true,
    },
  ];

  for (const ann of ANNOUNCEMENTS) {
    try {
      await prisma.announcement.create({
        data: {
          institutionId: INST,
          title: ann.title,
          body: ann.body,
          authorUserId: director.id,
          targetRoles: ann.targetRoles,
          isPinned: ann.isPinned,
        },
      });
      console.log(`   ✅ "${ann.title}"`);
    } catch { /* skip duplicate */ }
  }

  // ── 12. Salary Structures ─────────────────────────────────────────────────
  console.log('\n── 13. Salary Structures ─────────────────────────────────────');
  const salaryStructures = [
    { name: 'Teacher Grade A', basic: 35000, hra: 8750, medical: 1500, transport: 2000, pf: 4200, pt: 200 },
    { name: 'Admin Grade B',   basic: 28000, hra: 7000, medical: 1200, transport: 1500, pf: 3360, pt: 200 },
    { name: 'Support Staff',   basic: 18000, hra: 4500, medical: 800,  transport: 1000, pf: 2160, pt: 150 },
  ];
  const salaryStructureIds: Record<string, string> = {};
  for (const ss of salaryStructures) {
    const r = await prisma.salaryStructure.upsert({
      where: { institutionId_name: { institutionId: INST, name: ss.name } },
      update: {},
      create: {
        institutionId: INST,
        name: ss.name,
        basicSalary: ss.basic,
        houseRentAllowance: ss.hra,
        medicalAllowance: ss.medical,
        transportAllowance: ss.transport,
        providentFund: ss.pf,
        professionalTax: ss.pt,
        isActive: true,
      },
    });
    salaryStructureIds[ss.name] = r.id;
    console.log(`   ✅ ${ss.name}`);
  }

  // Assign salary profiles to staff
  const staffWithStructures = [
    { user: director,    structName: 'Admin Grade B'   },
    { user: operator,    structName: 'Admin Grade B'   },
    { user: principal,   structName: 'Teacher Grade A' },
    { user: accountant,  structName: 'Admin Grade B'   },
    { user: reception,   structName: 'Support Staff'   },
    { user: nonTeaching, structName: 'Support Staff'   },
    ...teachers.map(t => ({ user: t, structName: 'Teacher Grade A' })),
  ];
  for (const { user, structName } of staffWithStructures) {
    try {
      const ss = salaryStructures.find(s => s.name === structName)!;
      await prisma.staffSalaryProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          institutionId: INST,
          userId: user.id,
          structureId: salaryStructureIds[structName],
          basicSalary: ss.basic,
          houseRentAllowance: ss.hra,
          medicalAllowance: ss.medical,
          transportAllowance: ss.transport,
          providentFund: ss.pf,
          professionalTax: ss.pt,
          effectiveFrom: new Date('2025-06-01'),
          isActive: true,
        },
      });
    } catch { /* skip */ }
  }
  console.log('   ✅ Salary profiles assigned to all staff');

  // ── 13. Inquiries ─────────────────────────────────────────────────────────
  console.log('\n── 14. Sample Inquiries ──────────────────────────────────────');
  const inquiries = [
    { firstName:'Meera', lastName:'Kadam',  phone:'9876543210', classInterest:'Class 6', status:'new',       notes:'Called for Class 6 admission' },
    { firstName:'Ravi',  lastName:'Pawar',  phone:'9876543211', classInterest:'Class 1', status:'contacted', notes:'Visit scheduled for 25 April' },
    { firstName:'Anita', lastName:'Joshi',  phone:'9876543212', classInterest:'Class 3', status:'visited',   notes:'Interested in CBSE board' },
    { firstName:'Suresh',lastName:'Shinde', phone:'9876543213', classInterest:'Class 9', status:'enrolled',  notes:'Admission fee paid' },
    { firstName:'Priya', lastName:'More',   phone:'9876543214', classInterest:'Class 5', status:'new',       notes:'Wants Art & Craft program info' },
  ];
  for (const inq of inquiries) {
    try {
      await prisma.inquiry.create({
        data: { institutionId: INST, ...inq, academicYearId: ay.id },
      });
    } catch { /* skip */ }
  }
  console.log('   ✅ 5 sample inquiries created');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    🎉 DEMO SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Institution : ${INST_NAME}`);
  console.log(`  Login code  : ${instCode}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  ROLE          EMAIL                            PASSWORD');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Director    : director@${DOMAIN}    Demo@2025!`);
  console.log(`  Operator    : operator@${DOMAIN}    Demo@2025!`);
  console.log(`  Principal   : principal@${DOMAIN}   Demo@2025!`);
  console.log(`  Accountant  : accountant@${DOMAIN}  Demo@2025!`);
  console.log(`  Receptionist: reception@${DOMAIN}   Demo@2025!`);
  console.log(`  Teacher 1-5 : teacher1@${DOMAIN}    Demo@2025!`);
  console.log(`  Parent      : parent.aarav37@gmail.com         parent123`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  DATA SEEDED:');
  console.log('  • 10 Classes (1–10), each with Div A & B = 20 sections');
  console.log(`  • ${allStudents.length} students (10 per section) with linked parent accounts`);
  console.log('  • 5 core subjects assigned to all sections');
  console.log('  • 5 fee heads + fee structures (junior/senior pricing)');
  console.log('  • Fee payments: 70% paid tuition, 30% are defaulters');
  console.log('  • Attendance: last 20 working days (3 defaulters per section)');
  console.log('  • 2 exams with results: Unit Test 1 + Mid-Term');
  console.log('  • 5 announcements, 5 inquiries');
  console.log('  • 3 salary structures + profiles for all staff');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('\n❌ Seed failed:', e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
