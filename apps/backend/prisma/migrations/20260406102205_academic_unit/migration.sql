-- CreateTable
CREATE TABLE "academic_units" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "academic_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_units_institutionId_idx" ON "academic_units"("institutionId");

-- CreateIndex
CREATE INDEX "academic_units_parentId_idx" ON "academic_units"("parentId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_academicUnitId_fkey" FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_units" ADD CONSTRAINT "academic_units_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_units" ADD CONSTRAINT "academic_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "academic_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
