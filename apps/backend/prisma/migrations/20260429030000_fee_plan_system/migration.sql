-- Fee Management V2: Plan-based system (idempotent — safe to re-run)
-- Adds FeeCategory, FeePlan, FeePlanItem, FeePlanInstallment,
-- FeePlanClassMap, FeeConcession, FeeCollection tables.

CREATE TABLE IF NOT EXISTS "fee_categories" (
    "id"            TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "type"          TEXT NOT NULL DEFAULT 'CUSTOM',
    "deletedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_categories_institutionId_name_key" ON "fee_categories"("institutionId", "name");
CREATE INDEX IF NOT EXISTS "fee_categories_institutionId_idx" ON "fee_categories"("institutionId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_categories_institutionId_fkey') THEN
    ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_plans" (
    "id"             TEXT NOT NULL,
    "institutionId"  TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "deletedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plans_institutionId_name_academicYearId_key"
    ON "fee_plans"("institutionId", "name", "academicYearId");
CREATE INDEX IF NOT EXISTS "fee_plans_institutionId_idx" ON "fee_plans"("institutionId");
CREATE INDEX IF NOT EXISTS "fee_plans_academicYearId_idx" ON "fee_plans"("academicYearId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plans_institutionId_fkey') THEN
    ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plans_academicYearId_fkey') THEN
    ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_academicYearId_fkey"
        FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_plan_items" (
    "id"            TEXT NOT NULL,
    "feePlanId"     TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "totalAmount"   DOUBLE PRECISION NOT NULL,
    CONSTRAINT "fee_plan_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_items_feePlanId_feeCategoryId_key"
    ON "fee_plan_items"("feePlanId", "feeCategoryId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plan_items_feePlanId_fkey') THEN
    ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feePlanId_fkey"
        FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plan_items_feeCategoryId_fkey') THEN
    ALTER TABLE "fee_plan_items" ADD CONSTRAINT "fee_plan_items_feeCategoryId_fkey"
        FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_plan_installments" (
    "id"            TEXT NOT NULL,
    "feePlanItemId" TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "amount"        DOUBLE PRECISION NOT NULL,
    "dueDate"       DATE,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "fee_plan_installments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_installments_feePlanItemId_label_key"
    ON "fee_plan_installments"("feePlanItemId", "label");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plan_installments_feePlanItemId_fkey') THEN
    ALTER TABLE "fee_plan_installments" ADD CONSTRAINT "fee_plan_installments_feePlanItemId_fkey"
        FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_plan_class_maps" (
    "id"             TEXT NOT NULL,
    "feePlanId"      TEXT NOT NULL,
    "academicUnitId" TEXT NOT NULL,
    CONSTRAINT "fee_plan_class_maps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_plan_class_maps_feePlanId_academicUnitId_key"
    ON "fee_plan_class_maps"("feePlanId", "academicUnitId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plan_class_maps_feePlanId_fkey') THEN
    ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_feePlanId_fkey"
        FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_plan_class_maps_academicUnitId_fkey') THEN
    ALTER TABLE "fee_plan_class_maps" ADD CONSTRAINT "fee_plan_class_maps_academicUnitId_fkey"
        FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_concessions" (
    "id"               TEXT NOT NULL,
    "institutionId"    TEXT NOT NULL,
    "studentId"        TEXT NOT NULL,
    "feePlanItemId"    TEXT NOT NULL,
    "amount"           DOUBLE PRECISION NOT NULL,
    "reason"           TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fee_concessions_institutionId_idx" ON "fee_concessions"("institutionId");
CREATE INDEX IF NOT EXISTS "fee_concessions_studentId_idx" ON "fee_concessions"("studentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_concessions_institutionId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_concessions_studentId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_concessions_feePlanItemId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_feePlanItemId_fkey"
        FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_concessions_approvedByUserId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_approvedByUserId_fkey"
        FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_collections" (
    "id"                   TEXT NOT NULL,
    "institutionId"        TEXT NOT NULL,
    "studentId"            TEXT NOT NULL,
    "feePlanItemId"        TEXT,
    "feePlanInstallmentId" TEXT,
    "feeCategoryId"        TEXT NOT NULL,
    "academicYearId"       TEXT,
    "amount"               DOUBLE PRECISION NOT NULL,
    "paymentMode"          TEXT NOT NULL DEFAULT 'cash',
    "receiptNo"            TEXT NOT NULL,
    "paidOn"               DATE NOT NULL,
    "remarks"              TEXT,
    "collectedByUserId"    TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_collections_institutionId_receiptNo_key"
    ON "fee_collections"("institutionId", "receiptNo");
CREATE INDEX IF NOT EXISTS "fee_collections_institutionId_idx" ON "fee_collections"("institutionId");
CREATE INDEX IF NOT EXISTS "fee_collections_studentId_idx" ON "fee_collections"("studentId");
CREATE INDEX IF NOT EXISTS "fee_collections_paidOn_idx" ON "fee_collections"("paidOn");
CREATE INDEX IF NOT EXISTS "fee_collections_academicYearId_idx" ON "fee_collections"("academicYearId");
CREATE INDEX IF NOT EXISTS "fee_collections_feePlanInstallmentId_idx" ON "fee_collections"("feePlanInstallmentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_collections_institutionId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_collections_studentId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_collections_feePlanItemId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanItemId_fkey"
        FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_collections_feePlanInstallmentId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanInstallmentId_fkey"
        FOREIGN KEY ("feePlanInstallmentId") REFERENCES "fee_plan_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_collections_feeCategoryId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feeCategoryId_fkey"
        FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_collections_collectedByUserId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_collectedByUserId_fkey"
        FOREIGN KEY ("collectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
