-- Add userId to students for student portal login linkage.
-- Column was in schema.prisma but never had a migration file.
-- Uses IF NOT EXISTS so it is safe to run even if the column already exists
-- (e.g. added manually or via prisma db push in a previous session).
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Unique constraint: one student account per user
DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_userId_key" UNIQUE ("userId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK: idempotent — skip if constraint already exists
DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Supporting index
CREATE INDEX IF NOT EXISTS "students_userId_idx" ON "students"("userId");
