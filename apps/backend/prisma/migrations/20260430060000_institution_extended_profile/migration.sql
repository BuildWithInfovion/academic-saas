-- Extend Institution with compliance, branding, and bank detail fields
-- Additive migration — no existing columns modified or dropped.

ALTER TABLE "institutions"
  ADD COLUMN IF NOT EXISTS "udiseCode"           TEXT,
  ADD COLUMN IF NOT EXISTS "gstin"               TEXT,
  ADD COLUMN IF NOT EXISTS "pan"                 TEXT,
  ADD COLUMN IF NOT EXISTS "recognitionNo"       TEXT,
  ADD COLUMN IF NOT EXISTS "foundedYear"         INTEGER,
  ADD COLUMN IF NOT EXISTS "mediumOfInstruction" TEXT,
  ADD COLUMN IF NOT EXISTS "schoolType"          TEXT,
  ADD COLUMN IF NOT EXISTS "managementType"      TEXT,
  ADD COLUMN IF NOT EXISTS "stampUrl"            TEXT,
  ADD COLUMN IF NOT EXISTS "signatureUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "bankName"            TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountNo"       TEXT,
  ADD COLUMN IF NOT EXISTS "bankIfsc"            TEXT,
  ADD COLUMN IF NOT EXISTS "bankBranch"          TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountHolder"   TEXT;
