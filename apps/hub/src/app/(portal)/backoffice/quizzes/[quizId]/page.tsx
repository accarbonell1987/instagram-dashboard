'use client';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Checkbox,
  Badge,
} from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Save, Eye } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api/errors';
import {
  questionFormSchema,
  optionFormSchema,
  type QuestionFormData,
  type OptionFormData,
} from '@/modules/backoffice/evaluaciones/lib/quiz.schemas';
import {
  getQuiz,
  addQuestion,
  updateQuestion,
  removeQuestion,
  reorderQuestions,
  addOption,
  updateOption,
  removeOption,
  type AdminQuiz,
  type AdminQuestion,
  type AdminQuestionOption,
  type QuestionType,
} from '@/modules/backoffice/evaluaciones/services/quiz-admin.service';
import {
  listResults,
  getAttemptDetail,
  type AdminQuizAttempt,
  type AdminQuizAttemptDetail,
} from '@/modules/backoffice/evaluaciones/services/quiz-attempt-admin.service';

// ─── Delete Confirmation ────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  itemName,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  itemName: string;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDeleteError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Error al eliminar');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar <strong>{itemName}</strong>? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteError !== null && (
          <p role="alert" className="text-destructive text-sm">
            {deleteError}
          </p>
        )}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleOpenChange(false);
            }}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Results Viewer ─────────────────────────────────────────────────────────────

