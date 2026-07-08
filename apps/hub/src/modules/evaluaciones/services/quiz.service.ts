import type {
  AttemptWithAnswers,
  QuizAttempt,
  QuizListItem,
  StartAttemptResponse,
} from '../types/quiz.types'

import { apiFetchWithInterceptors } from '@/lib/api/interceptors'


// ─── Service functions ──────────────────────────────────────────────────────────

export async function listAvailableQuizzes(): Promise<{ quizzes: QuizListItem[] }> {
  return apiFetchWithInterceptors<{ quizzes: QuizListItem[] }>(
    '/tenants/current/quizzes',
    { method: 'GET' },
  )
}

export async function getQuizDetail(
  quizId: string,
): Promise<QuizListItem> {
  return apiFetchWithInterceptors<QuizListItem>(
    `/tenants/current/quizzes/${quizId}`,
    { method: 'GET' },
  )
}

export async function startAttempt(
  quizId: string,
): Promise<StartAttemptResponse> {
  return apiFetchWithInterceptors<StartAttemptResponse>(
    `/tenants/current/quizzes/${quizId}/attempts`,
    { method: 'POST' },
  )
}

export async function submitAnswer(
  quizId: string,
  attemptId: string,
  questionId: string,
  selectedOptionId?: string | null,
): Promise<{ id: string; attemptId: string; questionId: string; selectedOptionId: string | null; createdAt: string }> {
  return apiFetchWithInterceptors<{
    id: string
    attemptId: string
    questionId: string
    selectedOptionId: string | null
    createdAt: string
  }>(
    `/tenants/current/quizzes/${quizId}/attempts/${attemptId}/answers`,
    {
      method: 'POST',
      body: { questionId, selectedOptionId: selectedOptionId ?? null },
    },
  )
}

export async function completeAttempt(
  quizId: string,
  attemptId: string,
): Promise<AttemptWithAnswers> {
  return apiFetchWithInterceptors<AttemptWithAnswers>(
    `/tenants/current/quizzes/${quizId}/attempts/${attemptId}/complete`,
    { method: 'POST' },
  )
}

export async function getAttempt(
  quizId: string,
  attemptId: string,
): Promise<AttemptWithAnswers> {
  return apiFetchWithInterceptors<AttemptWithAnswers>(
    `/tenants/current/quizzes/${quizId}/attempts/${attemptId}`,
    { method: 'GET' },
  )
}

export async function listAttempts(
  quizId: string,
): Promise<{ attempts: QuizAttempt[] }> {
  return apiFetchWithInterceptors<{ attempts: QuizAttempt[] }>(
    `/tenants/current/quizzes/${quizId}/attempts`,
    { method: 'GET' },
  )
}
