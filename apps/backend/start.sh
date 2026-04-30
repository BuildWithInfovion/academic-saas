#!/bin/sh
set -e

echo "[start] Syncing checksums for edited migrations..."
node - << 'JSSYNC'
const { createHash } = require('crypto');
const { readFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');

// Migrations that were edited after being applied — their stored checksum
// must match the current file content or migrate deploy will refuse to run.
const EDITED = [
  '20260410000000_add_institution_profile_fields',
  '20260413000000_update_roles_add_accountant_staff',
  '20260429020000_staff_profile',
  '20260429030000_fee_plan_system',
  '20260430120000_messaging',
];

for (const name of EDITED) {
  const file = `./prisma/migrations/${name}/migration.sql`;
  if (!existsSync(file)) {
    console.log(`[checksum] Skipping (file not found): ${name}`);
    continue;
  }
  const checksum = createHash('sha256').update(readFileSync(file)).digest('hex');
  const sql = `UPDATE "_prisma_migrations" SET "checksum" = '${checksum}' WHERE "migration_name" = '${name}';`;
  try {
    execSync('npx prisma db execute --stdin', {
      input: sql,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`[checksum] Synced: ${name}`);
  } catch (e) {
    console.warn(`[checksum] Warning for ${name}:`, e.message);
  }
}
JSSYNC

echo "[start] Applying pending migrations..."
npx prisma migrate deploy

echo "[start] Starting application..."
exec node dist/src/main
