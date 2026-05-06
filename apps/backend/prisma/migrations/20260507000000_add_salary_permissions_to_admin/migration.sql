-- Add salary.read and salary.write to the admin (Operator) role.
-- The 20260430150000 migration set the full permission list without salary permissions,
-- which broke the Staff Salaries section in the operator dashboard.
-- Idempotent: safe to run multiple times.

UPDATE "roles"
SET "permissions" = (
  SELECT jsonb_agg(DISTINCT val)
  FROM jsonb_array_elements_text("permissions") AS t(val)
  UNION ALL
  SELECT jsonb_agg(val)
  FROM (VALUES ('salary.read'), ('salary.write')) AS v(val)
  WHERE NOT ("permissions" @> to_jsonb(val::text))
)
WHERE "code" = 'admin';
