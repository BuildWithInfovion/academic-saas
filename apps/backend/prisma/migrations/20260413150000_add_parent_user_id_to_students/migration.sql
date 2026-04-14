-- Add parentUserId to students for parent portal login linkage.
-- Column was in schema.prisma but the migration was never generated.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "parentUserId" TEXT;

-- FK: idempotent — skip if constraint already exists (real DB may have it from a manual apply)
DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_parentUserId_fkey"
    FOREIGN KEY ("parentUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Supporting index (referenced by the perf indexes migration)
CREATE INDEX IF NOT EXISTS "students_parentUserId_idx" ON "students"("parentUserId");