function ResultsPanel({ quizId }: { quizId: string }) {
  const [attempts, setAttempts] = useState<AdminQuizAttempt[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AdminQuizAttemptDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadResults = useCallback(async () => {
    setLoadingResults(true);
    setResultsError('');
    try {
      const result = await listResults({ quizId });
      setAttempts(result.attempts);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setResultsError(err.message);
      } else {
        setResultsError('Error al cargar resultados');
      }
    } finally {
      setLoadingResults(false);
    }
  }, [quizId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  async function toggleExpand(attemptId: string) {
    if (expandedAttempt === attemptId) {
      setExpandedAttempt(null);
      setAttemptDetail(null);
      return;
    }
    setExpandedAttempt(attemptId);
    setLoadingDetail(true);
    try {
      const detail = await getAttemptDetail(attemptId);
      setAttemptDetail(detail);
    } catch {
      setAttemptDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loadingResults) {
    return <p className="text-muted-foreground py-2 text-sm">Cargando resultados...</p>;
  }

  if (resultsError !== '') {
    return <p className="text-destructive py-2 text-sm">{resultsError}</p>;
  }

  if (attempts.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Sin intentos registrados.
      </p>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Tenant</th>
            <th className="px-3 py-2 font-medium">Usuario</th>
            <th className="px-3 py-2 font-medium">Puntaje</th>
            <th className="px-3 py-2 font-medium">Aprobado</th>
            <th className="px-3 py-2 font-medium">Inicio</th>
            <th className="px-3 py-2 font-medium">Fin</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <>
              <tr
                key={attempt.id}
                className="border-border cursor-pointer border-t hover:bg-accent"
                onClick={() => void toggleExpand(attempt.id)}
              >
                <td className="px-3 py-2 font-mono text-xs">{attempt.tenantId}</td>
                <td className="px-3 py-2 font-mono text-xs">{attempt.userId}</td>
                <td className="px-3 py-2">
                  {attempt.score !== null ? `${attempt.score}%` : '—'}
                </td>
                <td className="px-3 py-2">
                  {attempt.passed === true ? (
                    <Badge className="bg-green-100 text-green-700">Sí</Badge>
                  ) : attempt.passed === false ? (
                    <Badge className="bg-red-100 text-red-700">No</Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(attempt.startedAt).toLocaleDateString('es-PY')}
                </td>
                <td className="px-3 py-2 text-xs">
                  {attempt.completedAt
                    ? new Date(attempt.completedAt).toLocaleDateString('es-PY')
                    : '—'}
                </td>
              </tr>
              {expandedAttempt === attempt.id && (
                <tr key={`${attempt.id}-detail`} className="border-border border-t bg-muted/30">
                  <td colSpan={6} className="px-4 py-3">
                    {loadingDetail ? (
                      <p className="text-muted-foreground text-xs">Cargando detalle...</p>
                    ) : attemptDetail?.answers && attemptDetail.answers.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Respuestas:</p>
                        {attemptDetail.answers.map((ans, idx) => (
                          <div key={ans.id} className="text-xs">
                            <span className="text-muted-foreground">
                              Pregunta {idx + 1}:
                            </span>{' '}
                            {ans.selectedOptionId ?? 'Sin respuesta'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Sin detalle de respuestas.
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Option Editor (inline within a question card) ──────────────────────────────

function OptionEditor({
  quizId,
  questionId,
  options,
  questionType,
  onOptionsChanged,
}: {
  quizId: string;
  questionId: string;
  options: AdminQuestionOption[];
  questionType: QuestionType;
  onOptionsChanged: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [savingOptionId, setSavingOptionId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [deletingOption, setDeletingOption] = useState<AdminQuestionOption | null>(null);

  const addForm = useForm<OptionFormData>({
    resolver: zodResolver(optionFormSchema),
    defaultValues: { text: '', isCorrect: false },
  });

  const editForm = useForm<OptionFormData>({
    resolver: zodResolver(optionFormSchema),
  });

  async function handleAdd(data: OptionFormData): Promise<void> {
    setSavingOptionId('__new__');
    try {
      await addOption(quizId, questionId, data);
      setIsAdding(false);
      addForm.reset();
      onOptionsChanged();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al agregar opción';
      toast.error(message);
    } finally {
      setSavingOptionId(null);
    }
  }

  function startEdit(option: AdminQuestionOption) {
    setEditingOptionId(option.id);
    editForm.reset({ text: option.text, isCorrect: option.isCorrect });
  }

  async function handleEdit(optionId: string, data: OptionFormData): Promise<void> {
    setSavingOptionId(optionId);
    try {
      await updateOption(quizId, questionId, optionId, data);
      setEditingOptionId(null);
      onOptionsChanged();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al actualizar opción';
      toast.error(message);
    } finally {
      setSavingOptionId(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deletingOption) return;
    try {
      await removeOption(quizId, questionId, deletingOption.id);
      setDeletingOption(null);
      onOptionsChanged();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar opción';
      toast.error(message);
    }
  }

  async function handleToggleCorrect(option: AdminQuestionOption): Promise<void> {
    // For radio-like single correct: set isCorrect = true only for this option
    // Actually the API sets isCorrect on each option individually.
    // We toggle the clicked one.
    setSavingOptionId(option.id);
    try {
      await updateOption(quizId, questionId, option.id, {
        isCorrect: !option.isCorrect,
      });
      onOptionsChanged();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al actualizar opción';
      toast.error(message);
    } finally {
      setSavingOptionId(null);
    }
  }

  return (
    <div className="mt-3 border-border space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Opciones</span>
        {!isAdding && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAdding(true);
              addForm.reset({ text: '', isCorrect: false });
            }}
            className="h-7 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Agregar Opción
          </Button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={(e) => void addForm.handleSubmit(handleAdd)(e)}
          noValidate
          className="border-border bg-background rounded-md border p-3"
        >
          <div className="flex items-center gap-3">
            <Input
              placeholder="Texto de la opción"
              className="h-8 text-sm"
              disabled={savingOptionId !== null}
              {...addForm.register('text')}
            />
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={addForm.watch('isCorrect')}
                onCheckedChange={(checked) =>
                  addForm.setValue('isCorrect', checked === true)
                }
                id={`new-option-correct-${questionId}`}
              />
              Correcta
            </label>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={savingOptionId !== null}>
              {savingOptionId === '__new__' ? '...' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsAdding(false)}
              disabled={savingOptionId !== null}
            >
              Cancelar
            </Button>
          </div>
          {addForm.formState.errors.text !== undefined && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              {addForm.formState.errors.text.message}
            </p>
          )}
        </form>
      )}

      {options.length === 0 && !isAdding ? (
        <p className="text-muted-foreground text-xs">Sin opciones.</p>
      ) : (
        <div className="space-y-1.5">
          {options.map((option) => (
            <div key={option.id}>
              {editingOptionId === option.id ? (
                <form
                  onSubmit={(e) => void editForm.handleSubmit((d) => handleEdit(option.id, d))(e)}
                  noValidate
                  className="flex items-center gap-2"
                >
                  <Input
                    className="h-7 text-xs"
                    disabled={savingOptionId !== null}
                    {...editForm.register('text')}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={editForm.watch('isCorrect')}
                      onCheckedChange={(checked) =>
                        editForm.setValue('isCorrect', checked === true)
                      }
                    />
                    Correcta
                  </label>
                  <Button type="submit" size="sm" className="h-7 text-xs" disabled={savingOptionId !== null}>
                    {savingOptionId === option.id ? '...' : 'Guardar'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingOptionId(null)}
                    disabled={savingOptionId !== null}
                  >
                    Cancelar
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                  <span className="flex-1 text-sm">{option.text}</span>
                  <Badge
                    className={
                      option.isCorrect
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }
                  >
                    {option.isCorrect ? 'Correcta' : 'Incorrecta'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => void handleToggleCorrect(option)}
                    disabled={savingOptionId === option.id}
                    aria-label={option.isCorrect ? 'Marcar incorrecta' : 'Marcar correcta'}
                  >
                    <Checkbox
                      checked={option.isCorrect}
                      className="pointer-events-none"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => startEdit(option)}
                    aria-label="Editar opción"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => setDeletingOption(option)}
                    aria-label="Eliminar opción"
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deletingOption !== null}
        itemName={deletingOption?.text ?? ''}
        onConfirm={handleDelete}
        onOpenChange={() => setDeletingOption(null)}
      />
    </div>
  );
}

// ─── Question Card ──────────────────────────────────────────────────────────────

function QuestionCard({
  quizId,
  question,
  index,
  total,
  onQuestionChanged,
  onMoveUp,
  onMoveDown,
}: {
  quizId: string;
  question: AdminQuestion;
  index: number;
  total: number;
  onQuestionChanged: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const editForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
  });

  function startEdit() {
    setIsEditing(true);
    editForm.reset({ text: question.text, type: question.type });
  }

  async function handleEdit(data: QuestionFormData): Promise<void> {
    setIsSaving(true);
    try {
      await updateQuestion(quizId, question.id, data);
      setIsEditing(false);
      onQuestionChanged();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Error al actualizar pregunta';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await removeQuestion(quizId, question.id);
      setDeletingQuestion(false);
      onQuestionChanged();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Error al eliminar pregunta';
      toast.error(message);
    }
  }

  async function handleTypeChange(newType: QuestionType): Promise<void> {
    setIsSaving(true);
    try {
      await updateQuestion(quizId, question.id, { type: newType });
      onQuestionChanged();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Error al cambiar tipo';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const typeLabel: Record<QuestionType, string> = {
    multiple_choice: 'Multiple choice',
    true_false: 'Verdadero / Falso',
  };

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="flex items-start gap-3">
        {/* Order badge */}
        <span className="text-muted-foreground bg-muted mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <form
              onSubmit={(e) => void editForm.handleSubmit(handleEdit)(e)}
              noValidate
              className="space-y-2"
            >
              <div className="flex flex-col gap-1">
                <Input
                  placeholder="Texto de la pregunta"
                  disabled={isSaving}
                  className="h-8 text-sm"
                  {...editForm.register('text')}
                />
                {editForm.formState.errors.text !== undefined && (
                  <p role="alert" className="text-destructive text-xs">
                    {editForm.formState.errors.text.message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={editForm.watch('type')}
                  onValueChange={(value) =>
                    editForm.setValue('type', value as QuestionType)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                    <SelectItem value="true_false">Verdadero / Falso</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" className="h-7 text-xs" disabled={isSaving}>
                  {isSaving ? '...' : 'Guardar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{question.text}</p>
                <Badge className="bg-blue-100 text-blue-700 text-xs">
                  {typeLabel[question.type]}
                </Badge>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {!isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => void setExpanded(!expanded)}
                aria-label={expanded ? 'Colapsar opciones' : 'Ver opciones'}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={startEdit}
                aria-label="Editar pregunta"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => void onMoveUp()}
            disabled={index === 0}
            aria-label="Subir pregunta"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => void onMoveDown()}
            disabled={index === total - 1}
            aria-label="Bajar pregunta"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => setDeletingQuestion(true)}
            aria-label="Eliminar pregunta"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </div>

      {/* Expanded: options editor */}
      {expanded && !isEditing && (
        <OptionEditor
          quizId={quizId}
          questionId={question.id}
          options={question.options ?? []}
          questionType={question.type}
          onOptionsChanged={onQuestionChanged}
        />
      )}

      <DeleteConfirmDialog
        open={deletingQuestion}
        itemName={question.text.length > 40 ? `${question.text.slice(0, 40)}...` : question.text}
        onConfirm={handleDelete}
        onOpenChange={() => setDeletingQuestion(false)}
      />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function QuestionEditorPage(): JSX.Element {
  const params = useParams();
  const quizId = params['quizId'] as string;

  const [quiz, setQuiz] = useState<AdminQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'questions' | 'results'>('questions');

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getQuiz(quizId);
      setQuiz(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar la evaluación');
      }
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void loadQuiz();
  }, [loadQuiz]);

  // ─── Add Question Inline Form ──────────────────────────────────────────────

  const [isAdding, setIsAdding] = useState(false);
  const addForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: { text: '', type: 'multiple_choice' },
  });

  async function handleAddQuestion(data: QuestionFormData): Promise<void> {
    try {
      await addQuestion(quizId, data);
      setIsAdding(false);
      addForm.reset({ text: '', type: 'multiple_choice' });
      await loadQuiz();
      toast.success('Pregunta agregada');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Error al agregar pregunta';
      toast.error(message);
    }
  }

  // ─── Reorder ───────────────────────────────────────────────────────────────

  async function handleMoveUp(index: number): Promise<void> {
    const questions = quiz?.questions ?? [];
    if (index <= 0) return;
    const newOrder = [...questions];
    const moved = newOrder[index];
    const target = newOrder[index - 1];
    if (!moved || !target) return;
    newOrder[index - 1] = moved;
    newOrder[index] = target;
    try {
      await reorderQuestions(quizId, { orderedIds: newOrder.map((q) => q.id) });
      await loadQuiz();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al reordenar';
      toast.error(message);
    }
  }

  async function handleMoveDown(index: number): Promise<void> {
    const questions = quiz?.questions ?? [];
    if (index >= questions.length - 1) return;
    const newOrder = [...questions];
    const moved = newOrder[index];
    const target = newOrder[index + 1];
    if (!moved || !target) return;
    newOrder[index + 1] = moved;
    newOrder[index] = target;
    try {
      await reorderQuestions(quizId, { orderedIds: newOrder.map((q) => q.id) });
      await loadQuiz();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Error al reordenar';
      toast.error(message);
    }
  }

  // ─── Compose questions with options ────────────────────────────────────────

  const questions = quiz?.questions ?? [];

  if (loading) {
    return <p className="text-muted-foreground p-4 text-sm">Cargando preguntas...</p>;
  }

  if (error !== '') {
    return (
      <div>
        <Link
          href="/backoffice/quizzes"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a pruebas
        </Link>
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div>
        <Link
          href="/backoffice/quizzes"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a pruebas
        </Link>
        <p className="text-muted-foreground text-sm">Prueba no encontrada.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            href="/backoffice/quizzes"
            className="text-muted-foreground hover:text-foreground mb-1 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Pruebas
          </Link>
          <h2 className="text-lg font-semibold">{quiz.title}</h2>
        </div>
        {activeTab === 'questions' && (
          <Button
            size="sm"
            onClick={() => {
              setIsAdding(true);
              addForm.reset({ text: '', type: 'multiple_choice' });
            }}
            disabled={isAdding}
          >
            <Plus className="mr-1 h-4 w-4" />
            Agregar Pregunta
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {(['questions', 'results'] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'questions' ? 'Preguntas' : 'Resultados'}
          </Button>
        ))}
      </div>

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <>
          {isAdding && (
            <div className="border-border bg-card mb-4 rounded-lg border p-4">
              <form
                onSubmit={(e) => void addForm.handleSubmit(handleAddQuestion)(e)}
                noValidate
                className="space-y-3"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor="new-question-text">Texto de la pregunta</Label>
                  <Input
                    id="new-question-text"
                    placeholder="Escribí la pregunta"
                    {...addForm.register('text')}
                  />
                  {addForm.formState.errors.text !== undefined && (
                    <p role="alert" className="text-destructive text-xs">
                      {addForm.formState.errors.text.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-question-type">Tipo</Label>
                    <Select
                      value={addForm.watch('type')}
                      onValueChange={(value) =>
                        addForm.setValue('type', value as QuestionType)
                      }
                    >
                      <SelectTrigger id="new-question-type" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                        <SelectItem value="true_false">Verdadero / Falso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pt-6">
                    <Button type="submit" size="sm">
                      <Save className="mr-1 h-4 w-4" />
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAdding(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {questions.length === 0 && !isAdding ? (
            <div className="border-border bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Agregá la primera pregunta.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setIsAdding(true);
                  addForm.reset({ text: '', type: 'multiple_choice' });
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Agregar Pregunta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {[...questions]
                .sort((a, b) => a.order - b.order)
                .map((q, idx) => (
                  <QuestionCard
                    key={q.id}
                    quizId={quizId}
                    question={q}
                    index={idx}
                    total={questions.length}
                    onQuestionChanged={loadQuiz}
                    onMoveUp={() => void handleMoveUp(idx)}
                    onMoveDown={() => void handleMoveDown(idx)}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && <ResultsPanel quizId={quizId} />}
    </div>
  );
}
