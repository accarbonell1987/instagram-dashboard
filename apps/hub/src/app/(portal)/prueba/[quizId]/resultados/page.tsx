'use client'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Spinner,
} from '@core/ui'
import { AlertTriangle, ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, type JSX } from 'react'

import { ApiError } from '@/lib/api/errors'
import {
  getAttempt,
  getQuizDetail,
  type AttemptWithAnswers,
  type QuizListItem,
} from '@/modules/evaluaciones'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ResultadosPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const quizId = params['quizId'] as string
  const attemptId = searchParams.get('attemptId')

  const [quizDetail, setQuizDetail] = useState<QuizListItem | null>(null)
  const [attempt, setAttempt] = useState<AttemptWithAnswers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadResults = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [detail, attemptData] = await Promise.all([
        getQuizDetail(quizId),
        attemptId !== null
          ? getAttempt(quizId, attemptId)
          : Promise.reject(new Error('No attempt ID provided')),
      ])
      setQuizDetail(detail)
      setAttempt(attemptData)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al cargar los resultados')
      }
    } finally {
      setLoading(false)
    }
  }, [quizId, attemptId])

  useEffect(() => {
    void loadResults()
  }, [loadResults])

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
        <span className="text-muted-foreground ml-3 text-sm">Cargando resultados...</span>
      </div>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────────

  if (error !== '' || quizDetail === null || attempt === null) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="text-destructive mx-auto mb-3 h-10 w-10" />
        <p role="alert" className="text-destructive text-sm">
          {error !== '' ? error : 'No se encontraron resultados.'}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { router.push('/prueba'); }}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a pruebas
        </Button>
      </div>
    )
  }

  // ─── Computed values ──────────────────────────────────────────────────────────

  const score = attempt.score ?? 0
  const passed = attempt.passed ?? false
  const passingScore = quizDetail.passingScore
  const totalQuestions = quizDetail.questionCount
  const correctCount = attempt.answers.filter((a) => {
    const correctOption = a.question?.options.find((o) => o.isCorrect)
    return a.selectedOptionId === correctOption?.id
  }).length

  // ─── Results UI ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => { router.push('/prueba'); }}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a pruebas
      </Button>

      {/* Score summary */}
      <Card className="mb-6">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-lg">{quizDetail.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score ring display */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted/20"
                />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  strokeDasharray={`${String((score / 100) * 97.4)} 97.4`}
                  className={passed ? 'text-green-500' : 'text-destructive'}
                />
              </svg>
              <span className="absolute text-2xl font-bold">{score}%</span>
            </div>

            <Badge
              variant={passed ? 'default' : 'destructive'}
              className="mt-3 text-sm px-4 py-1"
            >
              {passed ? 'Aprobado' : 'No aprobado'}
            </Badge>

            <p className="text-muted-foreground mt-2 text-xs">
              {correctCount} de {totalQuestions} correctas
            </p>

            <div className="mt-3 w-full max-w-xs">
              <div className="flex justify-between text-xs mb-1">
                <span>Puntaje mínimo: {passingScore}%</span>
                <span>{score}%</span>
              </div>
              <Progress
                value={Math.min(score, 100)}
                className={`h-2 ${passed ? '[&>div]:bg-green-500' : '[&>div]:bg-destructive'}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Answer review */}
      <h3 className="mb-4 text-base font-semibold">Revisión de respuestas</h3>

      <div className="space-y-3">
        {attempt.answers
          .sort((a, b) => {
            const orderA = a.question?.order ?? 0
            const orderB = b.question?.order ?? 0
            return orderA - orderB
          })
          .map((answer) => {
            const question = answer.question
            if (question === undefined) return null

            const correctOption = question.options.find((o) => o.isCorrect)
            const isCorrect =
              answer.selectedOptionId === correctOption?.id
            const selectedOption = question.options.find(
              (o) => o.id === answer.selectedOptionId,
            )
            const wasAnswered = answer.selectedOptionId !== null

            return (
              <Card key={answer.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-sm font-medium leading-relaxed">
                        {question.text}
                      </CardTitle>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {question.type === 'true_false'
                          ? 'Verdadero / Falso'
                          : 'Selección múltiple'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 pt-0">
                  {/* User's answer */}
                  <div
                    className={`rounded-md border p-2.5 text-sm ${
                      isCorrect
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                    }`}
                  >
                    <span className="text-muted-foreground text-xs">Tu respuesta: </span>
                    <span className={isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                      {wasAnswered && selectedOption !== undefined
                        ? selectedOption.text
                        : 'Sin respuesta'}
                    </span>
                  </div>

                  {/* Correct answer (only shown if wrong) */}
                  {!isCorrect && correctOption !== undefined && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-2.5 text-sm dark:border-green-800 dark:bg-green-950">
                      <span className="text-muted-foreground text-xs">Respuesta correcta: </span>
                      <span className="text-green-700 dark:text-green-300">{correctOption.text}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
