-- Add photoUrl to students table.
-- IF NOT EXISTS guard makes this safe even if prisma db push already applied it.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
