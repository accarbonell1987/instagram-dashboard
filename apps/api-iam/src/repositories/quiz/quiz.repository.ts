import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Quiz, Question, QuestionOption } from '../../domain/index.js'

export type QuizRepository = {
  findAll(filter?: { active?: boolean }): Promise<Quiz[]>
  findById(id: string): Promise<Quiz | null>
  findByIdWithQuestions(id: string): Promise<(Quiz & { questions: (Question & { options: QuestionOption[] })[] }) | null>
  create(data: CreateQuizData): Promise<Quiz>
  update(id: string, data: UpdateQuizData): Promise<Quiz>
  findQuestionById(id: string): Promise<Question | null>
  createQuestion(data: CreateQuestionData): Promise<Question>
  updateQuestion(id: string, data: UpdateQuestionData): Promise<Question>
  deleteQuestion(id: string): Promise<void>
  reorderQuestions(quizId: string, orderedIds: string[]): Promise<void>
  findOptionById(id: string): Promise<QuestionOption | null>
  createOption(data: CreateOptionData): Promise<QuestionOption>
  updateOption(id: string, data: UpdateOptionData): Promise<QuestionOption>
  deleteOption(id: string): Promise<void>
  countQuestionsByQuiz(quizId: string): Promise<number>
  countOptionsByQuestion(questionId: string): Promise<number>
  countCorrectOptionsByQuestion(questionId: string): Promise<number>
}

export type CreateQuizData = {
  title: string
  description?: string | undefined
  passingScore: number
  timeLimitMinutes?: number | undefined
  moduleId?: string | undefined
}

export type UpdateQuizData = {
  title?: string | undefined
  description?: string | undefined
  passingScore?: number | undefined
  timeLimitMinutes?: number | undefined
  active?: boolean | undefined
  moduleId?: string | null | undefined
}

export type CreateQuestionData = {
  quizId: string
  text: string
  type: 'multiple_choice' | 'true_false'
  order?: number | undefined
}

export type UpdateQuestionData = {
  text?: string | undefined
  type?: 'multiple_choice' | 'true_false' | undefined
  order?: number | undefined
}

export type CreateOptionData = {
  questionId: string
  text: string
  isCorrect: boolean
  order?: number | undefined
}

export type UpdateOptionData = {
  text?: string | undefined
  isCorrect?: boolean | undefined
  order?: number | undefined
}

