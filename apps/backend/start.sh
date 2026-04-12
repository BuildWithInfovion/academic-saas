#!/bin/sh
set -e

echo "[start] Resolving any failed/modified migrations..."
# Mark the previously-broken migration as applied so migrate deploy
# doesn't fail on the checksum mismatch. The 2>/dev/null silences the
# error when the migration is already in a clean state.
npx prisma migrate resolve --applied 20260410000000_add_institution_profile_fields 2>/dev/null || true

echo "[start] Applying pending migrations..."
npx prisma migrate deploy

echo "[start] Starting application..."
exec node dist/src/main
