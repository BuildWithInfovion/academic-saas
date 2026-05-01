#!/bin/sh
set -e

echo "[start] Running preflight: ensuring all critical tables and columns exist..."
node - << 'JSPREFLIGHT'
const { execSync } = require('child_process');

function run(label, sql) {
  try {
    execSync('npx prisma db execute --stdin', {
      input: sql, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log('[preflight] OK:', label);
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || '').toString().slice(0, 300);
    console.warn('[preflight] WARN (', label, '):', msg);
  }
}

// ── 1. New student columns ────────────────────────────────────────────────────
run('student columns', `
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middleName"               TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "placeOfBirth"             TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherTongue"             TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherOccupation"         TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherQualification"      TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherEmail"              TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherAadhar"             TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherOccupation"         TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherQualification"      TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherEmail"              TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherAadhar"             TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "annualIncome"             TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "isEwsCategory"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactName"     TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactPhone"    TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality"                 TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "city"                     TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "state"                    TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pinCode"                  TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousClass"            TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousBoard"            TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousMarks"            TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medicalConditions"        TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address"                  TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "siblingGroupId"           TEXT;
`);

// ── 2. Institution branding + compliance + bank columns ───────────────────────
run('institution columns', `
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "logoUrl"             TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "principalName"       TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "tagline"             TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "affiliationNo"       TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "udiseCode"           TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "gstin"               TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "pan"                 TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "recognitionNo"       TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "foundedYear"         INTEGER;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "mediumOfInstruction" TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "schoolType"          TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "managementType"      TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "stampUrl"            TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "signatureUrl"        TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankName"            TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankAccountNo"       TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankIfsc"            TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankBranch"          TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "bankAccountHolder"   TEXT;
`);

// ── 3. staff_profiles table ───────────────────────────────────────────────────
run('staff_profiles table', `
CREATE TABLE IF NOT EXISTS "staff_profiles" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_userId_key"        ON "staff_profiles"("userId");
CREATE INDEX        IF NOT EXISTS "staff_profiles_institutionId_idx" ON "staff_profiles"("institutionId");
`);
run('staff_profiles fkeys', `
DO $$ BEGIN ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);

// ── 4. Fee plan tables ────────────────────────────────────────────────────────
run('fee_categories table', `
CREATE TABLE IF NOT EXISTS "fee_categories" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'CUSTOM', "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_categories_institutionId_name_key" ON "fee_categories"("institutionId","name");
CREATE INDEX        IF NOT EXISTS "fee_categories_institutionId_idx"      ON "fee_categories"("institutionId");
DO $$ BEGIN ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('fee_plans table', `
CREATE TABLE IF NOT EXISTS "fee_plans" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plans_institutionId_name_academicYearId_key" ON "fee_plans"("institutionId","name","academicYearId");
CREATE INDEX        IF NOT EXISTS "fee_plans_institutionId_idx"                     ON "fee_plans"("institutionId");
CREATE INDEX        IF NOT EXISTS "fee_plans_academicYearId_idx"                    ON "fee_plans"("academicYearId");
DO $$ BEGIN ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('fee_plan_items table', `
CREATE TABLE IF NOT EXISTS "fee_plan_items" (
  "id" TEXT NOT NULL, "feePlanId" TEXT NOT NULL, "feeCategoryId" TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL, CONSTRAINT "fee_plan_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_items_feePlanId_feeCategoryId_key" ON "fee_plan_items"("feePlanId","feeCategoryId");
DO $$ BEGIN ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feePlanId_fkey"
  FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feeCategoryId_fkey"
  FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('fee_plan_installments table', `
CREATE TABLE IF NOT EXISTS "fee_plan_installments" (
  "id" TEXT NOT NULL, "feePlanItemId" TEXT NOT NULL, "label" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL, "dueDate" DATE, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "fee_plan_installments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_installments_feePlanItemId_label_key" ON "fee_plan_installments"("feePlanItemId","label");
DO $$ BEGIN ALTER TABLE "fee_plan_installments" ADD CONSTRAINT "fee_plan_installments_feePlanItemId_fkey"
  FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('fee_plan_class_maps table', `
CREATE TABLE IF NOT EXISTS "fee_plan_class_maps" (
  "id" TEXT NOT NULL, "feePlanId" TEXT NOT NULL, "academicUnitId" TEXT NOT NULL,
  CONSTRAINT "fee_plan_class_maps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_class_maps_feePlanId_academicUnitId_key" ON "fee_plan_class_maps"("feePlanId","academicUnitId");
DO $$ BEGIN ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_feePlanId_fkey"
  FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_academicUnitId_fkey"
  FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('fee_concessions table', `
CREATE TABLE IF NOT EXISTS "fee_concessions" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "feePlanItemId" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "reason" TEXT NOT NULL,
  "approvedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fee_concessions_institutionId_idx" ON "fee_concessions"("institutionId");
CREATE INDEX IF NOT EXISTS "fee_concessions_studentId_idx"     ON "fee_concessions"("studentId");
DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_feePlanItemId_fkey"
  FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('fee_collections table', `
CREATE TABLE IF NOT EXISTS "fee_collections" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "feePlanItemId" TEXT, "feePlanInstallmentId" TEXT, "feeCategoryId" TEXT NOT NULL,
  "academicYearId" TEXT, "amount" DOUBLE PRECISION NOT NULL,
  "paymentMode" TEXT NOT NULL DEFAULT 'cash', "receiptNo" TEXT NOT NULL,
  "paidOn" DATE NOT NULL, "remarks" TEXT, "collectedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_collections_institutionId_receiptNo_key" ON "fee_collections"("institutionId","receiptNo");
CREATE INDEX IF NOT EXISTS "fee_collections_institutionId_idx"        ON "fee_collections"("institutionId");
CREATE INDEX IF NOT EXISTS "fee_collections_studentId_idx"            ON "fee_collections"("studentId");
CREATE INDEX IF NOT EXISTS "fee_collections_paidOn_idx"               ON "fee_collections"("paidOn");
CREATE INDEX IF NOT EXISTS "fee_collections_academicYearId_idx"       ON "fee_collections"("academicYearId");
CREATE INDEX IF NOT EXISTS "fee_collections_feePlanInstallmentId_idx" ON "fee_collections"("feePlanInstallmentId");
DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanItemId_fkey"
  FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanInstallmentId_fkey"
  FOREIGN KEY ("feePlanInstallmentId") REFERENCES "fee_plan_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feeCategoryId_fkey"
  FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_collectedByUserId_fkey"
  FOREIGN KEY ("collectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);

// ── 5. Messaging tables ───────────────────────────────────────────────────────
run('conversations table', `
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
  "parentUserId" TEXT NOT NULL, "teacherUserId" TEXT NOT NULL,
  "studentId" TEXT, "subject" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_institutionId_parentUserId_teacherUserId_studentId_key"
  ON "conversations"("institutionId","parentUserId","teacherUserId","studentId");
CREATE INDEX IF NOT EXISTS "conversations_institutionId_idx" ON "conversations"("institutionId");
CREATE INDEX IF NOT EXISTS "conversations_parentUserId_idx"  ON "conversations"("parentUserId");
CREATE INDEX IF NOT EXISTS "conversations_teacherUserId_idx" ON "conversations"("teacherUserId");
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_parentUserId_fkey"
  FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_teacherUserId_fkey"
  FOREIGN KEY ("teacherUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
run('messages table', `
CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL, "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "messages_conversationId_idx" ON "messages"("conversationId");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx"        ON "messages"("senderId");
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);

// ── 6. Admin role permissions ─────────────────────────────────────────────────
run('admin role permissions', `
UPDATE "roles"
SET "permissions" = '["users.read","users.write","users.assignRole","roles.read","students.read","students.write","fees.read","fees.write","attendance.read","attendance.write","exams.read","exams.write","subjects.read","subjects.write","academic.read","academic.write","institution.read","institution.write","inquiry.read","inquiry.write"]'::jsonb
WHERE "code" = 'admin';
`);

console.log('[preflight] Done.');
JSPREFLIGHT

echo "[start] Syncing checksums for edited migrations..."
node - << 'JSSYNC'
const { createHash } = require('crypto');
const { readFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');

// ALL migrations — recalculate every checksum so Prisma never rejects a
// mismatch regardless of what state the _prisma_migrations table is in
// (important after DB migrations like Neon → Supabase).
const EDITED = [
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
];

for (const name of EDITED) {
  const file = `./prisma/migrations/${name}/migration.sql`;
  if (!existsSync(file)) { console.log(`[checksum] Skipping: ${name}`); continue; }
  const checksum = createHash('sha256').update(readFileSync(file)).digest('hex');
  const sql = `UPDATE "_prisma_migrations" SET "checksum" = '${checksum}' WHERE "migration_name" = '${name}';`;
  try {
    execSync('npx prisma db execute --stdin', { input: sql, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[checksum] Synced: ${name}`);
  } catch (e) {
    console.warn(`[checksum] Warning for ${name}:`, e.message);
  }
}
JSSYNC

echo "[start] Applying pending migrations..."
npx prisma migrate deploy

echo "[start] Starting application..."
exec node dist/src/main
