import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false'

export type AdminQuestionOption = {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  order: number
  createdAt: string
}

export type AdminQuestion = {
  id: string
  quizId: string
  text: string
  type: QuestionType
  order: number
  createdAt: string
  updatedAt: string
  options?: AdminQuestionOption[] | undefined
}

export type AdminQuiz = {
  id: string
  moduleId: string | null
  title: string
  description: string | null
  passingScore: number
  timeLimitMinutes: number | null
  active: boolean
  createdAt: string
  updatedAt: string
  questions?: AdminQuestion[] | undefined
}

export type QuizListResponse = {
  quizzes: AdminQuiz[]
}

export type CreateQuizParams = {
  title: string
  description?: string | undefined
  passingScore: number
  timeLimitMinutes?: number | undefined
  moduleId?: string | undefined
}

export type UpdateQuizParams = {
  title?: string | undefined
  description?: string | undefined
  passingScore?: number | undefined
  timeLimitMinutes?: number | null | undefined
  active?: boolean | undefined
  moduleId?: string | null | undefined
}

export type CreateQuestionParams = {
  text: string
  type: QuestionType
}

export type UpdateQuestionParams = {
  text?: string | undefined
  type?: QuestionType | undefined
}

export type ReorderQuestionsParams = {
  orderedIds: string[]
}

export type CreateOptionParams = {
  text: string
  isCorrect?: boolean | undefined
}

export type UpdateOptionParams = {
  text?: string | undefined
  isCorrect?: boolean | undefined
}

// ─── Quiz CRUD ──────────────────────────────────────────────────────────────────

export async function listQuizzes(filter?: {
  active?: boolean
}): Promise<QuizListResponse> {
  const query = new URLSearchParams()
  if (filter?.active !== undefined) {
    query.set('active', String(filter.active))
  }
  const qs = query.size > 0 ? `?${query.toString()}` : ''

  return apiFetchWithInterceptors<QuizListResponse>(`/admin/quizzes${qs}`, {
    method: 'GET',
  })
}

export async function getQuiz(id: string): Promise<AdminQuiz> {
  return apiFetchWithInterceptors<AdminQuiz>(`/admin/quizzes/${id}`, {
    method: 'GET',
  })
}

export async function createQuiz(data: CreateQuizParams): Promise<AdminQuiz> {
  return apiFetchWithInterceptors<AdminQuiz>('/admin/quizzes', {
    method: 'POST',
    body: data,
  })
}

export async function updateQuiz(
  id: string,
  data: UpdateQuizParams
): Promise<AdminQuiz> {
  return apiFetchWithInterceptors<AdminQuiz>(`/admin/quizzes/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export async function archiveQuiz(id: string): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(`/admin/quizzes/${id}`, {
    method: 'DELETE',
  })
}

// ─── Question CRUD ──────────────────────────────────────────────────────────────

export async function addQuestion(
  quizId: string,
  data: CreateQuestionParams
): Promise<AdminQuestion> {
  return apiFetchWithInterceptors<AdminQuestion>(
    `/admin/quizzes/${quizId}/questions`,
    { method: 'POST', body: data }
  )
}

export async function updateQuestion(
  quizId: string,
  questionId: string,
  data: UpdateQuestionParams
): Promise<AdminQuestion> {
  return apiFetchWithInterceptors<AdminQuestion>(
    `/admin/quizzes/${quizId}/questions/${questionId}`,
    { method: 'PATCH', body: data }
  )
}

export async function removeQuestion(
  quizId: string,
  questionId: string
): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(
    `/admin/quizzes/${quizId}/questions/${questionId}`,
    { method: 'DELETE' }
  )
}

export async function reorderQuestions(
  quizId: string,
  data: ReorderQuestionsParams
): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(
    `/admin/quizzes/${quizId}/questions/reorder`,
    { method: 'PUT', body: data }
  )
}

// ─── Option CRUD ────────────────────────────────────────────────────────────────

export async function addOption(
  quizId: string,
  questionId: string,
  data: CreateOptionParams
): Promise<AdminQuestionOption> {
  return apiFetchWithInterceptors<AdminQuestionOption>(
    `/admin/quizzes/${quizId}/questions/${questionId}/options`,
    { method: 'POST', body: data }
  )
}

export async function updateOption(
  quizId: string,
  questionId: string,
  optionId: string,
  data: UpdateOptionParams
): Promise<AdminQuestionOption> {
  return apiFetchWithInterceptors<AdminQuestionOption>(
    `/admin/quizzes/${quizId}/questions/${questionId}/options/${optionId}`,
    { method: 'PATCH', body: data }
  )
}

export async function removeOption(
  quizId: string,
  questionId: string,
  optionId: string
): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(
    `/admin/quizzes/${quizId}/questions/${questionId}/options/${optionId}`,
    { method: 'DELETE' }
  )
}
