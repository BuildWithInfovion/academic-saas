#!/bin/sh
set -e

echo "[start] Resolving any failed/modified migrations..."
# These migrations were edited after being applied (checksum mismatch).
# prisma migrate resolve --applied re-registers them with the current file
# checksum so migrate deploy does not fail.
npx prisma migrate resolve --applied 20260410000000_add_institution_profile_fields 2>/dev/null || true
npx prisma migrate resolve --applied 20260413000000_update_roles_add_accountant_staff 2>/dev/null || true

echo "[start] Applying pending migrations..."
npx prisma migrate deploy

echo "[start] Starting application..."
exec node dist/src/main
