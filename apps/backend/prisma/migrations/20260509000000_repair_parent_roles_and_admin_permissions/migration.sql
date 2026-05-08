-- Repair 1: Insert missing user_roles records for imported parent users.
--
-- When students are bulk-imported, parent User records are created but
-- user_roles rows are skipped if the 'parent' Role row doesn't exist yet
-- at import time. This leaves those parents unable to log in or request
-- a password reset (the query filters on roles.code = 'parent').
--
-- Finds every student whose parentUserId points to an active user that has
-- NO user_roles row for the institution's 'parent' role, and inserts one.
-- @@id([userId, roleId]) = composite PK, so ON CONFLICT DO NOTHING is safe.

INSERT INTO "user_roles" ("userId", "roleId", "institutionId")
SELECT DISTINCT
  s."parentUserId",
  r.id,
  s."institutionId"
FROM "students" s
JOIN "roles"     r ON r."institutionId" = s."institutionId" AND r.code = 'parent'
JOIN "users"     u ON u.id = s."parentUserId"
                   AND u."institutionId" = s."institutionId"
                   AND u."deletedAt" IS NULL
WHERE s."parentUserId" IS NOT NULL
  AND s."deletedAt"   IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur
    WHERE ur."userId" = s."parentUserId"
      AND ur."roleId" = r.id
  )
ON CONFLICT DO NOTHING;

-- Repair 2: Ensure every admin role has users.read, users.write, users.assignRole.
--
-- Earlier permission migrations may have omitted these entries. The UNION
-- pattern deduplicates so re-running this migration is safe.

UPDATE "roles"
SET "permissions" = (
  SELECT jsonb_agg(val ORDER BY val)
  FROM (
    SELECT val FROM jsonb_array_elements_text("permissions") AS t(val)
    UNION
    VALUES
      ('users.read'),
      ('users.write'),
      ('users.assignRole')
  ) AS combined(val)
)
WHERE "code" = 'admin';
