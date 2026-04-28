-- Add name column to users table.
-- This column existed in schema.prisma but was never added via a migration.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
