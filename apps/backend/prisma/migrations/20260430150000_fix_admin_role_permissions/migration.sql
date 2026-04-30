-- Update admin (Operator) role with full current permissions including academic.read/write.
-- Existing institutions were onboarded with an older DEFAULT_ROLES that lacked these permissions.
-- Idempotent: safe to run multiple times.

UPDATE "roles"
SET "permissions" = '["users.read","users.write","users.assignRole","roles.read","students.read","students.write","fees.read","fees.write","attendance.read","attendance.write","exams.read","exams.write","subjects.read","subjects.write","academic.read","academic.write","institution.read","institution.write","inquiry.read","inquiry.write"]'::jsonb
WHERE "code" = 'admin';
