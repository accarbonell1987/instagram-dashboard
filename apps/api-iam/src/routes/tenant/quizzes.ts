import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { QuizService, QuizAttemptService } from '../../services/index.js'
import {
  QuizSchema,
  QuizWithQuestionsSchema,
  StartAttemptResponseSchema,
  SubmitAnswerRequestSchema,
  QuizAttemptSchema,
  QuizAttemptAnswerSchema,
  AttemptWithAnswersSchema,
  TenantQuizDetailSchema,
  QuestionWithOptionsSchema,
  QuizParamsSchema,
} from '../schemas/quiz.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

export function createTenantQuizzesRouter(
  quizService: QuizService,
  quizAttemptService: QuizAttemptService,
  authGuard: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  // Apply authGuard to all tenant routes
  router.use('/tenants/current/quizzes', authGuard)
  router.use('/tenants/current/quizzes/:quizId', authGuard)
  router.use('/tenants/current/quizzes/:quizId/attempts', authGuard)
  router.use('/tenants/current/quizzes/:quizId/attempts/:attemptId', authGuard)
  router.use('/tenants/current/quizzes/:quizId/attempts/:attemptId/answers', authGuard)
  router.use('/tenants/current/quizzes/:quizId/attempts/:attemptId/complete', authGuard)

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /tenants/current/quizzes — List available quizzes
  // ═══════════════════════════════════════════════════════════════════════════

  const listAvailableQuizzesRoute = createRoute({
    method: 'get',
    path: '/tenants/current/quizzes',
    operationId: 'listAvailableQuizzes',
    tags: ['tenant', 'quizzes'],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              quizzes: z.array(TenantQuizDetailSchema),
            }),
          },
        },
        description: 'List of available quizzes for the tenant',
      },
      401: commonErrorResponses[401],
    },
  })

  router.openapi(listAvailableQuizzesRoute, async (c) => {
    const allQuizzes = await quizService.listQuizzes({ active: true })

    const quizDetails = allQuizzes.map((q) => ({
      id: q.id,
      moduleId: q.moduleId ?? null,
      title: q.title,
      description: q.description ?? null,
      passingScore: q.passingScore,
      timeLimitMinutes: q.timeLimitMinutes ?? null,
      active: q.active,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
      questionCount: 0, // Will be resolved per-quiz if needed
    }))

    return c.json({ quizzes: quizDetails }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /tenants/current/quizzes/{quizId} — Quiz detail
  // ═══════════════════════════════════════════════════════════════════════════

  const getTenantQuizRoute = createRoute({
    method: 'get',
    path: '/tenants/current/quizzes/{quizId}',
    operationId: 'getTenantQuiz',
    tags: ['tenant', 'quizzes'],
    request: {
      params: QuizParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: TenantQuizDetailSchema } },
        description: 'Quiz detail (no answers revealed)',
      },
      401: commonErrorResponses[401],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getTenantQuizRoute, async (c) => {
    const { quizId } = c.req.valid('param')
    const quiz = await quizService.getQuizWithQuestions(quizId)

    return c.json({
      id: quiz.id,
      moduleId: quiz.moduleId ?? null,
      title: quiz.title,
      description: quiz.description ?? null,
      passingScore: quiz.passingScore,
      timeLimitMinutes: quiz.timeLimitMinutes ?? null,
      active: quiz.active,
      createdAt: quiz.createdAt.toISOString(),
      updatedAt: quiz.updatedAt.toISOString(),
      questionCount: quiz.questions.length,
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /tenants/current/quizzes/{quizId}/attempts — Start attempt
  // ═══════════════════════════════════════════════════════════════════════════

  const startAttemptRoute = createRoute({
    method: 'post',
    path: '/tenants/current/quizzes/{quizId}/attempts',
    operationId: 'startAttempt',
    tags: ['tenant', 'quizzes'],
    request: {
      params: QuizParamsSchema,
    },
    responses: {
      201: {
        content: { 'application/json': { schema: StartAttemptResponseSchema } },
        description: 'Attempt started',
      },
      401: commonErrorResponses[401],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(startAttemptRoute, async (c) => {
    const { quizId } = c.req.valid('param')
    const { sub: userId, tenantUuid: tenantId } = c.var.user

    const attempt = await quizAttemptService.startAttempt(quizId, tenantId, userId)
    const quiz = await quizService.getQuizWithQuestions(quizId)

    return c.json({
      attempt: {
        id: attempt.id,
        quizId: attempt.quizId,
        tenantId: attempt.tenantId,
        userId: attempt.userId,
        score: attempt.score ?? null,
        passed: attempt.passed ?? null,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
        createdAt: attempt.createdAt.toISOString(),
        updatedAt: attempt.updatedAt.toISOString(),
      },
      quiz: {
        id: quiz.id,
        moduleId: quiz.moduleId ?? null,
        title: quiz.title,
        description: quiz.description ?? null,
        passingScore: quiz.passingScore,
        timeLimitMinutes: quiz.timeLimitMinutes ?? null,
        active: quiz.active,
        createdAt: quiz.createdAt.toISOString(),
        updatedAt: quiz.updatedAt.toISOString(),
        questions: quiz.questions.map((q) => ({
          id: q.id,
          quizId: q.quizId,
          text: q.text,
          type: q.type,
          order: q.order,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
          options: q.options.map((o) => ({
            id: o.id,
            questionId: o.questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order,
            createdAt: o.createdAt.toISOString(),
          })),
        })),
      },
    }, 201)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /tenants/current/quizzes/{quizId}/attempts/{attemptId}/answers — Submit answer
  // ═══════════════════════════════════════════════════════════════════════════

  const submitAnswerParams = z.object({
    quizId: z.string().uuid(),
    attemptId: z.string().uuid(),
  })

  const submitAnswerRoute = createRoute({
    method: 'post',
    path: '/tenants/current/quizzes/{quizId}/attempts/{attemptId}/answers',
    operationId: 'submitAnswer',
    tags: ['tenant', 'quizzes'],
    request: {
      params: submitAnswerParams,
      body: {
        content: { 'application/json': { schema: SubmitAnswerRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuizAttemptAnswerSchema } },
        description: 'Answer submitted',
      },
      401: commonErrorResponses[401],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(submitAnswerRoute, async (c) => {
    const { attemptId } = c.req.valid('param')
    const { questionId, selectedOptionId } = c.req.valid('json')
    const answer = await quizAttemptService.submitAnswer(attemptId, questionId, selectedOptionId ?? undefined)

    return c.json({
      id: answer.id,
      attemptId: answer.attemptId,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId ?? null,
      createdAt: answer.createdAt.toISOString(),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /tenants/current/quizzes/{quizId}/attempts/{attemptId}/complete — Complete attempt
  // ═══════════════════════════════════════════════════════════════════════════

  const completeAttemptParams = z.object({
    quizId: z.string().uuid(),
    attemptId: z.string().uuid(),
  })

  const completeAttemptRoute = createRoute({
    method: 'post',
    path: '/tenants/current/quizzes/{quizId}/attempts/{attemptId}/complete',
    operationId: 'completeAttempt',
    tags: ['tenant', 'quizzes'],
    request: {
      params: completeAttemptParams,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AttemptWithAnswersSchema } },
        description: 'Attempt completed with score',
      },
      401: commonErrorResponses[401],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(completeAttemptRoute, async (c) => {
    const { attemptId } = c.req.valid('param')
    const { sub: userId } = c.var.user

    const attempt = await quizAttemptService.completeAttempt(attemptId, userId)
    const fullAttempt = await quizAttemptService.getAttempt(attemptId, userId)

    return c.json({
      id: attempt.id,
      quizId: attempt.quizId,
      tenantId: attempt.tenantId,
      userId: attempt.userId,
      score: attempt.score ?? null,
      passed: attempt.passed ?? null,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      completedAt: attempt.completedAt?.toISOString() ?? null,
      createdAt: attempt.createdAt.toISOString(),
      updatedAt: attempt.updatedAt.toISOString(),
      answers: fullAttempt.answers.map((a: any) => ({
        id: a.id,
        attemptId: a.attemptId,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId ?? null,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
        question: a.question ? {
          id: a.question.id,
          quizId: a.question.quizId,
          text: a.question.text,
          type: a.question.type as 'multiple_choice' | 'true_false',
          order: a.question.order,
          createdAt: a.question.createdAt instanceof Date ? a.question.createdAt.toISOString() : String(a.question.createdAt),
          updatedAt: a.question.updatedAt instanceof Date ? a.question.updatedAt.toISOString() : String(a.question.updatedAt),
          options: (a.question.options ?? []).map((o: any) => ({
            id: o.id,
            questionId: o.questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order,
            createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
          })),
        } : undefined,
        selectedOption: a.selectedOption ? {
          id: a.selectedOption.id,
          questionId: a.selectedOption.questionId,
          text: a.selectedOption.text,
          isCorrect: a.selectedOption.isCorrect,
          order: a.selectedOption.order,
          createdAt: a.selectedOption.createdAt instanceof Date ? a.selectedOption.createdAt.toISOString() : String(a.selectedOption.createdAt),
        } : null,
      })),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /tenants/current/quizzes/{quizId}/attempts — List user's attempts
  // ═══════════════════════════════════════════════════════════════════════════

  const listAttemptsRoute = createRoute({
    method: 'get',
    path: '/tenants/current/quizzes/{quizId}/attempts',
    operationId: 'listAttempts',
    tags: ['tenant', 'quizzes'],
    request: {
      params: QuizParamsSchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              attempts: z.array(QuizAttemptSchema),
            }),
          },
        },
        description: 'List of user attempts for this quiz',
      },
      401: commonErrorResponses[401],
    },
  })

  router.openapi(listAttemptsRoute, async (c) => {
    const { quizId } = c.req.valid('param')
    const { sub: userId } = c.var.user

    const attempts = await quizAttemptService.listAttempts({ quizId, userId })

    return c.json({
      attempts: attempts.map((a) => ({
        id: a.id,
        quizId: a.quizId,
        tenantId: a.tenantId,
        userId: a.userId,
        score: a.score ?? null,
        passed: a.passed ?? null,
        status: a.status,
        startedAt: a.startedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /tenants/current/quizzes/{quizId}/attempts/{attemptId} — Get attempt detail
  // ═══════════════════════════════════════════════════════════════════════════

  const getAttemptRoute = createRoute({
    method: 'get',
    path: '/tenants/current/quizzes/{quizId}/attempts/{attemptId}',
    operationId: 'getAttempt',
    tags: ['tenant', 'quizzes'],
    request: {
      params: z.object({
        quizId: z.string().uuid(),
        attemptId: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AttemptWithAnswersSchema } },
        description: 'Attempt with answers and results',
      },
      401: commonErrorResponses[401],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getAttemptRoute, async (c) => {
    const { attemptId } = c.req.valid('param')
    const { sub: userId } = c.var.user

    const attempt = await quizAttemptService.getAttempt(attemptId, userId)

    return c.json({
      id: attempt.id,
      quizId: attempt.quizId,
      tenantId: attempt.tenantId,
      userId: attempt.userId,
      score: attempt.score ?? null,
      passed: attempt.passed ?? null,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      completedAt: attempt.completedAt?.toISOString() ?? null,
      createdAt: attempt.createdAt.toISOString(),
      updatedAt: attempt.updatedAt.toISOString(),
      answers: attempt.answers.map((a: any) => ({
        id: a.id,
        attemptId: a.attemptId,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId ?? null,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
        question: a.question ? {
          id: a.question.id,
          quizId: a.question.quizId,
          text: a.question.text,
          type: a.question.type as 'multiple_choice' | 'true_false',
          order: a.question.order,
          createdAt: a.question.createdAt instanceof Date ? a.question.createdAt.toISOString() : String(a.question.createdAt),
          updatedAt: a.question.updatedAt instanceof Date ? a.question.updatedAt.toISOString() : String(a.question.updatedAt),
          options: (a.question.options ?? []).map((o: any) => ({
            id: o.id,
            questionId: o.questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order,
            createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
          })),
        } : undefined,
        selectedOption: a.selectedOption ? {
          id: a.selectedOption.id,
          questionId: a.selectedOption.questionId,
          text: a.selectedOption.text,
          isCorrect: a.selectedOption.isCorrect,
          order: a.selectedOption.order,
          createdAt: a.selectedOption.createdAt instanceof Date ? a.selectedOption.createdAt.toISOString() : String(a.selectedOption.createdAt),
        } : null,
      })),
    }, 200)
  })

  return router
}
