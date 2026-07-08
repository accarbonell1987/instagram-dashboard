import type { PrismaClient } from '../../generated/prisma/client.js'
import type { QuizAttempt, QuizAttemptAnswer, QuizAttemptWithAnswers } from '../../domain/index.js'

export type QuizAttemptRepository = {
  create(data: CreateAttemptData): Promise<QuizAttempt>
  findById(id: string): Promise<QuizAttempt | null>
  findByIdWithAnswers(id: string): Promise<QuizAttemptWithAnswers | null>
  findActiveByUser(quizId: string, userId: string): Promise<QuizAttempt | null>
  listByTenant(tenantId: string, quizId?: string | undefined): Promise<QuizAttempt[]>
  listByQuiz(quizId: string): Promise<QuizAttempt[]>
  listByUser(quizId: string, userId: string): Promise<QuizAttempt[]>
  upsertAnswer(attemptId: string, questionId: string, selectedOptionId?: string | null): Promise<QuizAttemptAnswer>
  completeAttempt(id: string, score: number, passed: boolean): Promise<QuizAttempt>
  findAnswer(attemptId: string, questionId: string): Promise<QuizAttemptAnswer | null>
}

export type CreateAttemptData = {
  quizId: string
  tenantId: string
  userId: string
}

export function createQuizAttemptRepository(prisma: PrismaClient): QuizAttemptRepository {
  return {
    async create(data) {
      const row = await prisma.quizAttempt.create({ data })
      return toAttempt(row)
    },

    async findById(id) {
      const row = await prisma.quizAttempt.findUnique({ where: { id } })
      return row ? toAttempt(row) : null
    },

    async findByIdWithAnswers(id) {
      const row = await prisma.quizAttempt.findUnique({
        where: { id },
        include: {
          answers: {
            include: {
              question: {
                include: { options: { orderBy: { order: 'asc' } } },
              },
              selectedOption: true,
            },
          },
        },
      })
      if (!row) return null

      return {
        ...toAttempt(row),
        answers: row.answers.map(toAnswerDetail),
      }
    },

    async findActiveByUser(quizId, userId) {
      const row = await prisma.quizAttempt.findFirst({
        where: {
          quizId,
          userId,
          status: 'in_progress',
        },
      })
      return row ? toAttempt(row) : null
    },

    async listByTenant(tenantId, quizId) {
      const where: Record<string, unknown> = { tenantId }
      if (quizId) where['quizId'] = quizId
      const rows = await prisma.quizAttempt.findMany({
        where,
        include: { quiz: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return rows.map(toAttempt)
    },

    async listByQuiz(quizId) {
      const rows = await prisma.quizAttempt.findMany({
        where: { quizId },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return rows.map(toAttempt)
    },

    async listByUser(quizId, userId) {
      const rows = await prisma.quizAttempt.findMany({
        where: { quizId, userId },
        orderBy: { createdAt: 'desc' },
      })
      return rows.map(toAttempt)
    },

    async upsertAnswer(attemptId, questionId, selectedOptionId) {
      const row = await prisma.quizAttemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: {
          attemptId,
          questionId,
          selectedOptionId: selectedOptionId ?? null,
        },
        update: {
          selectedOptionId: selectedOptionId ?? null,
        },
      })
      return toAnswer(row)
    },

    async completeAttempt(id, score, passed) {
      const row = await prisma.quizAttempt.update({
        where: { id },
        data: {
          score,
          passed,
          status: 'completed',
          completedAt: new Date(),
        },
      })
      return toAttempt(row)
    },

    async findAnswer(attemptId, questionId) {
      const row = await prisma.quizAttemptAnswer.findUnique({
        where: { attemptId_questionId: { attemptId, questionId } },
      })
      return row ? toAnswer(row) : null
    },
  }
}

function toAttempt(row: { id: string; quizId: string; tenantId: string; userId: string; score: number | null; passed: boolean | null; status: string; startedAt: Date; completedAt: Date | null; createdAt: Date; updatedAt: Date }): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quizId,
    tenantId: row.tenantId,
    userId: row.userId,
    score: row.score ?? undefined,
    passed: row.passed ?? undefined,
    status: row.status as QuizAttempt['status'],
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toAnswer(row: { id: string; attemptId: string; questionId: string; selectedOptionId: string | null; createdAt: Date }): QuizAttemptAnswer {
  return {
    id: row.id,
    attemptId: row.attemptId,
    questionId: row.questionId,
    selectedOptionId: row.selectedOptionId ?? undefined,
    createdAt: row.createdAt,
  }
}

function toAnswerDetail(row: any): any {
  return {
    id: row.id,
    attemptId: row.attemptId,
    questionId: row.questionId,
    selectedOptionId: row.selectedOptionId ?? undefined,
    createdAt: row.createdAt,
    question: row.question ? {
      id: row.question.id,
      quizId: row.question.quizId,
      text: row.question.text,
      type: row.question.type,
      order: row.question.order,
      createdAt: row.question.createdAt,
      updatedAt: row.question.updatedAt,
      options: (row.question.options ?? []).map((o: any) => ({
        id: o.id,
        questionId: o.questionId,
        text: o.text,
        isCorrect: o.isCorrect,
        order: o.order,
        createdAt: o.createdAt,
      })),
    } : undefined,
    selectedOption: row.selectedOption ? {
      id: row.selectedOption.id,
      questionId: row.selectedOption.questionId,
      text: row.selectedOption.text,
      isCorrect: row.selectedOption.isCorrect,
      order: row.selectedOption.order,
      createdAt: row.selectedOption.createdAt,
    } : null,
  }
}
