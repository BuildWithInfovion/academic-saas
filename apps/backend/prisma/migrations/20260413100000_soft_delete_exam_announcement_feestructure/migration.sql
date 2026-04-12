-- Soft-delete safety: add deletedAt to exams, announcements, fee_structures
-- Existing rows default to NULL (not deleted).

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "fee_structures"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
