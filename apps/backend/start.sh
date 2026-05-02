#!/bin/sh

echo "[start] Running schema sync: creating/altering tables via Prisma client..."
node - << 'JSSQL'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run(label, statements) {
  let ok = 0, warned = 0;
  for (const sql of statements) {
    const s = sql.trim();
    if (!s) continue;
    try {
      await prisma.$executeRawUnsafe(s);
      ok++;
    } catch (e) {
      console.warn('[sql] WARN (' + label + '):', (e.message || '').slice(0, 200));
      warned++;
    }
  }
  console.log('[sql] ' + label + ': ' + ok + ' ok, ' + warned + ' warned');
}

(async () => {
  // 1. Student columns — ALL schema fields
  await run('student columns', [
    // Core lifecycle fields (critical — used in every findMany/count query)
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "status"    TEXT NOT NULL DEFAULT 'active'`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
    // User account linking
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "userId"     TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parentUserId" TEXT`,
    // Basic fields that may have been added after initial migration
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "rollNo"            TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherName"        TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherName"        TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parentPhone"       TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "secondaryPhone"    TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "admissionDate"     TIMESTAMP(3)`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "academicUnitId"    TEXT`,
    // Demographic
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "nationality"       TEXT DEFAULT 'Indian'`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "religion"          TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "casteCategory"     TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "bloodGroup"        TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "aadharNumber"      TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "hasDisability"     BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "disabilityDetails" TEXT`,
    // TC / Previous school
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tcFromPrevious"        TEXT DEFAULT 'not_applicable'`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tcReceivedDate"         TIMESTAMP(3)`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tcPreviousInstitution"  TEXT`,
    // Extended fields
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middleName"               TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "placeOfBirth"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherTongue"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherOccupation"         TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherQualification"      TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherEmail"              TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherAadhar"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherOccupation"         TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherQualification"      TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherEmail"              TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherAadhar"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "annualIncome"             TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "isEwsCategory"            BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactName"     TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactPhone"    TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality"                 TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "city"                     TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "state"                    TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pinCode"                  TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousClass"            TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousBoard"            TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousMarks"            TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medicalConditions"        TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address"                  TEXT`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "siblingGroupId"           TEXT`,
  ]);

  // 2. Institution columns — ALL schema fields (findMany enumerates every column)
  await run('institution columns', [
    // Core fields that may be missing if added after initial migration
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "status"              TEXT NOT NULL DEFAULT 'active'`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "features"            JSONB`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "address"             TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "phone"               TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "email"               TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "website"             TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "board"               TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "deletedAt"           TIMESTAMP(3)`,
    // Extended profile fields
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "logoUrl"             TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "principalName"       TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "tagline"             TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "affiliationNo"       TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "udiseCode"           TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "gstin"               TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "pan"                 TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "recognitionNo"       TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "foundedYear"         INTEGER`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "mediumOfInstruction" TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "schoolType"          TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "managementType"      TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "stampUrl"            TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "signatureUrl"        TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankName"            TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankAccountNo"       TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankIfsc"            TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankBranch"          TEXT`,
    `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankAccountHolder"   TEXT`,
  ]);

  // 3. Users — critical columns used in every query
  await run('user columns', [
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name"      TEXT`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  ]);

  // 4. staff_profiles
  await run('staff_profiles', [
    `CREATE TABLE IF NOT EXISTS "staff_profiles" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "userId" TEXT NOT NULL,
      "employeeId" TEXT, "designation" TEXT, "department" TEXT,
      "dateOfJoining" TIMESTAMP(3), "dateOfBirth" TIMESTAMP(3), "gender" TEXT,
      "qualification" TEXT, "experience" TEXT, "address" TEXT, "bloodGroup" TEXT,
      "aadharNumber" TEXT, "panNumber" TEXT, "bankAccount" TEXT, "ifscCode" TEXT,
      "bankName" TEXT, "emergencyContactName" TEXT, "emergencyContactPhone" TEXT,
      "photoUrl" TEXT, "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_userId_key" ON "staff_profiles"("userId")`,
    `CREATE INDEX IF NOT EXISTS "staff_profiles_institutionId_idx" ON "staff_profiles"("institutionId")`,
    `DO $$ BEGIN ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 4. fee_categories
  await run('fee_categories', [
    `CREATE TABLE IF NOT EXISTS "fee_categories" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "name" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'CUSTOM', "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fee_categories_institutionId_name_key" ON "fee_categories"("institutionId","name")`,
    `CREATE INDEX IF NOT EXISTS "fee_categories_institutionId_idx" ON "fee_categories"("institutionId")`,
    `DO $$ BEGIN ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 5. fee_plans
  await run('fee_plans', [
    `CREATE TABLE IF NOT EXISTS "fee_plans" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
      "name" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fee_plans_institutionId_name_academicYearId_key" ON "fee_plans"("institutionId","name","academicYearId")`,
    `CREATE INDEX IF NOT EXISTS "fee_plans_institutionId_idx" ON "fee_plans"("institutionId")`,
    `CREATE INDEX IF NOT EXISTS "fee_plans_academicYearId_idx" ON "fee_plans"("academicYearId")`,
    `DO $$ BEGIN ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 6. fee_plan_items
  await run('fee_plan_items', [
    `CREATE TABLE IF NOT EXISTS "fee_plan_items" (
      "id" TEXT NOT NULL, "feePlanId" TEXT NOT NULL, "feeCategoryId" TEXT NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL, CONSTRAINT "fee_plan_items_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_items_feePlanId_feeCategoryId_key" ON "fee_plan_items"("feePlanId","feeCategoryId")`,
    `DO $$ BEGIN ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feePlanId_fkey"
      FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feeCategoryId_fkey"
      FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 7. fee_plan_installments
  await run('fee_plan_installments', [
    `CREATE TABLE IF NOT EXISTS "fee_plan_installments" (
      "id" TEXT NOT NULL, "feePlanItemId" TEXT NOT NULL, "label" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL, "dueDate" DATE, "sortOrder" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "fee_plan_installments_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_installments_feePlanItemId_label_key" ON "fee_plan_installments"("feePlanItemId","label")`,
    `DO $$ BEGIN ALTER TABLE "fee_plan_installments" ADD CONSTRAINT "fee_plan_installments_feePlanItemId_fkey"
      FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 8. fee_plan_class_maps
  await run('fee_plan_class_maps', [
    `CREATE TABLE IF NOT EXISTS "fee_plan_class_maps" (
      "id" TEXT NOT NULL, "feePlanId" TEXT NOT NULL, "academicUnitId" TEXT NOT NULL,
      CONSTRAINT "fee_plan_class_maps_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_class_maps_feePlanId_academicUnitId_key" ON "fee_plan_class_maps"("feePlanId","academicUnitId")`,
    `DO $$ BEGIN ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_feePlanId_fkey"
      FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_academicUnitId_fkey"
      FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 9. fee_concessions
  await run('fee_concessions', [
    `CREATE TABLE IF NOT EXISTS "fee_concessions" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
      "feePlanItemId" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "reason" TEXT NOT NULL,
      "approvedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "fee_concessions_institutionId_idx" ON "fee_concessions"("institutionId")`,
    `CREATE INDEX IF NOT EXISTS "fee_concessions_studentId_idx" ON "fee_concessions"("studentId")`,
    `DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_feePlanItemId_fkey"
      FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 10. fee_collections
  await run('fee_collections', [
    `CREATE TABLE IF NOT EXISTS "fee_collections" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
      "feePlanItemId" TEXT, "feePlanInstallmentId" TEXT, "feeCategoryId" TEXT NOT NULL,
      "academicYearId" TEXT, "amount" DOUBLE PRECISION NOT NULL,
      "paymentMode" TEXT NOT NULL DEFAULT 'cash', "receiptNo" TEXT NOT NULL,
      "paidOn" DATE NOT NULL, "remarks" TEXT, "collectedByUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fee_collections_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fee_collections_institutionId_receiptNo_key" ON "fee_collections"("institutionId","receiptNo")`,
    `CREATE INDEX IF NOT EXISTS "fee_collections_institutionId_idx" ON "fee_collections"("institutionId")`,
    `CREATE INDEX IF NOT EXISTS "fee_collections_studentId_idx" ON "fee_collections"("studentId")`,
    `CREATE INDEX IF NOT EXISTS "fee_collections_paidOn_idx" ON "fee_collections"("paidOn")`,
    `CREATE INDEX IF NOT EXISTS "fee_collections_academicYearId_idx" ON "fee_collections"("academicYearId")`,
    `CREATE INDEX IF NOT EXISTS "fee_collections_feePlanInstallmentId_idx" ON "fee_collections"("feePlanInstallmentId")`,
    `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanItemId_fkey"
      FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanInstallmentId_fkey"
      FOREIGN KEY ("feePlanInstallmentId") REFERENCES "fee_plan_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feeCategoryId_fkey"
      FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_collectedByUserId_fkey"
      FOREIGN KEY ("collectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 11. conversations
  await run('conversations', [
    `CREATE TABLE IF NOT EXISTS "conversations" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
      "parentUserId" TEXT NOT NULL, "teacherUserId" TEXT NOT NULL,
      "studentId" TEXT, "subject" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "conversations_institutionId_parentUserId_teacherUserId_studentId_key"
      ON "conversations"("institutionId","parentUserId","teacherUserId","studentId")`,
    `CREATE INDEX IF NOT EXISTS "conversations_institutionId_idx" ON "conversations"("institutionId")`,
    `CREATE INDEX IF NOT EXISTS "conversations_parentUserId_idx" ON "conversations"("parentUserId")`,
    `CREATE INDEX IF NOT EXISTS "conversations_teacherUserId_idx" ON "conversations"("teacherUserId")`,
    `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_parentUserId_fkey"
      FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_teacherUserId_fkey"
      FOREIGN KEY ("teacherUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 12. messages
  await run('messages', [
    `CREATE TABLE IF NOT EXISTS "messages" (
      "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
      "content" TEXT NOT NULL, "readAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "messages_conversationId_idx" ON "messages"("conversationId")`,
    `CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages"("senderId")`,
    `DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]);

  // 13. subscriptions
  await run('subscriptions', [
    `CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
      "planName" TEXT NOT NULL DEFAULT 'standard',
      "maxStudents" INTEGER NOT NULL DEFAULT 500,
      "pricePerUser" DOUBLE PRECISION NOT NULL DEFAULT 50,
      "billingCycleYears" INTEGER NOT NULL DEFAULT 1,
      "totalAmount" DOUBLE PRECISION NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "amountPaid" DOUBLE PRECISION,
      "paidAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_institutionId_key" ON "subscriptions"("institutionId")`,
    `DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "amountPaid"        DOUBLE PRECISION`,
    `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paidAt"            TIMESTAMP(3)`,
    `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "notes"             TEXT`,
    `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "planName"          TEXT NOT NULL DEFAULT 'standard'`,
    `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billingCycleYears" INTEGER NOT NULL DEFAULT 1`,
  ]);

  // 14. Admin role permissions
  await run('admin role permissions', [
    `UPDATE "roles"
     SET "permissions" = '["users.read","users.write","users.assignRole","roles.read","students.read","students.write","fees.read","fees.write","attendance.read","attendance.write","exams.read","exams.write","subjects.read","subjects.write","academic.read","academic.write","institution.read","institution.write","inquiry.read","inquiry.write"]'::jsonb
     WHERE "code" = 'admin'`,
  ]);

  await prisma.$disconnect();
  console.log('[sql] All schema sync complete.');
})().catch(async (e) => {
  console.warn('[sql] Fatal:', (e.message || '').slice(0, 300));
  await prisma.$disconnect().catch(() => {});
});
JSSQL

echo "[start] Syncing migrations into _prisma_migrations (upsert via Prisma client)..."
node - << 'JSSYNC'
const { createHash, randomUUID } = require('crypto');
const { readFileSync, existsSync } = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALL_MIGRATIONS = [
  '20260306173811_add_student_model',
  '20260315194341_add_auth_rbac_audit_models',
  '20260315194539_add_auth_rbac_audit_models',
  '20260403200244_add_refresh_tokens',
  '20260406100501_admission_fields',
  '20260406102205_academic_unit',
  '20260406170021_add_address_sibling_academic_year',
  '20260406170602_add_inquiry',
  '20260406172549_add_student_demographics',
  '20260406211252_add_subjects_attendance_fees_exams',
  '20260406212208_add_exam_result_subject_relation',
  '20260408000000_add_class_teacher_to_unit',
  '20260408010000_add_timetable_slots',
  '20260408020000_subject_teacher_relation',
  '20260408030000_add_password_reset_requests',
  '20260408050000_add_platform_admin_subscription',
  '20260410000000_add_institution_profile_fields',
  '20260412000000_fix_institution_profile_columns',
  '20260412010000_add_announcements_staff_tables',
  '20260413000000_update_roles_add_accountant_staff',
  '20260413100000_soft_delete_exam_announcement_feestructure',
  '20260413150000_add_parent_user_id_to_students',
  '20260414000000_add_perf_indexes',
  '20260414100000_platform_admin_last_login',
  '20260414110000_add_user_id_to_students',
  '20260417000000_add_support_tickets',
  '20260418000000_add_calendar_events',
  '20260418100000_platform_security_hardening',
  '20260418110000_platform_session_emails',
  '20260421000000_totp_email_reset_auth',
  '20260428000000_add_student_documents',
  '20260428010000_add_name_to_users',
  '20260428020000_fix_schema_drift',
  '20260428030000_fix_full_schema_drift',
  '20260429000000_extend_student_admission_fields',
  '20260429010000_institution_profile_extended',
  '20260429020000_staff_profile',
  '20260429030000_fee_plan_system',
  '20260430060000_institution_extended_profile',
  '20260430120000_messaging',
  '20260430150000_fix_admin_role_permissions',
  '20260501000000_ensure_fee_collections',
];

(async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                  VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum"            VARCHAR(64) NOT NULL,
        "finished_at"         TIMESTAMPTZ,
        "migration_name"      VARCHAR(255) NOT NULL,
        "logs"                TEXT,
        "rolled_back_at"      TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "applied_steps_count" INT NOT NULL DEFAULT 0
      )
    `);
    console.log('[checksum] _prisma_migrations table ready');
  } catch (e) {
    console.warn('[checksum] Could not ensure _prisma_migrations:', (e.message || '').slice(0, 150));
  }

  for (const name of ALL_MIGRATIONS) {
    const file = `./prisma/migrations/${name}/migration.sql`;
    if (!existsSync(file)) { console.log(`[checksum] Skipping (no file): ${name}`); continue; }
    const checksum = createHash('sha256').update(readFileSync(file)).digest('hex');
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = $1`,
        name
      );
      if (rows.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations"
             ("id","checksum","started_at","finished_at","migration_name","logs","rolled_back_at","applied_steps_count")
           VALUES ($1,$2,NOW(),NOW(),$3,NULL,NULL,1)`,
          randomUUID(), checksum, name
        );
        console.log('[checksum] Registered:', name);
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "_prisma_migrations"
           SET "checksum"=$1, "finished_at"=COALESCE("finished_at",NOW()), "rolled_back_at"=NULL
           WHERE "migration_name"=$2`,
          checksum, name
        );
        console.log('[checksum] Synced:', name);
      }
    } catch (e) {
      console.warn('[checksum] Warning for', name + ':', (e.message || '').slice(0, 150));
    }
  }
  await prisma.$disconnect();
  console.log('[checksum] Done.');
})().catch(async (e) => {
  console.warn('[checksum] Fatal error:', (e.message || '').slice(0, 300));
  await prisma.$disconnect().catch(() => {});
});
JSSYNC

echo "[start] Seeding platform admins (idempotent)..."
node - << 'JSSEED'
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMINS = [
  { email: 'sankalp.deshpande@infovion.in', name: 'Sankalp Deshpande', password: 'Infovion@Admin1' },
  { email: 'pratik.gore@infovion.in',        name: 'Pratik Gore',       password: 'Infovion@Admin2' },
];

(async () => {
  for (const admin of ADMINS) {
    try {
      const existing = await prisma.platformAdmin.findUnique({ where: { email: admin.email } });
      if (existing) { console.log('[seed] Already exists:', admin.email); continue; }
      const passwordHash = await bcrypt.hash(admin.password, 12);
      await prisma.platformAdmin.create({
        data: { email: admin.email, name: admin.name, passwordHash, isActive: true },
      });
      console.log('[seed] Created platform admin:', admin.email);
    } catch (e) {
      console.warn('[seed] Warning for', admin.email + ':', (e.message || '').slice(0, 150));
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.warn('[seed] Fatal:', (e.message || '').slice(0, 300));
  await prisma.$disconnect().catch(() => {});
});
JSSEED

echo "[start] Pushing schema to DB (catches any remaining drift)..."
npx prisma db push --skip-generate --accept-data-loss || echo "[start] WARN: db push returned non-zero — continuing"

echo "[start] Starting application..."
exec node dist/src/main
