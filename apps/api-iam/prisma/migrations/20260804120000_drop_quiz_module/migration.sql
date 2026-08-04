-- Drop the quiz module ("Evaluaciones").
--
-- The feature was removed from the product: its routes, services, repositories
-- and UI are gone, so these tables are unreachable. Dropped in FK order —
-- answers reference attempts, questions and options; attempts and questions
-- reference quizzes.
--
-- DESTRUCTIVE: this deletes every quiz, question, option, attempt and answer.
-- Nothing else in the schema references these tables (modules.quizzes was a
-- back-relation only), so no other data is affected.
DROP TABLE IF EXISTS "quiz_attempt_answers";
DROP TABLE IF EXISTS "quiz_attempts";
DROP TABLE IF EXISTS "question_options";
DROP TABLE IF EXISTS "questions";
DROP TABLE IF EXISTS "quizzes";

DROP TYPE IF EXISTS "question_type";
DROP TYPE IF EXISTS "attempt_status";
