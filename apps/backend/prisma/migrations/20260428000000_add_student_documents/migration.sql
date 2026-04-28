-- CreateTable: student_documents
-- Stores scanned/uploaded documents submitted at student admission.
-- Files are hosted on Cloudinary under <institutionId>/<studentId>/.

CREATE TABLE "student_documents" (
    "id"               TEXT NOT NULL,
    "institutionId"    TEXT NOT NULL,
    "studentId"        TEXT NOT NULL,
    "type"             TEXT NOT NULL,
    "label"            TEXT NOT NULL,
    "url"              TEXT NOT NULL,
    "publicId"         TEXT NOT NULL,
    "format"           TEXT,
    "sizeBytes"        INTEGER,
    "uploadedByUserId" TEXT,
    "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"        TIMESTAMP(3),

    CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "student_documents"
    ADD CONSTRAINT "student_documents_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_documents"
    ADD CONSTRAINT "student_documents_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for multi-tenant queries
CREATE INDEX "student_documents_institutionId_idx"   ON "student_documents"("institutionId");
CREATE INDEX "student_documents_studentId_idx"       ON "student_documents"("studentId");
CREATE INDEX "student_documents_institutionId_studentId_idx" ON "student_documents"("institutionId", "studentId");
