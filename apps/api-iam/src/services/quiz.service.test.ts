import { describe, it, expect, vi } from 'vitest'

import { createQuizService } from './quiz.service.js'
import { NotFoundError, ValidationError } from '../errors.js'
import type { QuizServiceDeps } from './quiz.service.js'
import type { Quiz, Question, QuestionOption, QuizWithQuestions } from '../domain/index.js'
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

function makeQuizWithQuestions(overrides: Partial<Quiz> = {}): QuizWithQuestions {
  return {
    ...makeQuiz(overrides),
    questions: [
      {
        ...makeQuestion(),
        options: [
          makeOption({ id: 'opt-1', text: '4', isCorrect: true }),
          makeOption({ id: 'opt-2', text: '5', isCorrect: false, order: 1 }),
        ],
      },
    ],
  }
}

function makeDeps(overrides: Partial<QuizServiceDeps> = {}): QuizServiceDeps {
  const defaults: QuizServiceDeps = {
    quizRepository: {
      findAll: vi.fn().mockResolvedValue([makeQuiz(), makeQuiz({ id: 'quiz-2', title: 'Second Quiz' })]),
      findById: vi.fn().mockResolvedValue(makeQuiz()),
      findByIdWithQuestions: vi.fn().mockResolvedValue(makeQuizWithQuestions()),
      create: vi.fn().mockResolvedValue(makeQuiz()),
      update: vi.fn().mockResolvedValue(makeQuiz({ title: 'Updated' })),
      findQuestionById: vi.fn().mockResolvedValue(makeQuestion()),
      createQuestion: vi.fn().mockResolvedValue(makeQuestion()),
      updateQuestion: vi.fn().mockResolvedValue(makeQuestion({ text: 'Updated Q' })),
      deleteQuestion: vi.fn().mockResolvedValue(undefined),
      reorderQuestions: vi.fn().mockResolvedValue(undefined),
      findOptionById: vi.fn().mockResolvedValue(makeOption()),
      createOption: vi.fn().mockResolvedValue(makeOption()),
      updateOption: vi.fn().mockResolvedValue(makeOption({ text: 'Updated Opt' })),
      deleteOption: vi.fn().mockResolvedValue(undefined),
      countQuestionsByQuiz: vi.fn().mockResolvedValue(2),
      countOptionsByQuestion: vi.fn().mockResolvedValue(0),
      countCorrectOptionsByQuestion: vi.fn().mockResolvedValue(1),
    },
    logger: silentLogger,
    ...overrides,
  }

  // Merge quizRepository individual mocks when partial override is provided
  if (overrides.quizRepository) {
    defaults.quizRepository = { ...defaults.quizRepository, ...overrides.quizRepository }
  }

  return defaults
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuizService', () => {
  // ── createQuiz ──────────────────────────────────────────────────────────────

  describe('createQuiz', () => {
    it('creates a quiz via repository', async () => {
      const deps = makeDeps()
      const service = createQuizService(deps)

      const quiz = await service.createQuiz({
        title: 'New Quiz',
        passingScore: 70,
        timeLimitMinutes: 15,
      })

      expect(quiz.id).toBe('quiz-1')
      expect(deps.quizRepository.create).toHaveBeenCalledWith({
        title: 'New Quiz',
        description: undefined,
        passingScore: 70,
        timeLimitMinutes: 15,
        moduleId: undefined,
      })
    })

    it('passes optional description and moduleId', async () => {
      const deps = makeDeps()
      const service = createQuizService(deps)

      await service.createQuiz({
        title: 'Linked Quiz',
        passingScore: 80,
        description: 'Has a module',
        moduleId: 'module-1',
      })

      expect(deps.quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Has a module',
          moduleId: 'module-1',
        }),
      )
    })
  })

  // ── getQuizWithQuestions ────────────────────────────────────────────────────

  describe('getQuizWithQuestions', () => {
    it('returns quiz + questions + options', async () => {
      const deps = makeDeps()
      const service = createQuizService(deps)

      const result = await service.getQuizWithQuestions('quiz-1')

      expect(result.questions).toHaveLength(1)
      expect(result.questions[0]!.options).toHaveLength(2)
      expect(result.questions[0]!.options[0]!.text).toBe('4')
      expect(deps.quizRepository.findByIdWithQuestions).toHaveBeenCalledWith('quiz-1')
    })

    it('throws NotFoundError when quiz not found', async () => {
      const deps = makeDeps({
        quizRepository: { findByIdWithQuestions: vi.fn().mockResolvedValue(null) } as any,
      })
      const service = createQuizService(deps)

      await expect(service.getQuizWithQuestions('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── getQuiz ─────────────────────────────────────────────────────────────────

  describe('getQuiz', () => {
    it('returns quiz by id', async () => {
      const deps = makeDeps()
      const service = createQuizService(deps)

      const quiz = await service.getQuiz('quiz-1')

      expect(quiz.id).toBe('quiz-1')
      expect(deps.quizRepository.findById).toHaveBeenCalledWith('quiz-1')
    })

    it('throws NotFoundError when quiz not found', async () => {
      const deps = makeDeps({
        quizRepository: { findById: vi.fn().mockResolvedValue(null) } as any,
      })
      const service = createQuizService(deps)

      await expect(service.getQuiz('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── addQuestion ─────────────────────────────────────────────────────────────

  describe('addQuestion', () => {
    it('adds a multiple_choice question', async () => {
      const mocks = {
        findById: vi.fn().mockResolvedValue(makeQuiz()),
        createQuestion: vi.fn().mockResolvedValue(makeQuestion({ type: 'multiple_choice' })),
        createOption: vi.fn(),
        countOptionsByQuestion: vi.fn(),
      }
      const deps = makeDeps({ quizRepository: mocks as any })
      const service = createQuizService(deps)

      const question = await service.addQuestion('quiz-1', {
        text: 'Pick one',
        type: 'multiple_choice',
      })

      expect(question.type).toBe('multiple_choice')
      expect(mocks.createQuestion).toHaveBeenCalledWith({
        quizId: 'quiz-1',
        text: 'Pick one',
        type: 'multiple_choice',
      })
      // Should NOT auto-create options for multiple_choice
      expect(mocks.createOption).not.toHaveBeenCalled()
    })

    it('adds a true_false question and auto-creates Verdadero/Falso options', async () => {
      const createOptionMock = vi.fn().mockResolvedValue(makeOption())
      const mocks = {
        findById: vi.fn().mockResolvedValue(makeQuiz()),
        createQuestion: vi.fn().mockResolvedValue(makeQuestion({ id: 'q-tf', type: 'true_false' })),
        createOption: createOptionMock,
        countOptionsByQuestion: vi.fn().mockResolvedValue(0),
      }
      const deps = makeDeps({ quizRepository: mocks as any })
      const service = createQuizService(deps)

      const question = await service.addQuestion('quiz-1', {
        text: 'Is the earth round?',
        type: 'true_false',
      })

      expect(question.type).toBe('true_false')
      expect(mocks.createQuestion).toHaveBeenCalledWith({
        quizId: 'quiz-1',
        text: 'Is the earth round?',
        type: 'true_false',
      })
      // Should auto-create Verdadero and Falso
      expect(createOptionMock).toHaveBeenCalledTimes(2)
      expect(createOptionMock).toHaveBeenCalledWith({
        questionId: 'q-tf',
        text: 'Verdadero',
        isCorrect: false,
        order: 0,
      })
      expect(createOptionMock).toHaveBeenCalledWith({
        questionId: 'q-tf',
        text: 'Falso',
        isCorrect: false,
        order: 1,
      })
    })

    it('does not create duplicate options when true_false question already has options', async () => {
      const createOptionMock = vi.fn()
      const mocks = {
        findById: vi.fn().mockResolvedValue(makeQuiz()),
        createQuestion: vi.fn().mockResolvedValue(makeQuestion({ id: 'q-tf', type: 'true_false' })),
        createOption: createOptionMock,
        countOptionsByQuestion: vi.fn().mockResolvedValue(2),
      }
      const deps = makeDeps({ quizRepository: mocks as any })
      const service = createQuizService(deps)

      await service.addQuestion('quiz-1', { text: 'Test', type: 'true_false' })

      // Should NOT create options because there are already 2
      expect(createOptionMock).not.toHaveBeenCalled()
    })

    // ── Validation ──────────────────────────────────────────────────────────

    it('throws NotFoundError when quiz does not exist', async () => {
      const mocks = {
        findById: vi.fn().mockResolvedValue(null),
        createQuestion: vi.fn(),
        createOption: vi.fn(),
        countOptionsByQuestion: vi.fn(),
      }
      const deps = makeDeps({ quizRepository: mocks as any })
      const service = createQuizService(deps)

      await expect(
        service.addQuestion('nonexistent', { text: 'Q', type: 'multiple_choice' }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── updateQuiz ──────────────────────────────────────────────────────────────

  describe('updateQuiz', () => {
    it('updates an existing quiz', async () => {
      const deps = makeDeps()
      const service = createQuizService(deps)

      const quiz = await service.updateQuiz('quiz-1', { title: 'New Title' })

      expect(quiz.title).toBe('Updated')
      expect(deps.quizRepository.update).toHaveBeenCalledWith('quiz-1', { title: 'New Title' })
    })

    it('throws NotFoundError for unknown quiz', async () => {
      const mocks = {
        findById: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      }
      const deps = makeDeps({ quizRepository: mocks as any })
      const service = createQuizService(deps)

      await expect(service.updateQuiz('nonexistent', { title: 'X' })).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── archiveQuiz ─────────────────────────────────────────────────────────────

  describe('archiveQuiz', () => {
    it('archives a quiz by setting active to false', async () => {
      const deps = makeDeps()
      const service = createQuizService(deps)

      await service.archiveQuiz('quiz-1')

      expect(deps.quizRepository.update).toHaveBeenCalledWith('quiz-1', { active: false })
    })

    it('throws NotFoundError for unknown quiz', async () => {
      const mocks = {
        findById: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      }
      const deps = makeDeps({ quizRepository: mocks as any })
      const service = createQuizService(deps)

      await expect(service.archiveQuiz('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