export function createQuizRepository(prisma: PrismaClient): QuizRepository {
  return {
    async findAll(filter) {
      const where = filter?.active !== undefined ? { active: filter.active } : {}
      const rows = await prisma.quiz.findMany({ where, orderBy: { createdAt: 'desc' } })
      return rows.map(toQuiz)
    },

    async findById(id) {
      const row = await prisma.quiz.findUnique({ where: { id } })
      return row ? toQuiz(row) : null
    },

    async findByIdWithQuestions(id) {
      const row = await prisma.quiz.findUnique({
        where: { id },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: { orderBy: { order: 'asc' } },
            },
          },
        },
      })
      if (!row) return null

      return {
        ...toQuiz(row),
        questions: row.questions.map((q) => ({
          ...toQuestion(q),
          options: q.options.map(toOption),
        })),
      }
    },

    async create(data) {
      const row = await prisma.quiz.create({
        data: {
          title: data.title,
          description: data.description ?? null,
          passingScore: data.passingScore,
          timeLimitMinutes: data.timeLimitMinutes ?? null,
          moduleId: data.moduleId ?? null,
        },
      })
      return toQuiz(row)
    },

    async update(id, data) {
      const prismaData: Record<string, unknown> = {}
      if (data.title !== undefined) prismaData['title'] = data.title
      if (data.description !== undefined) prismaData['description'] = data.description
      if (data.passingScore !== undefined) prismaData['passingScore'] = data.passingScore
      if (data.timeLimitMinutes !== undefined) prismaData['timeLimitMinutes'] = data.timeLimitMinutes
      if (data.active !== undefined) prismaData['active'] = data.active
      if (data.moduleId !== undefined) prismaData['moduleId'] = data.moduleId

      const row = await prisma.quiz.update({ where: { id }, data: prismaData })
      return toQuiz(row)
    },

    async findQuestionById(id) {
      const row = await prisma.question.findUnique({ where: { id } })
      return row ? toQuestion(row) : null
    },

    async createQuestion(data) {
      const maxOrder = await prisma.question.aggregate({
        where: { quizId: data.quizId },
        _max: { order: true },
      })
      const order = data.order ?? (maxOrder._max.order ?? -1) + 1

      const row = await prisma.question.create({
        data: {
          quizId: data.quizId,
          text: data.text,
          type: data.type,
          order,
        },
      })
      return toQuestion(row)
    },

    async updateQuestion(id, data) {
      const prismaData: Record<string, unknown> = {}
      if (data.text !== undefined) prismaData['text'] = data.text
      if (data.type !== undefined) prismaData['type'] = data.type
      if (data.order !== undefined) prismaData['order'] = data.order

      const row = await prisma.question.update({ where: { id }, data: prismaData })
      return toQuestion(row)
    },

    async deleteQuestion(id) {
      await prisma.question.delete({ where: { id } })
    },

    async reorderQuestions(_quizId, orderedIds) {
      const updates = orderedIds.map((id, index) =>
        prisma.question.update({ where: { id }, data: { order: index } }),
      )
      await prisma.$transaction(updates)
    },

    async findOptionById(id) {
      const row = await prisma.questionOption.findUnique({ where: { id } })
      return row ? toOption(row) : null
    },

    async createOption(data) {
      const maxOrder = await prisma.questionOption.aggregate({
        where: { questionId: data.questionId },
        _max: { order: true },
      })
      const order = data.order ?? (maxOrder._max.order ?? -1) + 1

      const row = await prisma.questionOption.create({
        data: {
          questionId: data.questionId,
          text: data.text,
          isCorrect: data.isCorrect,
          order,
        },
      })
      return toOption(row)
    },

    async updateOption(id, data) {
      const prismaData: Record<string, unknown> = {}
      if (data.text !== undefined) prismaData['text'] = data.text
      if (data.isCorrect !== undefined) prismaData['isCorrect'] = data.isCorrect
      if (data.order !== undefined) prismaData['order'] = data.order

      const row = await prisma.questionOption.update({ where: { id }, data: prismaData })
      return toOption(row)
    },

    async deleteOption(id) {
      await prisma.questionOption.delete({ where: { id } })
    },

    async countQuestionsByQuiz(quizId) {
      return prisma.question.count({ where: { quizId } })
    },

    async countOptionsByQuestion(questionId) {
      return prisma.questionOption.count({ where: { questionId } })
    },

    async countCorrectOptionsByQuestion(questionId) {
      return prisma.questionOption.count({
        where: { questionId, isCorrect: true },
      })
    },
  }
}

function toQuiz(row: { id: string; moduleId: string | null; title: string; description: string | null; passingScore: number; timeLimitMinutes: number | null; active: boolean; createdAt: Date; updatedAt: Date }): Quiz {
  return {
    id: row.id,
    moduleId: row.moduleId ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    passingScore: row.passingScore,
    timeLimitMinutes: row.timeLimitMinutes ?? undefined,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toQuestion(row: { id: string; quizId: string; text: string; type: string; order: number; createdAt: Date; updatedAt: Date }): Question {
  return {
    id: row.id,
    quizId: row.quizId,
    text: row.text,
    type: row.type as Question['type'],
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toOption(row: { id: string; questionId: string; text: string; isCorrect: boolean; order: number; createdAt: Date }): QuestionOption {
  return {
    id: row.id,
    questionId: row.questionId,
    text: row.text,
    isCorrect: row.isCorrect,
    order: row.order,
    createdAt: row.createdAt,
  }
}
