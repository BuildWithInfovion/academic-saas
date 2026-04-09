-- AlterTable
ALTER TABLE "students" ADD COLUMN     "aadharNumber" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "casteCategory" TEXT,
ADD COLUMN     "nationality" TEXT DEFAULT 'Indian',
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "secondaryPhone" TEXT;
