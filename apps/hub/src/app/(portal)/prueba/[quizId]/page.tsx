'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Spinner,
} from '@core/ui'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Flag } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api/errors'
import {
  completeAttempt,
  startAttempt,
  submitAnswer,
  useQuizTaker,
  useTimer,
  type StartAttemptResponse,
} from '@/modules/evaluaciones'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function QuizTakerPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const quizId = params['quizId'] as string

  const [quizData, setQuizData] = useState<StartAttemptResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const startedRef = useRef(false)

  // Load quiz and start attempt
  const initQuiz = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true

    setLoading(true)
    setError('')
    try {
      const data = await startAttempt(quizId)
      setQuizData(data)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al iniciar la evaluación')
      }
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    void initQuiz()
  }, [initQuiz])

  // Hooks — only called after quiz data is loaded
  const questions = quizData?.quiz.questions ?? []
  const attemptId = quizData?.attempt.id ?? ''
  const timeLimitMinutes = quizData?.quiz.timeLimitMinutes

  const taker = useQuizTaker(questions)
  const timer = useTimer(timeLimitMinutes ?? 60)

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const currentQuestion = taker.currentQuestion
  const isLastQuestion = taker.currentIndex === taker.totalQuestions - 1
  const isFirstQuestion = taker.currentIndex === 0

  const handleSelectAnswer = useCallback(
    (optionId: string) => {
      if (currentQuestion !== null) {
        taker.actions.selectAnswer(currentQuestion.id, optionId)
      }
    },
    [currentQuestion, taker.actions],
  )

  const handleNext = useCallback(async () => {
    if (currentQuestion === null || submitting) return

    // Submit answer to the server before advancing
    const selectedOptionId = taker.answers[currentQuestion.id]
    try {
      await submitAnswer(quizId, attemptId, currentQuestion.id, selectedOptionId)
    } catch {
      // Non-blocking — continue navigation even if save fails
    }

    if (isLastQuestion) {
      setConfirmOpen(true)
    } else {
      taker.actions.next()
    }
  }, [
    currentQuestion,
    quizId,
    attemptId,
    isLastQuestion,
    submitting,
    taker.answers,
    taker.actions,
  ])

  const handlePrev = useCallback(async () => {
    if (currentQuestion === null || submitting) return

    // Save current answer before going back
    const selectedOptionId = taker.answers[currentQuestion.id]
    try {
      await submitAnswer(quizId, attemptId, currentQuestion.id, selectedOptionId)
    } catch {
      // Non-blocking
    }

    taker.actions.prev()
  }, [currentQuestion, quizId, attemptId, submitting, taker.answers, taker.actions])

  const handleFinalize = useCallback(async () => {
    if (submitting) return

    setSubmitting(true)
    setConfirmOpen(false)

    try {
      // Submit remaining unsaved answers
      const remainingAnswers = Object.entries(taker.answers)
        .filter(([qId]) => qId !== currentQuestion?.id)

      for (const [qId, optId] of remainingAnswers) {
        try {
          await submitAnswer(quizId, attemptId, qId, optId)
        } catch {
          // Continue with next
        }
      }

      // Submit current question answer if not yet submitted
      if (currentQuestion !== null) {
        const currentAnswer = taker.answers[currentQuestion.id]
        try {
          await submitAnswer(quizId, attemptId, currentQuestion.id, currentAnswer)
        } catch {
          // Continue
        }
      }

      // Complete the attempt
      await completeAttempt(quizId, attemptId)
      taker.actions.finalize()
      toast.success('Evaluación completada')
      router.push(`/prueba/${quizId}/resultados?attemptId=${attemptId}`)
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Error al enviar la prueba'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    taker.answers,
    taker.actions,
    quizId,
    attemptId,
    currentQuestion,
    router,
  ])

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
        <span className="text-muted-foreground ml-3 text-sm">Cargando evaluación...</span>
      </div>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────────

  if (error !== '') {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="text-destructive mx-auto mb-3 h-10 w-10" />
        <p role="alert" className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { router.push('/prueba'); }}>
          Volver a evaluaciones
        </Button>
      </div>
    )
  }

  if (quizData === null || currentQuestion === null) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-muted-foreground text-sm">Esta evaluación no tiene preguntas.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { router.push('/prueba'); }}>
          Volver a evaluaciones
        </Button>
      </div>
    )
  }

  // ─── Quiz taker UI ───────────────────────────────────────────────────────────

  const progressPercent = ((taker.currentIndex + 1) / taker.totalQuestions) * 100

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header: progress + timer */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">{quizData.quiz.title}</h2>
          <div className="flex items-center gap-1.5">
            <Clock
              className={`h-4 w-4 ${
                timer.isWarning ? 'text-destructive animate-pulse' : 'text-muted-foreground'
              }`}
            />
            <span
              className={`font-mono text-sm tabular-nums ${
                timer.isWarning
                  ? 'text-destructive font-semibold'
                  : timer.isExpired
                    ? 'text-destructive'
                    : 'text-muted-foreground'
              }`}
            >
              {timer.formatted}
            </span>
            {timer.isExpired && (
              <Badge variant="destructive" className="ml-1 text-xs">Tiempo agotado</Badge>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progressPercent} className="h-1.5" />

        <p className="text-muted-foreground text-xs">
          Pregunta {taker.currentIndex + 1} de {taker.totalQuestions}
        </p>
      </div>

      {/* Question card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {currentQuestion.type === 'true_false' ? 'Verdadero / Falso' : 'Selección múltiple'}
            </Badge>
          </div>
          <CardTitle className="text-base leading-relaxed">{currentQuestion.text}</CardTitle>
        </CardHeader>

        <CardContent>
          <RadioGroup
            value={taker.answers[currentQuestion.id] ?? ''}
            onValueChange={handleSelectAnswer}
            className="space-y-3"
          >
            {currentQuestion.options
              .sort((a, b) => a.order - b.order)
              .map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    taker.answers[currentQuestion.id] === option.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  } ${submitting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <RadioGroupItem value={option.id} id={`opt-${option.id}`} disabled={submitting} />
                  <span className="text-sm">{option.text}</span>
                </label>
              ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handlePrev()}
          disabled={isFirstQuestion || submitting}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>

        <span className="text-muted-foreground text-xs">
          {taker.totalQuestions - (taker.currentIndex + 1)} restante{taker.totalQuestions - (taker.currentIndex + 1) !== 1 ? 's' : ''}
        </span>

        {isLastQuestion ? (
          <Button size="sm" onClick={() => void handleNext()} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner className="mr-1 h-3.5 w-3.5" />
                Enviando...
              </>
            ) : (
              <>
                <Flag className="mr-1 h-4 w-4" />
                Finalizar
              </>
            )}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void handleNext()} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner className="mr-1 h-3.5 w-3.5" />
                Guardando...
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Entregar evaluación?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a finalizar la evaluación. No podrás modificar tus respuestas después de entregar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); }} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={() => void handleFinalize()} disabled={submitting}>
              {submitting ? 'Enviando...' : 'Entregar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
