-- Extend institutions table with branding and profile fields
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "logoUrl"       TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "principalName" TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "tagline"       TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "affiliationNo" TEXT;
