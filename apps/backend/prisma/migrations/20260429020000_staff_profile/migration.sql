CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id"                     TEXT NOT NULL,
  "institutionId"          TEXT NOT NULL,
  "userId"                 TEXT NOT NULL,
  "employeeId"             TEXT,
  "designation"            TEXT,
  "department"             TEXT,
  "dateOfJoining"          TIMESTAMP(3),
  "dateOfBirth"            TIMESTAMP(3),
  "gender"                 TEXT,
  "qualification"          TEXT,
  "experience"             TEXT,
  "address"                TEXT,
  "bloodGroup"             TEXT,
  "aadharNumber"           TEXT,
  "panNumber"              TEXT,
  "bankAccount"            TEXT,
  "ifscCode"               TEXT,
  "bankName"               TEXT,
  "emergencyContactName"   TEXT,
  "emergencyContactPhone"  TEXT,
  "photoUrl"               TEXT,
  "notes"                  TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_userId_key" ON "staff_profiles"("userId");
CREATE INDEX IF NOT EXISTS "staff_profiles_institutionId_idx" ON "staff_profiles"("institutionId");

ALTER TABLE "staff_profiles"
  ADD CONSTRAINT IF NOT EXISTS "staff_profiles_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_profiles"
  ADD CONSTRAINT IF NOT EXISTS "staff_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
