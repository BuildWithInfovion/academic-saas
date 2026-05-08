-- Add salary.read and salary.write to the admin (Operator) role.
-- The 20260430150000 migration set the full permission list without salary permissions,
-- which broke the Staff Salaries section in the operator dashboard.
-- Idempotent: UNION deduplicates, so re-running is safe.

UPDATE "roles"
SET "permissions" = (
  SELECT jsonb_agg(val ORDER BY val)
  FROM (
    SELECT val FROM jsonb_array_elements_text("permissions") AS t(val)
    UNION
    VALUES ('salary.read'), ('salary.write')
  ) AS combined(val)
)
WHERE "code" = 'admin';
