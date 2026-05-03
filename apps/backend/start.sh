#!/bin/sh

# ── Step 1: Ensure _prisma_migrations table exists and all historical migrations
#            are recorded as applied.  This lets `prisma migrate deploy` (step 3)
#            skip them safely on existing databases where the schema was originally
#            applied via raw SQL rather than through Prisma's migration runner.
echo "[start] Syncing migration history..."
node - << 'JSSYNC'
const { createHash, randomUUID } = require('crypto');
const { readFileSync, existsSync } = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALL_MIGRATIONS = [
  '20260306173811_add_student_model',
  '20260315194341_add_auth_rbac_audit_models',
  '20260315194539_add_auth_rbac_audit_models',
  '20260403200244_add_refresh_tokens',
  '20260406100501_admission_fields',
  '20260406102205_academic_unit',
  '20260406170021_add_address_sibling_academic_year',
  '20260406170602_add_inquiry',
  '20260406172549_add_student_demographics',
  '20260406211252_add_subjects_attendance_fees_exams',
  '20260406212208_add_exam_result_subject_relation',
  '20260408000000_add_class_teacher_to_unit',
  '20260408010000_add_timetable_slots',
  '20260408020000_subject_teacher_relation',
  '20260408030000_add_password_reset_requests',
  '20260408050000_add_platform_admin_subscription',
  '20260410000000_add_institution_profile_fields',
  '20260412000000_fix_institution_profile_columns',
  '20260412010000_add_announcements_staff_tables',
  '20260413000000_update_roles_add_accountant_staff',
  '20260413100000_soft_delete_exam_announcement_feestructure',
  '20260413150000_add_parent_user_id_to_students',
  '20260414000000_add_perf_indexes',
  '20260414100000_platform_admin_last_login',
  '20260414110000_add_user_id_to_students',
  '20260417000000_add_support_tickets',
  '20260418000000_add_calendar_events',
  '20260418100000_platform_security_hardening',
  '20260418110000_platform_session_emails',
  '20260421000000_totp_email_reset_auth',
  '20260428000000_add_student_documents',
  '20260428010000_add_name_to_users',
  '20260428020000_fix_schema_drift',
  '20260428030000_fix_full_schema_drift',
  '20260429000000_extend_student_admission_fields',
  '20260429010000_institution_profile_extended',
  '20260429020000_staff_profile',
  '20260429030000_fee_plan_system',
  '20260430060000_institution_extended_profile',
  '20260430120000_messaging',
  '20260430150000_fix_admin_role_permissions',
  '20260501000000_ensure_fee_collections',
  '20260503000000_add_student_photo_url',
];

(async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                  VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum"            VARCHAR(64) NOT NULL,
        "finished_at"         TIMESTAMPTZ,
        "migration_name"      VARCHAR(255) NOT NULL,
        "logs"                TEXT,
        "rolled_back_at"      TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "applied_steps_count" INT NOT NULL DEFAULT 0
      )
    `);
  } catch (e) {
    console.warn('[sync] Could not ensure _prisma_migrations:', (e.message || '').slice(0, 150));
  }

  // Column repair — add any columns that might be missing from the live DB.
  // This runs before migrate deploy so Prisma never sees a P2022 on startup.
  const COLUMN_REPAIRS = [
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT`,
  ];
  for (const sql of COLUMN_REPAIRS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('[sync] Column repair OK:', sql.slice(0, 80));
    } catch (e) {
      console.warn('[sync] Column repair warning:', (e.message || '').slice(0, 150));
    }
  }

  for (const name of ALL_MIGRATIONS) {
    const file = `./prisma/migrations/${name}/migration.sql`;
    if (!existsSync(file)) { console.log(`[sync] Skipping (no file): ${name}`); continue; }
    const checksum = createHash('sha256').update(readFileSync(file)).digest('hex');
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = $1`, name
      );
      if (rows.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations"
             ("id","checksum","started_at","finished_at","migration_name","logs","rolled_back_at","applied_steps_count")
           VALUES ($1,$2,NOW(),NOW(),$3,NULL,NULL,1)`,
          randomUUID(), checksum, name
        );
        console.log('[sync] Registered:', name);
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "_prisma_migrations"
           SET "checksum"=$1, "finished_at"=COALESCE("finished_at",NOW()), "rolled_back_at"=NULL
           WHERE "migration_name"=$2`,
          checksum, name
        );
      }
    } catch (e) {
      console.warn('[sync] Warning for', name + ':', (e.message || '').slice(0, 150));
    }
  }
  await prisma.$disconnect();
  console.log('[sync] Migration history ready.');
})().catch(async (e) => {
  console.warn('[sync] Fatal:', (e.message || '').slice(0, 300));
  await prisma.$disconnect().catch(() => {});
});
JSSYNC

# ── Step 2: Seed platform admin accounts (idempotent — skips if already exists)
echo "[start] Seeding platform admins..."
node - << 'JSSEED'
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMINS = [
  { email: 'sankalp.deshpande@infovion.in', name: 'Sankalp Deshpande', password: 'Infovion@Admin1' },
  { email: 'pratik.gore@infovion.in',        name: 'Pratik Gore',       password: 'Infovion@Admin2' },
];

(async () => {
  for (const admin of ADMINS) {
    try {
      const existing = await prisma.platformAdmin.findUnique({ where: { email: admin.email } });
      if (existing) { console.log('[seed] Already exists:', admin.email); continue; }
      const passwordHash = await bcrypt.hash(admin.password, 12);
      await prisma.platformAdmin.create({
        data: { email: admin.email, name: admin.name, passwordHash, isActive: true },
      });
      console.log('[seed] Created platform admin:', admin.email);
    } catch (e) {
      console.warn('[seed] Warning for', admin.email + ':', (e.message || '').slice(0, 150));
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.warn('[seed] Fatal:', (e.message || '').slice(0, 300));
  await prisma.$disconnect().catch(() => {});
});
JSSEED

# ── Step 3: Schema safety net — apply any columns that must exist before migrate deploy
echo "[start] Applying schema safety net..."
node - << 'JSSAFETY'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const fixes = [
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT`,
  ];
  for (const sql of fixes) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('[safety] OK:', sql.slice(0, 80));
    } catch (e) {
      console.warn('[safety] Warning:', (e.message || '').slice(0, 150));
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.warn('[safety] Fatal:', (e.message || '').slice(0, 300));
  await prisma.$disconnect().catch(() => {});
});
JSSAFETY

# ── Step 4: Apply any pending migrations (new schema changes since last deploy)
echo "[start] Running pending migrations..."
npx prisma migrate deploy

# ── Step 5: Start the application
echo "[start] Starting application..."
exec node dist/src/main
