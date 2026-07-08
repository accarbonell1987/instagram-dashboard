import { z } from 'zod'

// ─── Quiz Form ────────────────────────────────────────────────────────────────

export const quizFormSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  description: z.string().optional(),
  timeLimitMinutes: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined || val === '') return true
        const n = Number(val)
        return !Number.isNaN(n) && Number.isInteger(n) && n >= 1
      },
      { message: 'El tiempo límite debe ser al menos 1 minuto' }
    ),
  passingScore: z.coerce
    .number()
    .int()
    .min(0, 'El puntaje debe ser entre 0 y 100')
    .max(100, 'El puntaje debe ser entre 0 y 100'),
  active: z.boolean(),
})

export type QuizFormData = z.infer<typeof quizFormSchema>

// ─── Question Form ────────────────────────────────────────────────────────────

export const questionFormSchema = z.object({
  text: z.string().min(1, 'El texto de la pregunta es obligatorio'),
  type: z.enum(['multiple_choice', 'true_false'], {
    errorMap: () => ({ message: 'El tipo debe ser multiple_choice o true_false' }),
  }),
})

export type QuestionFormData = z.infer<typeof questionFormSchema>

// ─── Option Form ──────────────────────────────────────────────────────────────

export const optionFormSchema = z.object({
  text: z.string().min(1, 'El texto de la opción es obligatorio'),
  isCorrect: z.boolean(),
})

export type OptionFormData = z.infer<typeof optionFormSchema>
