-- Add FK constraint for teacherUserId on academic_unit_subjects
-- (column already exists, just formalising the relation)

CREATE INDEX IF NOT EXISTS "academic_unit_subjects_teacherUserId_idx"
  ON "academic_unit_subjects"("teacherUserId");

ALTER TABLE "academic_unit_subjects"
  ADD CONSTRAINT "academic_unit_subjects_teacherUserId_fkey"
  FOREIGN KEY ("teacherUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
