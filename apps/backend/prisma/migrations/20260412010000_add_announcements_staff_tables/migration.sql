-- CreateTable: announcements
CREATE TABLE IF NOT EXISTS "announcements" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "targetRoles" JSONB NOT NULL DEFAULT '["all"]',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcements_institutionId_idx" ON "announcements"("institutionId");
CREATE INDEX IF NOT EXISTS "announcements_authorUserId_idx" ON "announcements"("authorUserId");

-- AddForeignKey (only if constraint doesn't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_institutionId_fkey'
  ) THEN
    ALTER TABLE "announcements" ADD CONSTRAINT "announcements_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_authorUserId_fkey'
  ) THEN
    ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: staff_attendance
CREATE TABLE IF NOT EXISTS "staff_attendance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "note" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendance_institutionId_userId_date_key"
  ON "staff_attendance"("institutionId", "userId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_attendance_institutionId_idx" ON "staff_attendance"("institutionId");
CREATE INDEX IF NOT EXISTS "staff_attendance_userId_idx" ON "staff_attendance"("userId");
CREATE INDEX IF NOT EXISTS "staff_attendance_date_idx" ON "staff_attendance"("date");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendance_institutionId_fkey'
  ) THEN
    ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendance_userId_fkey'
  ) THEN
    ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: staff_leave_requests
CREATE TABLE IF NOT EXISTS "staff_leave_requests" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_leave_requests_institutionId_idx" ON "staff_leave_requests"("institutionId");
CREATE INDEX IF NOT EXISTS "staff_leave_requests_userId_idx" ON "staff_leave_requests"("userId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_leave_requests_institutionId_fkey'
  ) THEN
    ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_leave_requests_userId_fkey'
  ) THEN
    ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_leave_requests_approvedById_fkey'
  ) THEN
    ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
