-- AlterTable
ALTER TABLE "academic_units" ADD COLUMN "classTeacherUserId" TEXT;

-- CreateIndex
CREATE INDEX "academic_units_classTeacherUserId_idx" ON "academic_units"("classTeacherUserId");

-- AddForeignKey
ALTER TABLE "academic_units" ADD CONSTRAINT "academic_units_classTeacherUserId_fkey" FOREIGN KEY ("classTeacherUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
