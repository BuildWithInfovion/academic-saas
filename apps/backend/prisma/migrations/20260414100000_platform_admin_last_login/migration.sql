-- Add lastLoginAt to platform_admins for session tracking and profile display
ALTER TABLE "platform_admins" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
