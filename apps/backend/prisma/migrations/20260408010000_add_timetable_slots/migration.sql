CREATE TABLE "timetable_slots" (
  "id"             TEXT NOT NULL,
  "institutionId"  TEXT NOT NULL,
  "academicUnitId" TEXT NOT NULL,
  "dayOfWeek"      INTEGER NOT NULL,
  "periodNo"       INTEGER NOT NULL,
  "subjectId"      TEXT,
  "teacherUserId"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "timetable_slots_academicUnitId_dayOfWeek_periodNo_key"
  ON "timetable_slots"("academicUnitId", "dayOfWeek", "periodNo");

CREATE INDEX "timetable_slots_institutionId_idx"  ON "timetable_slots"("institutionId");
CREATE INDEX "timetable_slots_academicUnitId_idx" ON "timetable_slots"("academicUnitId");

ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_academicUnitId_fkey"
  FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
