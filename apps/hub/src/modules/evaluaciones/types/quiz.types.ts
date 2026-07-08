// ─── Quiz taking types — tenant-facing ───────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false'

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned'

export interface QuestionOption {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  order: number
  createdAt: string
}

export interface Question {
  id: string
  quizId: string
  text: string
  type: QuestionType
  order: number
  createdAt: string
  updatedAt: string
  options: QuestionOption[]
}

export interface QuizListItem {
  id: string
  moduleId: string | null
  title: string
  description: string | null
  passingScore: number
  timeLimitMinutes: number | null
  active: boolean
  createdAt: string
  updatedAt: string
  questionCount: number
}

export interface QuizWithQuestions {
  id: string
  moduleId: string | null
  title: string
  description: string | null
  passingScore: number
  timeLimitMinutes: number | null
  active: boolean
  createdAt: string
  updatedAt: string
  questions: Question[]
}

export interface QuizAttempt {
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

export interface AttemptAnswer {
  id: string
  attemptId: string
  questionId: string
  selectedOptionId: string | null
  createdAt: string
  question?: Question | undefined
  selectedOption?: QuestionOption | null
}

export type AttemptWithAnswers = QuizAttempt & {
  answers: AttemptAnswer[]
}

export interface StartAttemptResponse {
  attempt: QuizAttempt
  quiz: QuizWithQuestions
}
