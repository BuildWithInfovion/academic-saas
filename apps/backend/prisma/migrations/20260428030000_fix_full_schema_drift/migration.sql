-- Fix full schema drift: all columns, tables, indexes, and foreign keys
-- present in schema.prisma but missing from the live database.

-- AlterTable: drop stale updatedAt defaults Prisma no longer emits
ALTER TABLE "announcements" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "calendar_events" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "password_reset_requests" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "platform_admins" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "staff_attendance" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "staff_leave_requests" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "support_tickets" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "timetable_slots" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: missing columns on exam_subjects
ALTER TABLE "exam_subjects" ADD COLUMN IF NOT EXISTS "examTime" TEXT;

-- AlterTable: missing columns on exams
ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "examCenter"    TEXT,
  ADD COLUMN IF NOT EXISTS "reportingTime" TEXT;

-- AlterTable: missing columns on fee_payments
ALTER TABLE "fee_payments"
  ADD COLUMN IF NOT EXISTS "feeStructureId"  TEXT,
  ADD COLUMN IF NOT EXISTS "installmentName" TEXT;

-- CreateTable: timetable_covers
CREATE TABLE IF NOT EXISTS "timetable_covers" (
    "id"              TEXT        NOT NULL,
    "institutionId"   TEXT        NOT NULL,
    "date"            DATE        NOT NULL,
    "dayOfWeek"       INTEGER     NOT NULL,
    "periodNo"        INTEGER     NOT NULL,
    "academicUnitId"  TEXT        NOT NULL,
    "subjectId"       TEXT,
    "absentTeacherId" TEXT        NOT NULL,
    "substituteId"    TEXT,
    "status"          TEXT        NOT NULL DEFAULT 'uncovered',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_covers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: period_configs
CREATE TABLE IF NOT EXISTS "period_configs" (
    "id"            TEXT        NOT NULL,
    "institutionId" TEXT        NOT NULL,
    "sortOrder"     INTEGER     NOT NULL,
    "label"         TEXT        NOT NULL,
    "isBreak"       BOOLEAN     NOT NULL DEFAULT false,
    "startTime"     TEXT        NOT NULL,
    "endTime"       TEXT        NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transfer_certificates
CREATE TABLE IF NOT EXISTS "transfer_certificates" (
    "id"                  TEXT        NOT NULL,
    "institutionId"       TEXT        NOT NULL,
    "studentId"           TEXT        NOT NULL,
    "status"              TEXT        NOT NULL DEFAULT 'pending_approval',
    "studentName"         TEXT        NOT NULL,
    "admissionNo"         TEXT        NOT NULL,
    "dateOfBirth"         TIMESTAMP(3),
    "gender"              TEXT,
    "fatherName"          TEXT,
    "motherName"          TEXT,
    "nationality"         TEXT,
    "religion"            TEXT,
    "casteCategory"       TEXT,
    "bloodGroup"          TEXT,
    "classLastStudied"    TEXT        NOT NULL,
    "admissionDate"       TIMESTAMP(3),
    "academicYearName"    TEXT,
    "conductGrade"        TEXT        NOT NULL DEFAULT 'Good',
    "reason"              TEXT,
    "tcNumber"            TEXT,
    "subjectsStudied"     TEXT,
    "lastExamName"        TEXT,
    "lastExamResult"      TEXT,
    "promotionEligible"   TEXT,
    "feesPaidUpToMonth"   TEXT,
    "workingDays"         INTEGER,
    "presentDays"         INTEGER,
    "hasDues"             BOOLEAN     NOT NULL DEFAULT false,
    "duesRemark"          TEXT,
    "requestedByUserId"   TEXT        NOT NULL,
    "approvedByUserId"    TEXT,
    "rejectedByUserId"    TEXT,
    "rejectionRemark"     TEXT,
    "requestedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"          TIMESTAMP(3),
    "rejectedAt"          TIMESTAMP(3),
    "issuedAt"            TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_structures
CREATE TABLE IF NOT EXISTS "salary_structures" (
    "id"                    TEXT              NOT NULL,
    "institutionId"         TEXT              NOT NULL,
    "name"                  TEXT              NOT NULL,
    "description"           TEXT,
    "basicSalary"           DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "houseRentAllowance"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "medicalAllowance"      DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "transportAllowance"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "otherAllowances"       JSONB,
    "providentFund"         DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "professionalTax"       DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "otherDeductions"       JSONB,
    "isActive"              BOOLEAN           NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable: staff_salary_profiles
CREATE TABLE IF NOT EXISTS "staff_salary_profiles" (
    "id"                    TEXT              NOT NULL,
    "institutionId"         TEXT              NOT NULL,
    "userId"                TEXT              NOT NULL,
    "structureId"           TEXT,
    "basicSalary"           DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "houseRentAllowance"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "medicalAllowance"      DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "transportAllowance"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "otherAllowances"       JSONB,
    "providentFund"         DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "professionalTax"       DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "otherDeductions"       JSONB,
    "effectiveFrom"         DATE              NOT NULL,
    "notes"                 TEXT,
    "isActive"              BOOLEAN           NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "staff_salary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_records
CREATE TABLE IF NOT EXISTS "salary_records" (
    "id"                    TEXT              NOT NULL,
    "institutionId"         TEXT              NOT NULL,
    "userId"                TEXT              NOT NULL,
    "profileId"             TEXT              NOT NULL,
    "month"                 INTEGER           NOT NULL,
    "year"                  INTEGER           NOT NULL,
    "basicSalary"           DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "houseRentAllowance"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "medicalAllowance"      DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "transportAllowance"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "otherAllowances"       JSONB,
    "grossSalary"           DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "providentFund"         DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "professionalTax"       DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "otherDeductions"       JSONB,
    "totalDeductions"       DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "netSalary"             DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "status"                TEXT              NOT NULL DEFAULT 'pending',
    "paidOn"                TIMESTAMP(3),
    "paymentMode"           TEXT,
    "paymentReference"      TEXT,
    "remarks"               TEXT,
    "markedPaidById"        TEXT,
    "generatedAt"           TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: timetable_covers
CREATE INDEX IF NOT EXISTS "timetable_covers_institutionId_date_idx"           ON "timetable_covers"("institutionId", "date");
CREATE INDEX IF NOT EXISTS "timetable_covers_institutionId_absentTeacherId_idx" ON "timetable_covers"("institutionId", "absentTeacherId");
CREATE INDEX IF NOT EXISTS "timetable_covers_institutionId_substituteId_idx"   ON "timetable_covers"("institutionId", "substituteId");
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_covers_institutionId_date_academicUnitId_periodNo_key"
    ON "timetable_covers"("institutionId", "date", "academicUnitId", "periodNo");

-- CreateIndex: period_configs
CREATE INDEX IF NOT EXISTS "period_configs_institutionId_idx"       ON "period_configs"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "period_configs_institutionId_sortOrder_key" ON "period_configs"("institutionId", "sortOrder");

-- CreateIndex: transfer_certificates
CREATE INDEX IF NOT EXISTS "transfer_certificates_institutionId_idx"        ON "transfer_certificates"("institutionId");
CREATE INDEX IF NOT EXISTS "transfer_certificates_studentId_idx"             ON "transfer_certificates"("studentId");
CREATE INDEX IF NOT EXISTS "transfer_certificates_institutionId_status_idx"  ON "transfer_certificates"("institutionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_certificates_institutionId_tcNumber_key"
    ON "transfer_certificates"("institutionId", "tcNumber");

-- CreateIndex: salary_structures
CREATE INDEX IF NOT EXISTS "salary_structures_institutionId_idx"       ON "salary_structures"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "salary_structures_institutionId_name_key" ON "salary_structures"("institutionId", "name");

-- CreateIndex: staff_salary_profiles
CREATE UNIQUE INDEX IF NOT EXISTS "staff_salary_profiles_userId_key"         ON "staff_salary_profiles"("userId");
CREATE INDEX IF NOT EXISTS "staff_salary_profiles_institutionId_idx"         ON "staff_salary_profiles"("institutionId");
CREATE INDEX IF NOT EXISTS "staff_salary_profiles_userId_idx"                ON "staff_salary_profiles"("userId");

-- CreateIndex: salary_records
CREATE INDEX IF NOT EXISTS "salary_records_institutionId_idx"               ON "salary_records"("institutionId");
CREATE INDEX IF NOT EXISTS "salary_records_institutionId_month_year_idx"    ON "salary_records"("institutionId", "month", "year");
CREATE INDEX IF NOT EXISTS "salary_records_userId_idx"                      ON "salary_records"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "salary_records_institutionId_userId_month_year_key"
    ON "salary_records"("institutionId", "userId", "month", "year");

-- CreateIndex: audit_logs (missing index)
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex: exam_results (missing composite indexes)
CREATE INDEX IF NOT EXISTS "exam_results_academicUnitId_idx"        ON "exam_results"("academicUnitId");
CREATE INDEX IF NOT EXISTS "exam_results_examId_academicUnitId_idx"  ON "exam_results"("examId", "academicUnitId");

-- CreateIndex: exam_subjects (missing index)
CREATE INDEX IF NOT EXISTS "exam_subjects_academicUnitId_idx" ON "exam_subjects"("academicUnitId");

-- CreateIndex: fee_payments (missing indexes)
CREATE INDEX IF NOT EXISTS "fee_payments_academicYearId_idx"                ON "fee_payments"("academicYearId");
CREATE INDEX IF NOT EXISTS "fee_payments_institutionId_academicYearId_idx"  ON "fee_payments"("institutionId", "academicYearId");
CREATE INDEX IF NOT EXISTS "fee_payments_feeStructureId_idx"                ON "fee_payments"("feeStructureId");

-- CreateIndex: users (missing email index)
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

-- AddForeignKey: fee_payments → fee_structures
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_payments_feeStructureId_fkey'
  ) THEN
    ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_feeStructureId_fkey"
      FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: timetable_covers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'timetable_covers_institutionId_fkey'
  ) THEN
    ALTER TABLE "timetable_covers" ADD CONSTRAINT "timetable_covers_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'timetable_covers_academicUnitId_fkey'
  ) THEN
    ALTER TABLE "timetable_covers" ADD CONSTRAINT "timetable_covers_academicUnitId_fkey"
      FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: period_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'period_configs_institutionId_fkey'
  ) THEN
    ALTER TABLE "period_configs" ADD CONSTRAINT "period_configs_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: transfer_certificates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transfer_certificates_institutionId_fkey'
  ) THEN
    ALTER TABLE "transfer_certificates" ADD CONSTRAINT "transfer_certificates_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transfer_certificates_studentId_fkey'
  ) THEN
    ALTER TABLE "transfer_certificates" ADD CONSTRAINT "transfer_certificates_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: salary_structures
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'salary_structures_institutionId_fkey'
  ) THEN
    ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: staff_salary_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_salary_profiles_institutionId_fkey'
  ) THEN
    ALTER TABLE "staff_salary_profiles" ADD CONSTRAINT "staff_salary_profiles_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_salary_profiles_userId_fkey'
  ) THEN
    ALTER TABLE "staff_salary_profiles" ADD CONSTRAINT "staff_salary_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_salary_profiles_structureId_fkey'
  ) THEN
    ALTER TABLE "staff_salary_profiles" ADD CONSTRAINT "staff_salary_profiles_structureId_fkey"
      FOREIGN KEY ("structureId") REFERENCES "salary_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: salary_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'salary_records_institutionId_fkey'
  ) THEN
    ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'salary_records_userId_fkey'
  ) THEN
    ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'salary_records_profileId_fkey'
  ) THEN
    ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "staff_salary_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
