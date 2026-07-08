import { describe, it, expect, vi } from 'vitest'

import { createQuizAttemptService } from './quiz-attempt.service.js'
import { NotFoundError, ConflictError, ValidationError } from '../errors.js'
import type { QuizAttemptServiceDeps } from './quiz-attempt.service.js'
import type {
  Quiz,
  QuizAttempt,
  QuizAttemptAnswer,
  QuizWithQuestions,
  Question,
  QuestionOption,
} from '../domain/index.js'
import { silentLogger } from '../test-helpers/logger.js'

// ── Factory helpers ────────────────────────────────────────────────────────────

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    moduleId: undefined,
    title: 'Test Quiz',
    description: 'A test quiz',
    passingScore: 60,
    timeLimitMinutes: 10,
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    quizId: 'quiz-1',
    text: 'What is 2+2?',
    type: 'multiple_choice',
    order: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeOption(overrides: Partial<QuestionOption> = {}): QuestionOption {
  return {
    id: 'opt-1',
    questionId: 'q-1',
    text: '4',
    isCorrect: true,
    order: 0,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: 'attempt-1',
    quizId: 'quiz-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    score: undefined,
    passed: undefined,
    status: 'in_progress',
    startedAt: new Date('2026-01-01'),
    completedAt: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeAnswer(overrides: Partial<QuizAttemptAnswer> = {}): QuizAttemptAnswer {
  return {
    id: 'answer-1',
    attemptId: 'attempt-1',
    questionId: 'q-1',
    selectedOptionId: 'opt-1',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

/**
 * Creates a quiz with questions that have options.
 * By default creates 5 questions, each with 4 options,
 * and the first option is correct for all.
 */
function makeQuizWithQuestions(
  quizOverrides: Partial<Quiz> = {},
  questionCount = 5,
): QuizWithQuestions {
  const questions = Array.from({ length: questionCount }, (_, i) => ({
    ...makeQuestion({
      id: `q-${i + 1}`,
      quizId: quizOverrides.id ?? 'quiz-1',
      text: `Question ${i + 1}`,
      order: i,
    }),
    options: [
      makeOption({ id: `q${i + 1}-opt-1`, questionId: `q-${i + 1}`, text: `Correct ${i + 1}`, isCorrect: true, order: 0 }),
      makeOption({ id: `q${i + 1}-opt-2`, questionId: `q-${i + 1}`, text: `Wrong ${i + 1}a`, isCorrect: false, order: 1 }),
      makeOption({ id: `q${i + 1}-opt-3`, questionId: `q-${i + 1}`, text: `Wrong ${i + 1}b`, isCorrect: false, order: 2 }),
      makeOption({ id: `q${i + 1}-opt-4`, questionId: `q-${i + 1}`, text: `Wrong ${i + 1}c`, isCorrect: false, order: 3 }),
    ],
  }))

  return {
    ...makeQuiz(quizOverrides),
    questions,
  }
}

type MockRepos = {
  quizRepo: NonNullable<QuizAttemptServiceDeps['quizRepository']>
  attemptRepo: NonNullable<QuizAttemptServiceDeps['attemptRepository']>
}

function makeMockRepos(): MockRepos {
  return {
    quizRepo: {
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeQuiz()),
      findByIdWithQuestions: vi.fn().mockResolvedValue(makeQuizWithQuestions()),
      create: vi.fn(),
      update: vi.fn(),
      findQuestionById: vi.fn().mockResolvedValue(makeQuestion()),
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      reorderQuestions: vi.fn(),
      findOptionById: vi.fn(),
      createOption: vi.fn(),
      updateOption: vi.fn(),
      deleteOption: vi.fn(),
      countQuestionsByQuiz: vi.fn(),
      countOptionsByQuestion: vi.fn(),
      countCorrectOptionsByQuestion: vi.fn(),
    },
    attemptRepo: {
      create: vi.fn().mockResolvedValue(makeAttempt()),
      findById: vi.fn().mockResolvedValue(makeAttempt()),
      findByIdWithAnswers: vi.fn(),
      findActiveByUser: vi.fn().mockResolvedValue(null),
      listByTenant: vi.fn(),
      listByQuiz: vi.fn(),
      listByUser: vi.fn(),
      upsertAnswer: vi.fn().mockResolvedValue(makeAnswer()),
      completeAttempt: vi.fn().mockImplementation((_id: string, score: number, passed: boolean) =>
        Promise.resolve(makeAttempt({ status: 'completed', score, passed, completedAt: new Date() })),
      ),
      findAnswer: vi.fn(),
    },
  }
}

function makeDeps(mocks?: MockRepos): QuizAttemptServiceDeps {
  const repos = mocks ?? makeMockRepos()
  return {
    quizRepository: repos.quizRepo as any,
    attemptRepository: repos.attemptRepo as any,
    logger: silentLogger,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuizAttemptService', () => {
  // ── startAttempt ────────────────────────────────────────────────────────────

  describe('startAttempt', () => {
    it('creates an in_progress attempt', async () => {
      const mocks = makeMockRepos()
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      const attempt = await service.startAttempt('quiz-1', 'tenant-1', 'user-1')

      expect(attempt.id).toBe('attempt-1')
      expect(attempt.status).toBe('in_progress')
      expect(mocks.quizRepo.findById).toHaveBeenCalledWith('quiz-1')
      expect(mocks.attemptRepo.create).toHaveBeenCalledWith({
        quizId: 'quiz-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      })
    })

    it('throws NotFoundError when quiz does not exist', async () => {
      const mocks = makeMockRepos()
      mocks.quizRepo.findById = vi.fn().mockResolvedValue(null)
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.startAttempt('nonexistent', 'tenant-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ValidationError when quiz is inactive', async () => {
      const mocks = makeMockRepos()
      mocks.quizRepo.findById = vi.fn().mockResolvedValue(makeQuiz({ active: false }))
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.startAttempt('quiz-1', 'tenant-1', 'user-1'),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ConflictError when user already has an in_progress attempt', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findActiveByUser = vi.fn().mockResolvedValue(makeAttempt())
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.startAttempt('quiz-1', 'tenant-1', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  // ── completeAttempt — scoring ────────────────────────────────────────────────

  describe('completeAttempt', () => {
    it('calculates score correctly: 3/5 correct = 60%', async () => {
      const mocks = makeMockRepos()
      const quiz = makeQuizWithQuestions({ id: 'quiz-1', passingScore: 50 }, 5)
      mocks.quizRepo.findByIdWithQuestions = vi.fn().mockResolvedValue(quiz)

      // 3 correct answers (q-1, q-2, q-3) using the correct option IDs
      // 2 wrong answers (q-4, q-5) using wrong option IDs
      // Option IDs match makeQuizWithQuestions pattern: q{num}-opt-{n}
      mocks.attemptRepo.findAnswer = vi.fn().mockImplementation((_attemptId: string, questionId: string) => {
        const qNum = Number(questionId.split('-')[1]) // q-3 → 3
        if (qNum <= 3) {
          // Correct: select the correct option (q{num}-opt-1)
          return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-1` }))
        }
        // Wrong: select a wrong option (q{num}-opt-3)
        return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-3` }))
      })

      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      const result = await service.completeAttempt('attempt-1', 'user-1')

      expect(result.score).toBe(60)
      expect(result.passed).toBe(true)
      expect(mocks.attemptRepo.completeAttempt).toHaveBeenCalledWith('attempt-1', 60, true)
    })

    it('marks passed when score >= passingScore', async () => {
      const mocks = makeMockRepos()
      const quiz = makeQuizWithQuestions({ id: 'quiz-1', passingScore: 80 }, 5)
      mocks.quizRepo.findByIdWithQuestions = vi.fn().mockResolvedValue(quiz)

      // 4/5 correct = 80%
      mocks.attemptRepo.findAnswer = vi.fn().mockImplementation((_attemptId: string, questionId: string) => {
        const qNum = Number(questionId.split('-')[1])
        if (qNum <= 4) {
          return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-1` }))
        }
        return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-3` }))
      })

      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      const result = await service.completeAttempt('attempt-1', 'user-1')

      expect(result.score).toBe(80)
      expect(result.passed).toBe(true)
    })

    it('marks failed when score < passingScore', async () => {
      const mocks = makeMockRepos()
      const quiz = makeQuizWithQuestions({ id: 'quiz-1', passingScore: 80 }, 5)
      mocks.quizRepo.findByIdWithQuestions = vi.fn().mockResolvedValue(quiz)

      // Only 2/5 correct = 40%
      mocks.attemptRepo.findAnswer = vi.fn().mockImplementation((_attemptId: string, questionId: string) => {
        const qNum = Number(questionId.split('-')[1])
        if (qNum <= 2) {
          return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-1` }))
        }
        return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-3` }))
      })

      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      const result = await service.completeAttempt('attempt-1', 'user-1')

      expect(result.score).toBe(40)
      expect(result.passed).toBe(false)
    })

    it('rounds the score to nearest integer', async () => {
      const mocks = makeMockRepos()
      // 3 questions total: 1 correct = 33.33% → rounded to 33
      const quiz = makeQuizWithQuestions({ id: 'quiz-1', passingScore: 30 }, 3)
      mocks.quizRepo.findByIdWithQuestions = vi.fn().mockResolvedValue(quiz)

      mocks.attemptRepo.findAnswer = vi.fn().mockImplementation((_attemptId: string, questionId: string) => {
        const qNum = Number(questionId.split('-')[1])
        if (qNum === 1) {
          return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-1` }))
        }
        return Promise.resolve(makeAnswer({ questionId, selectedOptionId: `q${qNum}-opt-3` }))
      })

      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      const result = await service.completeAttempt('attempt-1', 'user-1')

      expect(result.score).toBe(33)
    })

    // ── Validation ──────────────────────────────────────────────────────────

    it('throws NotFoundError when attempt does not exist', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findById = vi.fn().mockResolvedValue(null)
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.completeAttempt('nonexistent', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when userId does not match attempt owner', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findById = vi.fn().mockResolvedValue(makeAttempt({ userId: 'other-user' }))
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.completeAttempt('attempt-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ConflictError when attempt is already completed', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findById = vi.fn().mockResolvedValue(makeAttempt({ status: 'completed', score: 80, passed: true }))
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.completeAttempt('attempt-1', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  // ── getAttempt ──────────────────────────────────────────────────────────────

  describe('getAttempt', () => {
    it('throws NotFoundError when attempt does not exist', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findByIdWithAnswers = vi.fn().mockResolvedValue(null)
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.getAttempt('nonexistent', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when userId does not match', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findByIdWithAnswers = vi.fn().mockResolvedValue({
        ...makeAttempt({ userId: 'other-user' }),
        answers: [],
      })
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.getAttempt('attempt-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── submitAnswer ────────────────────────────────────────────────────────────

  describe('submitAnswer', () => {
    it('throws NotFoundError when attempt does not exist', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findById = vi.fn().mockResolvedValue(null)
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await expect(
        service.submitAnswer('nonexistent', 'q-1', 'opt-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('saves an answer with selectedOptionId', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findById = vi.fn().mockResolvedValue(makeAttempt())
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      const answer = await service.submitAnswer('attempt-1', 'q-1', 'opt-1')

      expect(answer.questionId).toBe('q-1')
      expect(answer.selectedOptionId).toBe('opt-1')
      expect(mocks.attemptRepo.upsertAnswer).toHaveBeenCalledWith('attempt-1', 'q-1', 'opt-1')
    })

    it('saves an answer without selectedOptionId (unanswer)', async () => {
      const mocks = makeMockRepos()
      mocks.attemptRepo.findById = vi.fn().mockResolvedValue(makeAttempt())
      const deps = makeDeps(mocks)
      const service = createQuizAttemptService(deps)

      await service.submitAnswer('attempt-1', 'q-1', undefined)

      expect(mocks.attemptRepo.upsertAnswer).toHaveBeenCalledWith('attempt-1', 'q-1', null)
    })
  })
})
