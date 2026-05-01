import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

const logger = new Logger('SchemaSync');

async function run(
  prisma: PrismaClient,
  label: string,
  statements: string[],
): Promise<void> {
  let ok = 0;
  let warned = 0;
  for (const sql of statements) {
    const s = sql.trim();
    if (!s) continue;
    try {
      await prisma.$executeRawUnsafe(s);
      ok++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn(`[${label}] ${msg.slice(0, 160)}`);
      warned++;
    }
  }
  logger.log(`${label}: ${ok} ok, ${warned} warned`);
}

export async function syncSchema(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // ── Students ─────────────────────────────────────────────────────────────
    await run(prisma, 'students', [
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "status"                  TEXT NOT NULL DEFAULT 'active'`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deletedAt"               TIMESTAMP(3)`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "userId"                  TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parentUserId"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "rollNo"                  TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone"                   TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email"                   TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherName"              TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherName"              TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parentPhone"             TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "secondaryPhone"          TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "admissionDate"           TIMESTAMP(3)`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "academicUnitId"          TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "nationality"             TEXT DEFAULT 'Indian'`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "religion"                TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "casteCategory"           TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "bloodGroup"              TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "aadharNumber"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "hasDisability"           BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "disabilityDetails"       TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tcFromPrevious"          TEXT DEFAULT 'not_applicable'`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tcReceivedDate"          TIMESTAMP(3)`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tcPreviousInstitution"   TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middleName"              TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "placeOfBirth"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherTongue"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherOccupation"        TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherQualification"     TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherEmail"             TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherAadhar"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherOccupation"        TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherQualification"     TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherEmail"             TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherAadhar"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "annualIncome"            TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "isEwsCategory"           BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactName"    TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactPhone"   TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality"                TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "city"                    TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "state"                   TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pinCode"                 TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousClass"           TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousBoard"           TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousMarks"           TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medicalConditions"       TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address"                 TEXT`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "siblingGroupId"          TEXT`,
    ]);

    // ── Institutions ──────────────────────────────────────────────────────────
    await run(prisma, 'institutions', [
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "status"              TEXT NOT NULL DEFAULT 'active'`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "features"            JSONB`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "address"             TEXT`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "phone"               TEXT`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "email"               TEXT`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "website"             TEXT`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "board"               TEXT`,
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "deletedAt"           TIMESTAMP(3)`,
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

    // ── Users ─────────────────────────────────────────────────────────────────
    await run(prisma, 'users', [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name"      TEXT`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
    ]);

    // ── Subscriptions ─────────────────────────────────────────────────────────
    await run(prisma, 'subscriptions', [
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "amountPaid"        DOUBLE PRECISION`,
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paidAt"            TIMESTAMP(3)`,
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "notes"             TEXT`,
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "planName"          TEXT NOT NULL DEFAULT 'standard'`,
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billingCycleYears" INTEGER NOT NULL DEFAULT 1`,
    ]);

    // ── Missing tables ────────────────────────────────────────────────────────
    await run(prisma, 'staff_profiles', [
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

    await run(prisma, 'fee_categories', [
      `CREATE TABLE IF NOT EXISTS "fee_categories" (
        "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'CUSTOM', "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "fee_categories_institutionId_name_key" ON "fee_categories"("institutionId","name")`,
      `DO $$ BEGIN ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'fee_plans', [
      `CREATE TABLE IF NOT EXISTS "fee_plans" (
        "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
        "name" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
        "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_academicYearId_fkey"
        FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'fee_plan_items', [
      `CREATE TABLE IF NOT EXISTS "fee_plan_items" (
        "id" TEXT NOT NULL, "feePlanId" TEXT NOT NULL, "feeCategoryId" TEXT NOT NULL,
        "totalAmount" DOUBLE PRECISION NOT NULL, CONSTRAINT "fee_plan_items_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feePlanId_fkey"
        FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'fee_plan_installments', [
      `CREATE TABLE IF NOT EXISTS "fee_plan_installments" (
        "id" TEXT NOT NULL, "feePlanItemId" TEXT NOT NULL, "label" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL, "dueDate" DATE, "sortOrder" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "fee_plan_installments_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "fee_plan_installments" ADD CONSTRAINT "fee_plan_installments_feePlanItemId_fkey"
        FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'fee_plan_class_maps', [
      `CREATE TABLE IF NOT EXISTS "fee_plan_class_maps" (
        "id" TEXT NOT NULL, "feePlanId" TEXT NOT NULL, "academicUnitId" TEXT NOT NULL,
        CONSTRAINT "fee_plan_class_maps_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_feePlanId_fkey"
        FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_academicUnitId_fkey"
        FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'fee_concessions', [
      `CREATE TABLE IF NOT EXISTS "fee_concessions" (
        "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
        "feePlanItemId" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "reason" TEXT NOT NULL,
        "approvedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'fee_collections', [
      `CREATE TABLE IF NOT EXISTS "fee_collections" (
        "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
        "feePlanItemId" TEXT, "feePlanInstallmentId" TEXT, "feeCategoryId" TEXT NOT NULL,
        "academicYearId" TEXT, "amount" DOUBLE PRECISION NOT NULL,
        "paymentMode" TEXT NOT NULL DEFAULT 'cash', "receiptNo" TEXT NOT NULL,
        "paidOn" DATE NOT NULL, "remarks" TEXT, "collectedByUserId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fee_collections_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'conversations', [
      `CREATE TABLE IF NOT EXISTS "conversations" (
        "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
        "parentUserId" TEXT NOT NULL, "teacherUserId" TEXT NOT NULL,
        "studentId" TEXT, "subject" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    await run(prisma, 'messages', [
      `CREATE TABLE IF NOT EXISTS "messages" (
        "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
        "content" TEXT NOT NULL, "readAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]);

    logger.log('Schema sync complete.');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('Schema sync failed: ' + msg.slice(0, 300));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
