import type { Logger } from 'pino'
import type { QuizRepository, CreateQuizData, UpdateQuizData, CreateQuestionData, UpdateQuestionData, CreateOptionData, UpdateOptionData } from '../repositories/quiz/index.js'
import type { Quiz, QuizWithQuestions, Question, QuestionOption } from '../domain/index.js'
import { NotFoundError, ValidationError } from '../errors.js'

export type QuizServiceDeps = {
  quizRepository: QuizRepository
  logger: Logger
}

export type CreateQuizInput = {
  title: string
  description?: string | undefined
  passingScore: number
  timeLimitMinutes?: number | undefined
  moduleId?: string | undefined
}

export type UpdateQuizInput = {
  title?: string | undefined
  description?: string | undefined
  passingScore?: number | undefined
  timeLimitMinutes?: number | undefined
  active?: boolean | undefined
  moduleId?: string | null | undefined
}

export type QuizService = {
  listQuizzes(filter?: { active?: boolean }): Promise<Quiz[]>
  getQuiz(id: string): Promise<Quiz>
  getQuizWithQuestions(id: string): Promise<QuizWithQuestions>
  createQuiz(data: CreateQuizInput): Promise<Quiz>
  updateQuiz(id: string, data: UpdateQuizInput): Promise<Quiz>
  archiveQuiz(id: string): Promise<Quiz>
  addQuestion(quizId: string, data: { text: string; type: 'multiple_choice' | 'true_false' }): Promise<Question>
  updateQuestion(id: string, data: { text?: string | undefined; type?: 'multiple_choice' | 'true_false' | undefined }): Promise<Question>
  removeQuestion(id: string): Promise<void>
  reorderQuestions(quizId: string, orderedIds: string[]): Promise<void>
  addOption(questionId: string, data: { text: string; isCorrect: boolean }): Promise<QuestionOption>
  updateOption(id: string, data: { text?: string | undefined; isCorrect?: boolean | undefined }): Promise<QuestionOption>
  removeOption(id: string): Promise<void>
}

export function createQuizService(deps: QuizServiceDeps): QuizService {
  const { quizRepository, logger } = deps
  const log = logger.child({ component: 'quiz-service' })

  return {
    async listQuizzes(filter) {
      return quizRepository.findAll(filter)
    },

    async getQuiz(id) {
      const quiz = await quizRepository.findById(id)
      if (!quiz) throw new NotFoundError('quizzes.not_found', `Quiz '${id}' not found`)
      return quiz
    },

    async getQuizWithQuestions(id) {
      const quiz = await quizRepository.findByIdWithQuestions(id)
      if (!quiz) throw new NotFoundError('quizzes.not_found', `Quiz '${id}' not found`)
      return quiz
    },

    async createQuiz(data) {
      log.info({ title: data.title }, 'creating quiz')
      return quizRepository.create({
        title: data.title,
        description: data.description,
        passingScore: data.passingScore,
        timeLimitMinutes: data.timeLimitMinutes,
        moduleId: data.moduleId,
      })
    },

    async updateQuiz(id, data) {
      const existing = await quizRepository.findById(id)
      if (!existing) throw new NotFoundError('quizzes.not_found', `Quiz '${id}' not found`)
      log.info({ id }, 'updating quiz')
      return quizRepository.update(id, data)
    },

    async archiveQuiz(id) {
      const existing = await quizRepository.findById(id)
      if (!existing) throw new NotFoundError('quizzes.not_found', `Quiz '${id}' not found`)
      log.info({ id }, 'archiving quiz')
      return quizRepository.update(id, { active: false })
    },

    async addQuestion(quizId, data) {
      const quiz = await quizRepository.findById(quizId)
      if (!quiz) throw new NotFoundError('quizzes.not_found', `Quiz '${quizId}' not found`)

      log.info({ quizId }, 'adding question')
      const question = await quizRepository.createQuestion({
        quizId,
        text: data.text,
        type: data.type,
      })

      // Auto-create options for true/false
      if (data.type === 'true_false') {
        const count = await quizRepository.countOptionsByQuestion(question.id)
        if (count === 0) {
          await quizRepository.createOption({ questionId: question.id, text: 'Verdadero', isCorrect: false, order: 0 })
          await quizRepository.createOption({ questionId: question.id, text: 'Falso', isCorrect: false, order: 1 })
        }
      }

      return question
    },

    async updateQuestion(id, data) {
      const existing = await quizRepository.findQuestionById(id)
      if (!existing) throw new NotFoundError('questions.not_found', `Question '${id}' not found`)
      log.info({ id }, 'updating question')
      return quizRepository.updateQuestion(id, data)
    },

    async removeQuestion(id) {
      const existing = await quizRepository.findQuestionById(id)
      if (!existing) throw new NotFoundError('questions.not_found', `Question '${id}' not found`)
      log.info({ id }, 'removing question')
      await quizRepository.deleteQuestion(id)
    },

    async reorderQuestions(quizId, orderedIds) {
      const quiz = await quizRepository.findById(quizId)
      if (!quiz) throw new NotFoundError('quizzes.not_found', `Quiz '${quizId}' not found`)
      log.info({ quizId, count: orderedIds.length }, 'reordering questions')
      await quizRepository.reorderQuestions(quizId, orderedIds)
    },

    async addOption(questionId, data) {
      const question = await quizRepository.findQuestionById(questionId)
      if (!question) throw new NotFoundError('questions.not_found', `Question '${questionId}' not found`)

      // If setting isCorrect to true, verify only one correct answer for single-choice
      if (data.isCorrect && question.type === 'true_false') {
        const correctCount = await quizRepository.countCorrectOptionsByQuestion(questionId)
        if (correctCount >= 1) {
          throw new ValidationError('questions.invalid_correct_answer', 'Only one correct option allowed for this question type')
        }
      }

      log.info({ questionId }, 'adding option')
      return quizRepository.createOption({
        questionId,
        text: data.text,
        isCorrect: data.isCorrect,
      })
    },

    async updateOption(id, data) {
      const existing = await quizRepository.findOptionById(id)
      if (!existing) throw new NotFoundError('questions.not_found', `Option '${id}' not found`)

      if (data.isCorrect === true) {
        const question = await quizRepository.findQuestionById(existing.questionId)
        if (question) {
          const correctCount = await quizRepository.countCorrectOptionsByQuestion(existing.questionId)
          // We need at most one correct answer for single choice types
          if (correctCount > 0 && !existing.isCorrect && question.type === 'true_false') {
            throw new ValidationError('questions.invalid_correct_answer', 'Only one correct option allowed for this question type')
          }
        }
      }

      log.info({ id }, 'updating option')
      return quizRepository.updateOption(id, data)
    },

    async removeOption(id) {
      const existing = await quizRepository.findOptionById(id)
      if (!existing) throw new NotFoundError('questions.not_found', `Option '${id}' not found`)
      log.info({ id }, 'removing option')
      await quizRepository.deleteOption(id)
    },
  }
}
