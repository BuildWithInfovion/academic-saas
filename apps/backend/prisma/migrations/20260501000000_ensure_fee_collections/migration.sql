-- Ensure fee_collections table exists.
-- The 20260429030000_fee_plan_system migration was applied before fee_collections
-- was added to it, so production DBs that went through that migration have all
-- fee-plan tables EXCEPT fee_collections. This migration creates it idempotently.

CREATE TABLE IF NOT EXISTS "fee_collections" (
    "id"                   TEXT             NOT NULL,
    "institutionId"        TEXT             NOT NULL,
    "studentId"            TEXT             NOT NULL,
    "feePlanItemId"        TEXT,
    "feePlanInstallmentId" TEXT,
    "feeCategoryId"        TEXT             NOT NULL,
    "academicYearId"       TEXT,
    "amount"               DOUBLE PRECISION NOT NULL,
    "paymentMode"          TEXT             NOT NULL DEFAULT 'cash',
    "receiptNo"            TEXT             NOT NULL,
    "paidOn"               DATE             NOT NULL,
    "remarks"              TEXT,
    "collectedByUserId"    TEXT,
    "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_collections_institutionId_receiptNo_key"
    ON "fee_collections"("institutionId", "receiptNo");

CREATE INDEX IF NOT EXISTS "fee_collections_institutionId_idx"
    ON "fee_collections"("institutionId");

CREATE INDEX IF NOT EXISTS "fee_collections_studentId_idx"
    ON "fee_collections"("studentId");

CREATE INDEX IF NOT EXISTS "fee_collections_paidOn_idx"
    ON "fee_collections"("paidOn");

CREATE INDEX IF NOT EXISTS "fee_collections_academicYearId_idx"
    ON "fee_collections"("academicYearId");

CREATE INDEX IF NOT EXISTS "fee_collections_feePlanInstallmentId_idx"
    ON "fee_collections"("feePlanInstallmentId");

-- Foreign keys — guarded by IF NOT EXISTS so re-running is safe.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_collections_institutionId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_collections_studentId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_collections_feePlanItemId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanItemId_fkey"
      FOREIGN KEY ("feePlanItemId") REFERENCES "fee_plan_items"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_collections_feePlanInstallmentId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feePlanInstallmentId_fkey"
      FOREIGN KEY ("feePlanInstallmentId") REFERENCES "fee_plan_installments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_collections_feeCategoryId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_feeCategoryId_fkey"
      FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_collections_collectedByUserId_fkey') THEN
    ALTER TABLE "fee_collections" ADD CONSTRAINT "fee_collections_collectedByUserId_fkey"
      FOREIGN KEY ("collectedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
