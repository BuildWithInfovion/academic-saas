-- Migration: Update role permissions + add accountant / non_teaching_staff roles
-- Idempotent: safe to run multiple times.

-- ── 1. Director (super_admin) → read-only monitoring ─────────────────────────
UPDATE "roles"
SET "permissions" = '["users.read","roles.read","students.read","fees.read","attendance.read","exams.read","subjects.read","institution.read","academic.read"]'::jsonb
WHERE "code" = 'super_admin';

-- ── 2. Principal → full school administration ─────────────────────────────────
UPDATE "roles"
SET "permissions" = '["students.read","attendance.read","attendance.write","exams.read","fees.read","fees.write","users.read","users.write","subjects.read","subjects.write","academic.read","academic.write","institution.read","institution.write"]'::jsonb
WHERE "code" = 'principal';

-- ── 3. Accountant role — add to every institution that doesn't have it ────────
INSERT INTO "roles" ("id", "institutionId", "code", "label", "permissions", "createdAt", "updatedAt")
SELECT
  encode(sha256((inst.id || 'accountant')::bytea), 'hex'),
  inst.id,
  'accountant',
  'Accountant',
  '["fees.read","fees.write","students.read","attendance.read","institution.read","subjects.read"]'::jsonb,
  NOW(),
  NOW()
FROM "institutions" inst
WHERE inst."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "roles" r
    WHERE r."institutionId" = inst.id AND r."code" = 'accountant'
  );

-- ── 4. Non-Teaching Staff role — add to every institution that doesn't have it ─
INSERT INTO "roles" ("id", "institutionId", "code", "label", "permissions", "createdAt", "updatedAt")
SELECT
  encode(sha256((inst.id || 'non_teaching_staff')::bytea), 'hex'),
  inst.id,
  'non_teaching_staff',
  'Non-Teaching Staff',
  '["attendance.read"]'::jsonb,
  NOW(),
  NOW()
FROM "institutions" inst
WHERE inst."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "roles" r
    WHERE r."institutionId" = inst.id AND r."code" = 'non_teaching_staff'
  );
