-- DropForeignKey (IF EXISTS — otp_records may not exist on fresh databases)
ALTER TABLE IF EXISTS "otp_records" DROP CONSTRAINT IF EXISTS "otp_records_institutionId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT[],
ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;

-- DropTable
DROP TABLE IF EXISTS "otp_records";

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_otps_institutionId_idx" ON "password_reset_otps"("institutionId");

-- CreateIndex
CREATE INDEX "password_reset_otps_email_institutionId_idx" ON "password_reset_otps"("email", "institutionId");

-- CreateIndex
CREATE INDEX "password_reset_otps_expiresAt_idx" ON "password_reset_otps"("expiresAt");

-- AddForeignKey
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
