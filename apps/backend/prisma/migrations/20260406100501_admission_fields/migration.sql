-- AlterTable
ALTER TABLE "students" ADD COLUMN     "academicUnitId" TEXT,
ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "parentPhone" TEXT;

-- CreateIndex
CREATE INDEX "students_academicUnitId_idx" ON "students"("academicUnitId");
