import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { QuizService, QuizAttemptService } from '../../services/index.js'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { ForbiddenError } from '../../errors.js'
import {
  QuizSchema,
  QuestionSchema,
  QuestionOptionSchema,
  QuizWithQuestionsSchema,
  QuizListResponseSchema,
  CreateQuizRequestSchema,
  UpdateQuizRequestSchema,
  QuizParamsSchema,
  QuestionParamsSchema,
  OptionParamsSchema,
  CreateQuestionRequestSchema,
  UpdateQuestionRequestSchema,
  ReorderQuestionsRequestSchema,
  CreateOptionRequestSchema,
  UpdateOptionRequestSchema,
  QuizResultsResponseSchema,
  ListQuizzesQuerySchema,
} from '../schemas/quiz.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('quizzes.forbidden', 'SuperAdmin role required')
  }
}

export function createAdminQuizzesRouter(
  quizService: QuizService,
  quizAttemptService: QuizAttemptService,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
  prisma: PrismaClient,
) {
  const router = new OpenAPIHono()

  // Apply authGuard to all admin routes
  router.use('/admin/quizzes', authGuard)
  router.use('/admin/quizzes/:quizId', authGuard)
  router.use('/admin/quizzes/:quizId/questions', authGuard)
  router.use('/admin/quizzes/:quizId/questions/:questionId', authGuard)
  router.use('/admin/quizzes/:quizId/questions/:questionId/options', authGuard)
  router.use('/admin/quizzes/:quizId/questions/:questionId/options/:optionId', authGuard)
  router.use('/admin/quiz-results', authGuard)
  router.use('/admin/plans/:planId/modules', authGuard)

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /admin/quizzes — List all quizzes
  // ═══════════════════════════════════════════════════════════════════════════

  const listQuizzesRoute = createRoute({
    method: 'get',
    path: '/admin/quizzes',
    operationId: 'listQuizzes',
    tags: ['admin', 'quizzes'],
    request: {
      query: ListQuizzesQuerySchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuizListResponseSchema } },
        description: 'List of all quizzes',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listQuizzesRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const rawActive = c.req.query('active')
    const filter: { active?: boolean } = {}
    if (rawActive === 'true') filter.active = true
    else if (rawActive === 'false') filter.active = false

    const quizzes = await quizService.listQuizzes(filter)
    return c.json({
      quizzes: quizzes.map((q) => ({
        id: q.id,
        moduleId: q.moduleId ?? null,
        title: q.title,
        description: q.description ?? null,
        passingScore: q.passingScore,
        timeLimitMinutes: q.timeLimitMinutes ?? null,
        active: q.active,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      })),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /admin/quizzes — Create quiz
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('POST', '/admin/quizzes', idempotency)

  const createQuizRoute = createRoute({
    method: 'post',
    path: '/admin/quizzes',
    operationId: 'createQuiz',
    tags: ['admin', 'quizzes'],
    request: {
      body: {
        content: { 'application/json': { schema: CreateQuizRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: QuizSchema } },
        description: 'Quiz created',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(createQuizRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const body = c.req.valid('json')
    const quiz = await quizService.createQuiz({
      title: body.title,
      description: body.description,
      passingScore: body.passingScore,
      timeLimitMinutes: body.timeLimitMinutes,
      moduleId: body.moduleId,
    })

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
    }, 201)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /admin/quizzes/{quizId} — Get quiz with questions
  // ═══════════════════════════════════════════════════════════════════════════

  const getQuizRoute = createRoute({
    method: 'get',
    path: '/admin/quizzes/{quizId}',
    operationId: 'getQuiz',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuizParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuizWithQuestionsSchema } },
        description: 'Quiz with questions and options',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getQuizRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
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
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /admin/quizzes/{quizId} — Update quiz
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('PATCH', '/admin/quizzes/:quizId', idempotency)

  const updateQuizRoute = createRoute({
    method: 'patch',
    path: '/admin/quizzes/{quizId}',
    operationId: 'updateQuiz',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuizParamsSchema,
      body: {
        content: { 'application/json': { schema: UpdateQuizRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuizSchema } },
        description: 'Quiz updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(updateQuizRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { quizId } = c.req.valid('param')
    const body = c.req.valid('json')

    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData['title'] = body.title
    if (body.description !== undefined) updateData['description'] = body.description
    if (body.passingScore !== undefined) updateData['passingScore'] = body.passingScore
    if (body.timeLimitMinutes !== undefined) updateData['timeLimitMinutes'] = body.timeLimitMinutes
    if (body.active !== undefined) updateData['active'] = body.active
    if (body.moduleId !== undefined) updateData['moduleId'] = body.moduleId

    const quiz = await quizService.updateQuiz(quizId, updateData as any)

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
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /admin/quizzes/{quizId} — Archive quiz
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('DELETE', '/admin/quizzes/:quizId', idempotency)

  const archiveQuizRoute = createRoute({
    method: 'delete',
    path: '/admin/quizzes/{quizId}',
    operationId: 'archiveQuiz',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuizParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuizSchema } },
        description: 'Quiz archived',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(archiveQuizRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { quizId } = c.req.valid('param')
    const quiz = await quizService.archiveQuiz(quizId)

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
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /admin/quizzes/{quizId}/questions — Add question
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('POST', '/admin/quizzes/:quizId/questions', idempotency)

  const addQuestionRoute = createRoute({
    method: 'post',
    path: '/admin/quizzes/{quizId}/questions',
    operationId: 'addQuestion',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuizParamsSchema,
      body: {
        content: { 'application/json': { schema: CreateQuestionRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: QuestionSchema } },
        description: 'Question created',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(addQuestionRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { quizId } = c.req.valid('param')
    const body = c.req.valid('json')
    const question = await quizService.addQuestion(quizId, body)

    return c.json({
      id: question.id,
      quizId: question.quizId,
      text: question.text,
      type: question.type,
      order: question.order,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    }, 201)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /admin/quizzes/{quizId}/questions/{questionId} — Update question
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('PATCH', '/admin/quizzes/:quizId/questions/:questionId', idempotency)

  const updateQuestionRoute = createRoute({
    method: 'patch',
    path: '/admin/quizzes/{quizId}/questions/{questionId}',
    operationId: 'updateQuestion',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuestionParamsSchema,
      body: {
        content: { 'application/json': { schema: UpdateQuestionRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuestionSchema } },
        description: 'Question updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(updateQuestionRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { questionId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updateData: { text?: string | undefined; type?: 'multiple_choice' | 'true_false' | undefined } = {}
    if (body.text !== undefined) updateData.text = body.text
    if (body.type !== undefined) updateData.type = body.type
    const question = await quizService.updateQuestion(questionId, updateData)

    return c.json({
      id: question.id,
      quizId: question.quizId,
      text: question.text,
      type: question.type,
      order: question.order,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /admin/quizzes/{quizId}/questions/{questionId} — Delete question
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('DELETE', '/admin/quizzes/:quizId/questions/:questionId', idempotency)

  const deleteQuestionRoute = createRoute({
    method: 'delete',
    path: '/admin/quizzes/{quizId}/questions/{questionId}',
    operationId: 'deleteQuestion',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuestionParamsSchema,
    },
    responses: {
      204: {
        description: 'Question deleted',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(deleteQuestionRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { questionId } = c.req.valid('param')
    await quizService.removeQuestion(questionId)
    return c.body(null, 204)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PUT /admin/quizzes/{quizId}/questions/reorder — Reorder questions
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('PUT', '/admin/quizzes/:quizId/questions/reorder', idempotency)

  const reorderQuestionsRoute = createRoute({
    method: 'put',
    path: '/admin/quizzes/{quizId}/questions/reorder',
    operationId: 'reorderQuestions',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuizParamsSchema,
      body: {
        content: { 'application/json': { schema: ReorderQuestionsRequestSchema } },
      },
    },
    responses: {
      204: {
        description: 'Questions reordered',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(reorderQuestionsRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { quizId } = c.req.valid('param')
    const { orderedIds } = c.req.valid('json')
    await quizService.reorderQuestions(quizId, orderedIds)
    return c.body(null, 204)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /admin/quizzes/{quizId}/questions/{questionId}/options — Add option
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('POST', '/admin/quizzes/:quizId/questions/:questionId/options', idempotency)

  const addOptionRoute = createRoute({
    method: 'post',
    path: '/admin/quizzes/{quizId}/questions/{questionId}/options',
    operationId: 'addOption',
    tags: ['admin', 'quizzes'],
    request: {
      params: QuestionParamsSchema,
      body: {
        content: { 'application/json': { schema: CreateOptionRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: QuestionOptionSchema } },
        description: 'Option created',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(addOptionRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { questionId } = c.req.valid('param')
    const body = c.req.valid('json')
    const option = await quizService.addOption(questionId, body)

    return c.json({
      id: option.id,
      questionId: option.questionId,
      text: option.text,
      isCorrect: option.isCorrect,
      order: option.order,
      createdAt: option.createdAt.toISOString(),
    }, 201)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /admin/quizzes/{quizId}/questions/{questionId}/options/{optionId} — Update option
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('PATCH', '/admin/quizzes/:quizId/questions/:questionId/options/:optionId', idempotency)

  const updateOptionRoute = createRoute({
    method: 'patch',
    path: '/admin/quizzes/{quizId}/questions/{questionId}/options/{optionId}',
    operationId: 'updateOption',
    tags: ['admin', 'quizzes'],
    request: {
      params: OptionParamsSchema,
      body: {
        content: { 'application/json': { schema: UpdateOptionRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuestionOptionSchema } },
        description: 'Option updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(updateOptionRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { optionId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updateData: { text?: string | undefined; isCorrect?: boolean | undefined } = {}
    if (body.text !== undefined) updateData.text = body.text
    if (body.isCorrect !== undefined) updateData.isCorrect = body.isCorrect
    const option = await quizService.updateOption(optionId, updateData)

    return c.json({
      id: option.id,
      questionId: option.questionId,
      text: option.text,
      isCorrect: option.isCorrect,
      order: option.order,
      createdAt: option.createdAt.toISOString(),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /admin/quizzes/{quizId}/questions/{questionId}/options/{optionId} — Delete option
  // ═══════════════════════════════════════════════════════════════════════════

  router.on('DELETE', '/admin/quizzes/:quizId/questions/:questionId/options/:optionId', idempotency)

  const deleteOptionRoute = createRoute({
    method: 'delete',
    path: '/admin/quizzes/{quizId}/questions/{questionId}/options/{optionId}',
    operationId: 'deleteOption',
    tags: ['admin', 'quizzes'],
    request: {
      params: OptionParamsSchema,
    },
    responses: {
      204: {
        description: 'Option deleted',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(deleteOptionRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { optionId } = c.req.valid('param')
    await quizService.removeOption(optionId)
    return c.body(null, 204)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /admin/quiz-results — List all attempts (admin results view)
  // ═══════════════════════════════════════════════════════════════════════════

  const listQuizResultsRoute = createRoute({
    method: 'get',
    path: '/admin/quiz-results',
    operationId: 'listQuizResults',
    tags: ['admin', 'quizzes'],
    request: {
      query: z.object({
        quizId: z.string().uuid().optional(),
        tenantId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: QuizResultsResponseSchema } },
        description: 'List of quiz attempts',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listQuizResultsRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const quizId = c.req.query('quizId')
    const tenantId = c.req.query('tenantId')

    let attempts: Awaited<ReturnType<typeof quizAttemptService.listAttemptsByTenant>> | Awaited<ReturnType<typeof quizAttemptService.listAttemptsByQuiz>>
    if (tenantId) {
      attempts = await quizAttemptService.listAttemptsByTenant(tenantId, quizId)
    } else if (quizId) {
      attempts = await quizAttemptService.listAttemptsByQuiz(quizId)
    } else {
      // Return empty when no filter
      attempts = []
    }

    return c.json({
      attempts: attempts.map((a: any) => ({
        id: a.id,
        quizId: a.quizId,
        tenantId: a.tenantId,
        userId: a.userId,
        score: a.score ?? null,
        passed: a.passed ?? null,
        status: a.status,
        startedAt: a.startedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() ?? null,
      })),
    }, 200)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /admin/plans/{planId}/modules — Get plan modules (Phase 1 integration)
  // ═══════════════════════════════════════════════════════════════════════════

  const getPlanModulesRoute = createRoute({
    method: 'get',
    path: '/admin/plans/{planId}/modules',
    operationId: 'getPlanModules',
    tags: ['admin', 'plans'],
    request: {
      params: z.object({
        planId: z.string(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              modules: z.array(z.object({
                moduleId: z.string(),
                planId: z.string(),
              })),
              moduleIds: z.array(z.string()),
            }),
          },
        },
        description: 'List of plan modules',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(getPlanModulesRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { planId } = c.req.valid('param')

    const assignments = await prisma.planModule.findMany({
      where: { planId },
      select: { moduleId: true },
    })

    const moduleIds = assignments.map(a => a.moduleId)

    return c.json({
      modules: assignments.map(a => ({ moduleId: a.moduleId, planId })),
      moduleIds,
    }, 200)
  })

  return router
}
