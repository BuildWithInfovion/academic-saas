-- AlterTable: extend Student with standard CBSE/ICSE admission fields
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "placeOfBirth" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherTongue" TEXT;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherOccupation" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherQualification" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherEmail" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "fatherAadhar" TEXT;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherOccupation" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherQualification" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherEmail" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "motherAadhar" TEXT;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "annualIncome" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "isEwsCategory" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pinCode" TEXT;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousClass" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousBoard" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousMarks" TEXT;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medicalConditions" TEXT;
