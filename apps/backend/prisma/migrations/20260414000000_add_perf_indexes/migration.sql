-- Performance indexes — identified from hot query path analysis.
-- All are non-unique, non-blocking (CREATE INDEX does not lock writes in Postgres 11+
-- when run outside a transaction; Prisma migrate wraps in a transaction, which is fine
-- for indexes of this size).

-- Student: active list queries filter on institutionId + status
CREATE INDEX IF NOT EXISTS "students_institutionId_status_idx" ON "students"("institutionId", "status");

-- Student: parent notification query filters institutionId + parentUserId
CREATE INDEX IF NOT EXISTS "students_institutionId_parentUserId_idx" ON "students"("institutionId", "parentUserId");

-- User: phone-based login lookup (parents log in with phone, not email)
CREATE INDEX IF NOT EXISTS "users_institutionId_phone_idx" ON "users"("institutionId", "phone");

-- RefreshToken: token refresh validates by tokenHash — needs index for fast lookup
CREATE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- FeePayment: getStudentBalance queries filter studentId + academicYearId together
CREATE INDEX IF NOT EXISTS "fee_payments_studentId_academicYearId_idx" ON "fee_payments"("studentId", "academicYearId");
