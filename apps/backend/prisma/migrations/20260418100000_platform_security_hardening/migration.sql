-- AlterTable: add lockout + failed-login tracking to platform_admins
ALTER TABLE "platform_admins"
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil"      TIMESTAMP(3),
  ADD COLUMN "lastFailedAt"     TIMESTAMP(3);

-- CreateTable: platform_login_logs
CREATE TABLE "platform_login_logs" (
    "id"         TEXT         NOT NULL,
    "adminId"    TEXT         NOT NULL,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "success"    BOOLEAN      NOT NULL,
    "failReason" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_login_logs_adminId_idx"   ON "platform_login_logs"("adminId");
CREATE INDEX "platform_login_logs_createdAt_idx" ON "platform_login_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "platform_login_logs"
  ADD CONSTRAINT "platform_login_logs_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: platform_password_resets
CREATE TABLE "platform_password_resets" (
    "id"        TEXT         NOT NULL,
    "adminId"   TEXT         NOT NULL,
    "tokenHash" TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_password_resets_tokenHash_key" ON "platform_password_resets"("tokenHash");
CREATE INDEX "platform_password_resets_adminId_idx" ON "platform_password_resets"("adminId");

-- AddForeignKey
ALTER TABLE "platform_password_resets"
  ADD CONSTRAINT "platform_password_resets_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
