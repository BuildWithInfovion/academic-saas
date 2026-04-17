-- Add activeSessionId for single-session enforcement
ALTER TABLE "platform_admins"
  ADD COLUMN "activeSessionId" TEXT;
