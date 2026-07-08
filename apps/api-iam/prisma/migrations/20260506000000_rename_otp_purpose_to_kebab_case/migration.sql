-- Rename otp_purpose enum values from snake_case to kebab-case.
-- Prisma schema uses @map("first-login") and @map("signup-rep") but the initial
-- migration created the enum with snake_case values. This migration corrects the drift.
--
-- ALTER TYPE ... RENAME VALUE is safe: existing rows are updated atomically by
-- PostgreSQL (enum ordinals are stored, not strings) with no table rewrite.

ALTER TYPE "otp_purpose" RENAME VALUE 'first_login' TO 'first-login';
ALTER TYPE "otp_purpose" RENAME VALUE 'signup_rep' TO 'signup-rep';
