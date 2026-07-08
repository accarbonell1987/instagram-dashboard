import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useQuizTaker } from './use-quiz-taker'
import type { Question } from '../types/quiz.types'

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    quizId: 'quiz-1',
    text: 'What is 2+2?',
    type: 'multiple_choice',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    options: [
      { id: 'opt-1', questionId: 'q-1', text: '4', isCorrect: true, order: 0, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'opt-2', questionId: 'q-1', text: '5', isCorrect: false, order: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    ...overrides,
  }
}

function makeQuestions(count: number): Question[] {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion({
      id: `q-${i + 1}`,
      text: `Question ${i + 1}`,
      order: i,
      options: [
        { id: `q${i + 1}-opt-1`, questionId: `q-${i + 1}`, text: 'Correct', isCorrect: true, order: 0, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: `q${i + 1}-opt-2`, questionId: `q-${i + 1}`, text: 'Wrong', isCorrect: false, order: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    }),
  )
}

describe('useQuizTaker', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      expect(result.current.state).toBe('idle')
    })

    it('shows first question as current', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      expect(result.current.currentQuestion?.id).toBe('q-1')
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.totalQuestions).toBe(3)
    })

    it('returns null currentQuestion for empty questions array', () => {
      const { result } = renderHook(() => useQuizTaker([]))

      expect(result.current.currentQuestion).toBeNull()
      expect(result.current.totalQuestions).toBe(0)
    })

    it('starts with empty answers', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      expect(result.current.answers).toEqual({})
    })
  })

  describe('navigation', () => {
    it('goes to next question', () => {
      const questions = makeQuestions(5)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.next()
      })

      expect(result.current.currentIndex).toBe(1)
      expect(result.current.currentQuestion?.id).toBe('q-2')
    })

    it('goes to previous question', () => {
      const questions = makeQuestions(5)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.next()
      })
      expect(result.current.currentIndex).toBe(1)

      act(() => {
        result.current.actions.prev()
      })
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.currentQuestion?.id).toBe('q-1')
    })

    it('does not go past the last question', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      // Advance to question 3
      act(() => { result.current.actions.next() })
      act(() => { result.current.actions.next() })
      expect(result.current.currentIndex).toBe(2)

      // Try to go past
      act(() => { result.current.actions.next() })
      expect(result.current.currentIndex).toBe(2)

      // Try to go past again
      act(() => { result.current.actions.next() })
      expect(result.current.currentIndex).toBe(2)
    })

    it('does not go before the first question', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      expect(result.current.currentIndex).toBe(0)

      act(() => { result.current.actions.prev() })
      expect(result.current.currentIndex).toBe(0)
    })

    it('goToQuestion navigates to a specific index', () => {
      const questions = makeQuestions(5)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.goToQuestion(3)
      })

      expect(result.current.currentIndex).toBe(3)
      expect(result.current.currentQuestion?.id).toBe('q-4')
    })

    it('goToQuestion ignores out-of-bounds index', () => {
      const questions = makeQuestions(5)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.goToQuestion(10)
      })
      expect(result.current.currentIndex).toBe(0)

      act(() => {
        result.current.actions.goToQuestion(-1)
      })
      expect(result.current.currentIndex).toBe(0)
    })
  })

  describe('answers', () => {
    it('saves answers per question', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.selectAnswer('q-1', 'q1-opt-1')
      })

      expect(result.current.answers['q-1']).toBe('q1-opt-1')
    })

    it('updates an existing answer', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.selectAnswer('q-1', 'q1-opt-1')
      })
      expect(result.current.answers['q-1']).toBe('q1-opt-1')

      act(() => {
        result.current.actions.selectAnswer('q-1', 'q1-opt-2')
      })
      expect(result.current.answers['q-1']).toBe('q1-opt-2')
    })

    it('clears an answer when selecting undefined', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.selectAnswer('q-1', 'q1-opt-1')
      })
      expect(result.current.answers['q-1']).toBe('q1-opt-1')

      act(() => {
        result.current.actions.selectAnswer('q-1', undefined)
      })
      expect(result.current.answers['q-1']).toBeUndefined()
    })

    it('accumulates answers across multiple questions', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.selectAnswer('q-1', 'q1-opt-1')
      })

      act(() => {
        result.current.actions.next()
      })

      act(() => {
        result.current.actions.selectAnswer('q-2', 'q2-opt-1')
      })

      expect(result.current.answers).toEqual({
        'q-1': 'q1-opt-1',
        'q-2': 'q2-opt-1',
      })
    })

    it('preserves answers during navigation', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      act(() => {
        result.current.actions.selectAnswer('q-1', 'q1-opt-1')
      })
      act(() => {
        result.current.actions.next()
      })
      act(() => {
        result.current.actions.selectAnswer('q-2', 'q2-opt-1')
      })
      act(() => {
        result.current.actions.prev()
      })

      // Back at q-1, answer should be preserved
      expect(result.current.answers['q-1']).toBe('q1-opt-1')
      expect(result.current.answers['q-2']).toBe('q2-opt-1')
    })
  })

  describe('finalize', () => {
    it('transitions to submitted state', () => {
      const questions = makeQuestions(3)
      const { result } = renderHook(() => useQuizTaker(questions))

      expect(result.current.state).toBe('idle')

      act(() => {
        result.current.actions.finalize()
      })

      expect(result.current.state).toBe('submitted')
    })
  })
})
