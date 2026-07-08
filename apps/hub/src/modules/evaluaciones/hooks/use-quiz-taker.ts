'use client'

import { useCallback, useState } from 'react'

import type { Question } from '../types/quiz.types'

// ─── State types ───────────────────────────────────────────────────────────────

export type QuizTakerState = 'idle' | 'in-progress' | 'submitted'

export type AnswerMap = Record<string, string | undefined>;

export interface QuizTakerActions {
  goToQuestion: (index: number) => void
  selectAnswer: (questionId: string, optionId: string | undefined) => void
  next: () => void
  prev: () => void
  finalize: () => void
}

export interface QuizTakerResult {
  state: QuizTakerState
  currentIndex: number
  currentQuestion: Question | null
  totalQuestions: number
  answers: AnswerMap
  actions: QuizTakerActions
}

/**
 * State machine for quiz taking: idle → in-progress → submitted.
 * Manages current question, answer accumulation, and navigation.
 */
export function useQuizTaker(questions: Question[]): QuizTakerResult {
  const [takerState, setTakerState] = useState<QuizTakerState>('idle')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>({})

  const totalQuestions = questions.length
  const currentQuestion: Question | null =
    questions.length > 0 && currentIndex < questions.length
      ? (questions[currentIndex] ?? null)
      : null

  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index)
      }
    },
    [totalQuestions],
  )

  const selectAnswer = useCallback(
    (questionId: string, optionId: string | undefined) => {
      setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    },
    [],
  )

  const next = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1))
  }, [totalQuestions])

  const prev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const finalize = useCallback(() => {
    setTakerState('submitted')
  }, [])

  // Transition from idle to in-progress is triggered externally (after startAttempt)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const start = useCallback(() => {
    setTakerState('in-progress')
    setCurrentIndex(0)
    setAnswers({})
  }, [])

  return {
    state: takerState,
    currentIndex,
    currentQuestion,
    totalQuestions,
    answers,
    actions: {
      goToQuestion,
      selectAnswer,
      next,
      prev,
      finalize,
    },
  }
}
