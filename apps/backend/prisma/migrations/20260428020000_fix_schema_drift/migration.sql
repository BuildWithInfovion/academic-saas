-- Fix schema drift: columns present in schema.prisma but missing from DB.
-- These were added to the Prisma schema directly without a corresponding migration.

-- students: disability fields
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "hasDisability"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "disabilityDetails" TEXT;
