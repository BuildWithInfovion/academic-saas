-- Re-apply institution profile columns to the correct table name.
-- The previous migration used "Institution" (wrong casing); this migration
-- uses IF NOT EXISTS so it is safe to run even if columns already exist.
ALTER TABLE "institutions"
  ADD COLUMN IF NOT EXISTS "address"  TEXT,
  ADD COLUMN IF NOT EXISTS "phone"    TEXT,
  ADD COLUMN IF NOT EXISTS "email"    TEXT,
  ADD COLUMN IF NOT EXISTS "website"  TEXT,
  ADD COLUMN IF NOT EXISTS "board"    TEXT;
