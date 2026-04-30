-- CreateTable: conversations
CREATE TABLE IF NOT EXISTS "conversations" (
    "id"            TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "parentUserId"  TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "studentId"     TEXT,
    "subject"       TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages
CREATE TABLE IF NOT EXISTS "messages" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId"       TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "readAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on conversations
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_institutionId_parentUserId_teacherUserId_studentId_key"
    ON "conversations"("institutionId", "parentUserId", "teacherUserId", "studentId");

-- Indexes
CREATE INDEX IF NOT EXISTS "conversations_institutionId_idx" ON "conversations"("institutionId");
CREATE INDEX IF NOT EXISTS "conversations_parentUserId_idx"  ON "conversations"("parentUserId");
CREATE INDEX IF NOT EXISTS "conversations_teacherUserId_idx" ON "conversations"("teacherUserId");
CREATE INDEX IF NOT EXISTS "messages_conversationId_idx"     ON "messages"("conversationId");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx"           ON "messages"("senderId");

-- Foreign keys (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_institutionId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_parentUserId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_parentUserId_fkey"
        FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_teacherUserId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_teacherUserId_fkey"
        FOREIGN KEY ("teacherUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_studentId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_conversationId_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_senderId_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
