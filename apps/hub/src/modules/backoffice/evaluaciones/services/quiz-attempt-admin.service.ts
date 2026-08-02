import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned'

export interface AdminQuizAttempt {
  id: string
  quizId: string
  tenantId: string
  userId: string
  score: number | null
  passed: boolean | null
  status: AttemptStatus
  startedAt: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminQuizAttemptAnswer {
  id: string
  attemptId: string
  questionId: string
  selectedOptionId: string | null
  createdAt: string
}

export type AdminQuizAttemptDetail = AdminQuizAttempt & {
  answers?: AdminQuizAttemptAnswer[] | undefined
}

export interface QuizResultsResponse {
  attempts: AdminQuizAttempt[]
}

export interface ListResultsParams {
  quizId?: string | undefined
  tenantId?: string | undefined
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listResults(
  params?: ListResultsParams
): Promise<QuizResultsResponse> {
  const query = new URLSearchParams()
  if (params?.quizId !== undefined) query.set('quizId', params.quizId)
  if (params?.tenantId !== undefined) query.set('tenantId', params.tenantId)
  const qs = query.size > 0 ? `?${query.toString()}` : ''

  return apiFetchWithInterceptors<QuizResultsResponse>(
    `/admin/quiz-results${qs}`,
    { method: 'GET' }
  )
}

export async function getAttemptDetail(
  attemptId: string
): Promise<AdminQuizAttemptDetail> {
  return apiFetchWithInterceptors<AdminQuizAttemptDetail>(
    `/admin/quiz-results/${attemptId}`,
    { method: 'GET' }
  )
}
