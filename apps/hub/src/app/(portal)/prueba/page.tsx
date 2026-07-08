'use client'

import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Spinner } from '@core/ui'
import { Clock, HelpCircle, Play, RotateCcw, Eye } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type JSX } from 'react'

import { ApiError } from '@/lib/api/errors'
import {
  listAvailableQuizzes,
  listAttempts,
  startAttempt,
  type QuizAttempt,
  type QuizListItem,
} from '@/modules/evaluaciones'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface QuizWithAttempts extends QuizListItem {
  previousAttempts: QuizAttempt[]
  isStarting: boolean
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PruebaListPage(): JSX.Element {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<QuizWithAttempts[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadQuizzes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listAvailableQuizzes()
      const quizzesWithAttempts: QuizWithAttempts[] = await Promise.all(
        result.quizzes.map(async (q) => {
          try {
            const attemptsRes = await listAttempts(q.id)
            return { ...q, previousAttempts: attemptsRes.attempts, isStarting: false }
          } catch {
            return { ...q, previousAttempts: [], isStarting: false }
          }
        }),
      )
      setQuizzes(quizzesWithAttempts)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al cargar las evaluaciones')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQuizzes()
  }, [loadQuizzes])

  const handleStart = useCallback(async (quizId: string) => {
    setQuizzes((prev) =>
      prev.map((q) => (q.id === quizId ? { ...q, isStarting: true } : q)),
    )
    try {
      await startAttempt(quizId)
      router.push(`/prueba/${quizId}`)
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al iniciar la prueba'
      setError(message)
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quizId ? { ...q, isStarting: false } : q)),
      )
    }
  }, [router])

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
        <span className="text-muted-foreground ml-3 text-sm">Cargando evaluaciones...</span>
      </div>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────────

  if (error !== '' && quizzes.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p role="alert" className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadQuizzes()}>
          Reintentar
        </Button>
      </div>
    )
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────

  if (quizzes.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <HelpCircle className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">No hay evaluaciones disponibles.</p>
      </div>
    )
  }

  // ─── Quiz cards ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {error !== '' && (
        <p role="alert" className="text-destructive mb-4 text-sm">{error}</p>
      )}

      <h2 className="mb-6 text-xl font-semibold">Evaluaciones Disponibles</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {quizzes.map((quiz) => {
          const attempts = quiz.previousAttempts
          const latestAttempt = attempts[attempts.length - 1] ?? null
          const isCompleted = latestAttempt !== null && latestAttempt.status === 'completed'

          return (
            <Card key={quiz.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{quiz.title}</CardTitle>
                  {latestAttempt?.passed != null && (
                    <Badge variant={latestAttempt.passed ? 'default' : 'destructive'}>
                      {latestAttempt.passed ? 'Aprobado' : 'No aprobado'}
                    </Badge>
                  )}
                </div>
                {quiz.description !== null && (
                  <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-2">
                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="h-3.5 w-3.5" />
                    {quiz.questionCount} {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'}
                  </span>
                  {quiz.timeLimitMinutes !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {quiz.timeLimitMinutes} min
                    </span>
                  )}
                </div>

                {isCompleted && (
                  <div className="text-muted-foreground text-xs">
                    Último intento: {latestAttempt.score !== null ? `${String(latestAttempt.score)}%` : '—'}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex gap-2">
                {isCompleted ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleStart(quiz.id)}
                      disabled={quiz.isStarting}
                    >
                      {quiz.isStarting ? (
                        <>
                          <Spinner className="mr-1 h-3.5 w-3.5" />
                          Iniciando...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          Reintentar
                        </>
                      )}
                    </Button>
                    <Link href={`/prueba/${quiz.id}/resultados?attemptId=${latestAttempt.id}`} passHref>
                      <Button variant="ghost" size="sm" asChild>
                        <span>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Ver resultados
                        </span>
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void handleStart(quiz.id)}
                    disabled={quiz.isStarting}
                  >
                    {quiz.isStarting ? (
                      <>
                        <Spinner className="mr-1 h-3.5 w-3.5" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Comenzar
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
