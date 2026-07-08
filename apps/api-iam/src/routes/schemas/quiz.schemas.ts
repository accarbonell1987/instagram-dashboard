import { z } from '@hono/zod-openapi'

// ── Shared entity schemas ──────────────────────────────────────────────────

export const QuestionTypeSchema = z.enum(['multiple_choice', 'true_false'])

export const AttemptStatusSchema = z.enum(['in_progress', 'completed', 'abandoned'])

export const QuizSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().optional().nullable(),
  title: z.string(),
  description: z.string().optional().nullable(),
  passingScore: z.number().int(),
  timeLimitMinutes: z.number().int().optional().nullable(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  text: z.string(),
  type: QuestionTypeSchema,
  order: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const QuestionOptionSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  text: z.string(),
  isCorrect: z.boolean(),
  order: z.number().int(),
  createdAt: z.string().datetime(),
})

export const QuizAttemptSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  score: z.number().int().optional().nullable(),
  passed: z.boolean().optional().nullable(),
  status: AttemptStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const QuizAttemptAnswerSchema = z.object({
  id: z.string().uuid(),
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
})

// ── Question with options ──────────────────────────────────────────────────

export const QuestionWithOptionsSchema = QuestionSchema.extend({
  options: z.array(QuestionOptionSchema),
})

export const QuizWithQuestionsSchema = QuizSchema.extend({
  questions: z.array(QuestionWithOptionsSchema),
})

// ── Admin: List quizzes ────────────────────────────────────────────────────

export const ListQuizzesQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
})

export const QuizListResponseSchema = z.object({
  quizzes: z.array(QuizSchema),
})

// ── Admin: Create quiz ─────────────────────────────────────────────────────

export const CreateQuizRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  passingScore: z.number().int().min(0).max(100).default(60),
  timeLimitMinutes: z.number().int().min(1).optional(),
  moduleId: z.string().optional(),
})

// ── Admin: Update quiz ─────────────────────────────────────────────────────

export const UpdateQuizRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).optional().nullable(),
  active: z.boolean().optional(),
  moduleId: z.string().optional().nullable(),
})

// ── Admin: Quiz params ─────────────────────────────────────────────────────

export const QuizParamsSchema = z.object({
  quizId: z.string().uuid(),
})

export const QuestionParamsSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
})

export const OptionParamsSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
})

// ── Admin: Create question ─────────────────────────────────────────────────

export const CreateQuestionRequestSchema = z.object({
  text: z.string().min(1),
  type: QuestionTypeSchema,
})

// ── Admin: Update question ─────────────────────────────────────────────────

export const UpdateQuestionRequestSchema = z.object({
  text: z.string().min(1).optional(),
  type: QuestionTypeSchema.optional(),
})

// ── Admin: Reorder questions ───────────────────────────────────────────────

export const ReorderQuestionsRequestSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
})

// ── Admin: Create option ───────────────────────────────────────────────────

export const CreateOptionRequestSchema = z.object({
  text: z.string().min(1).max(500),
  isCorrect: z.boolean().default(false),
})

// ── Admin: Update option ───────────────────────────────────────────────────

export const UpdateOptionRequestSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  isCorrect: z.boolean().optional(),
})

// ── Tenant: Start attempt ──────────────────────────────────────────────────

export const StartAttemptResponseSchema = z.object({
  attempt: QuizAttemptSchema,
  quiz: QuizWithQuestionsSchema,
})

// ── Tenant: Submit answer ──────────────────────────────────────────────────

export const SubmitAnswerRequestSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid().optional().nullable(),
})

// ── Tenant: Get attempt detail ─────────────────────────────────────────────

export const AttemptWithAnswersSchema = QuizAttemptSchema.extend({
  answers: z.array(
    QuizAttemptAnswerSchema.extend({
      question: QuestionWithOptionsSchema.optional(),
      selectedOption: QuestionOptionSchema.optional().nullable(),
    }),
  ),
})

// ── Tenant: Quiz detail (no answers revealed) ──────────────────────────────

export const TenantQuizDetailSchema = QuizSchema.extend({
  questionCount: z.number().int(),
})

// ── Result schemas ─────────────────────────────────────────────────────────

export const QuizResultSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  score: z.number().int().optional().nullable(),
  passed: z.boolean().optional().nullable(),
  status: AttemptStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
  tenantName: z.string().optional(),
  userName: z.string().optional(),
})

export const QuizResultsResponseSchema = z.object({
  attempts: z.array(QuizResultSchema),
})

// ── Plan modules response (for Phase 1 integration) ────────────────────────

export const PlanModulesResponseSchema = z.object({
  modules: z.array(z.object({
    moduleId: z.string(),
    planId: z.string(),
  })),
  moduleIds: z.array(z.string()),
})
