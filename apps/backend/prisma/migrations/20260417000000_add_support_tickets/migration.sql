-- Add support_tickets table for school-user → platform team support workflow.
-- Uses IF NOT EXISTS so the migration is safe even if the table was already
-- created via `prisma db push` in a previous session.

CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id"              TEXT        NOT NULL,
    "institutionId"   TEXT        NOT NULL,
    "institutionName" TEXT        NOT NULL,
    "submittedBy"     TEXT        NOT NULL,
    "submitterRole"   TEXT        NOT NULL,
    "subject"         TEXT        NOT NULL,
    "message"         TEXT        NOT NULL,
    "status"          TEXT        NOT NULL DEFAULT 'open',
    "adminNotes"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- Indexes (CREATE INDEX IF NOT EXISTS is safe to re-run)
CREATE INDEX IF NOT EXISTS "support_tickets_institutionId_idx" ON "support_tickets"("institutionId");
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx"        ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "support_tickets_createdAt_idx"     ON "support_tickets"("createdAt");

-- Foreign key (guard against duplicate constraint)
DO $$ BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_institutionId_fkey"
    FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
