import type { Logger } from 'pino'
import type { QuizAttemptRepository } from '../repositories/quiz-attempt/index.js'
import type { QuizRepository } from '../repositories/quiz/index.js'
import type { QuizAttempt, QuizAttemptAnswer, QuizAttemptWithAnswers } from '../domain/index.js'
import { NotFoundError, ConflictError, ValidationError } from '../errors.js'

export type QuizAttemptServiceDeps = {
  attemptRepository: QuizAttemptRepository
  quizRepository: QuizRepository
  logger: Logger
}

export type QuizAttemptService = {
  startAttempt(quizId: string, tenantId: string, userId: string): Promise<QuizAttempt>
  submitAnswer(attemptId: string, questionId: string, selectedOptionId?: string | undefined): Promise<QuizAttemptAnswer>
  completeAttempt(attemptId: string, userId: string): Promise<QuizAttempt>
  getAttempt(attemptId: string, userId: string): Promise<QuizAttemptWithAnswers>
  listAttempts(filter: { quizId: string; userId: string }): Promise<QuizAttempt[]>
  listAttemptsByTenant(tenantId: string, quizId?: string | undefined): Promise<QuizAttempt[]>
  listAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]>
}

export function createQuizAttemptService(deps: QuizAttemptServiceDeps): QuizAttemptService {
  const { attemptRepository, quizRepository, logger } = deps
  const log = logger.child({ component: 'quiz-attempt-service' })

  return {
    async startAttempt(quizId, tenantId, userId) {
      const quiz = await quizRepository.findById(quizId)
      if (!quiz) throw new NotFoundError('quizzes.not_found', `Quiz '${quizId}' not found`)

      if (!quiz.active) {
        throw new ValidationError('quizzes.inactive', 'Quiz is not active')
      }

      // Check for existing in_progress attempt
      const existing = await attemptRepository.findActiveByUser(quizId, userId)
      if (existing) {
        throw new ConflictError('attempts.already_in_progress', 'You already have an in-progress attempt for this quiz')
      }

      log.info({ quizId, tenantId, userId }, 'starting quiz attempt')
      return attemptRepository.create({ quizId, tenantId, userId })
    },

    async submitAnswer(attemptId, questionId, selectedOptionId) {
      const attempt = await attemptRepository.findById(attemptId)
      if (!attempt) throw new NotFoundError('attempts.not_found', `Attempt '${attemptId}' not found`)

      if (attempt.status !== 'in_progress') {
        throw new ConflictError('attempts.already_submitted', 'Attempt is not in progress')
      }

      // Validate the question belongs to the attempt's quiz
      const question = await quizRepository.findQuestionById(questionId)
      if (!question) throw new NotFoundError('questions.not_found', `Question '${questionId}' not found`)
      if (question.quizId !== attempt.quizId) {
        throw new ValidationError('questions.wrong_quiz', 'Question does not belong to this quiz')
      }

      log.info({ attemptId, questionId }, 'submitting answer')
      return attemptRepository.upsertAnswer(attemptId, questionId, selectedOptionId ?? null)
    },

    async completeAttempt(attemptId, userId) {
      const attempt = await attemptRepository.findById(attemptId)
      if (!attempt) throw new NotFoundError('attempts.not_found', `Attempt '${attemptId}' not found`)

      if (attempt.userId !== userId) {
        throw new NotFoundError('attempts.not_found', `Attempt '${attemptId}' not found`)
      }

      if (attempt.status !== 'in_progress') {
        throw new ConflictError('attempts.already_submitted', 'Attempt is not in progress')
      }

      // Get quiz with questions and options
      const quiz = await quizRepository.findByIdWithQuestions(attempt.quizId)
      if (!quiz) throw new NotFoundError('quizzes.not_found', `Quiz '${attempt.quizId}' not found`)

      const totalQuestions = quiz.questions.length
      if (totalQuestions === 0) {
        throw new ValidationError('quizzes.no_questions', 'Quiz has no questions')
      }

      // Get all answers
      const answersMap = new Map<string, string | undefined>()
      for (const question of quiz.questions) {
        const answer = await attemptRepository.findAnswer(attemptId, question.id)
        if (answer) {
          answersMap.set(question.id, answer.selectedOptionId ?? undefined)
        }
      }

      // Calculate score
      let correctCount = 0
      for (const question of quiz.questions) {
        const correctOption = question.options.find((o) => o.isCorrect)
        const selectedOptionId = answersMap.get(question.id)

        if (correctOption && selectedOptionId === correctOption.id) {
          correctCount++
        }
      }

      const score = Math.round((correctCount / totalQuestions) * 100)
      const passed = score >= quiz.passingScore

      log.info({ attemptId, score, passed, correctCount, totalQuestions }, 'completing attempt')
      return attemptRepository.completeAttempt(attemptId, score, passed)
    },

    async getAttempt(attemptId, userId) {
      const attempt = await attemptRepository.findByIdWithAnswers(attemptId)
      if (!attempt) throw new NotFoundError('attempts.not_found', `Attempt '${attemptId}' not found`)

      if (attempt.userId !== userId) {
        throw new NotFoundError('attempts.not_found', `Attempt '${attemptId}' not found`)
      }

      return attempt
    },

    async listAttempts(filter) {
      return attemptRepository.listByUser(filter.quizId, filter.userId)
    },

    async listAttemptsByTenant(tenantId, quizId) {
      return attemptRepository.listByTenant(tenantId, quizId)
    },

    async listAttemptsByQuiz(quizId) {
      return attemptRepository.listByQuiz(quizId)
    },
  }
}
