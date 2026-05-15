-- Add announcements.write permission to roles that should be able to create,
-- edit, and delete announcements (admin, super_admin, principal, teacher).
--
-- Previously the announcement controller used @Permissions('subjects.read')
-- which was a copy-paste mistake. This migration ensures the correct permission
-- exists in every institution's relevant role records before the controller
-- check is updated. The UNION pattern deduplicates, so re-running is safe.

UPDATE "roles"
SET "permissions" = (
  SELECT jsonb_agg(val ORDER BY val)
  FROM (
    SELECT val FROM jsonb_array_elements_text("permissions") AS t(val)
    UNION
    VALUES ('announcements.write')
  ) AS combined(val)
)
WHERE "code" IN ('admin', 'super_admin', 'principal', 'teacher');
