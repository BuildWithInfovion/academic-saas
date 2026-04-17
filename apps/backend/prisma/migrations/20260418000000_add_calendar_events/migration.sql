-- Migration: Add calendar_events table for Academic Calendar feature

CREATE TABLE "calendar_events" (
  "id"              TEXT NOT NULL,
  "institutionId"   TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "eventType"       TEXT NOT NULL DEFAULT 'event',
  "startDate"       TIMESTAMP(3) NOT NULL,
  "endDate"         TIMESTAMP(3) NOT NULL,
  "isAllDay"        BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"       TIMESTAMP(3),

  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "calendar_events_institutionId_idx" ON "calendar_events"("institutionId");
CREATE INDEX "calendar_events_institutionId_startDate_idx" ON "calendar_events"("institutionId", "startDate");
