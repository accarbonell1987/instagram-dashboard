'use client';

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Archive, RotateCcw, FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '@/lib/api/errors';
import { quizFormSchema, type QuizFormData } from '@/modules/backoffice/evaluaciones/lib/quiz.schemas';
import {
  listQuizzes,
  createQuiz,
  updateQuiz,
  archiveQuiz,
  type AdminQuiz,
  type CreateQuizParams,
  type UpdateQuizParams,
} from '@/modules/backoffice/evaluaciones/services/quiz-admin.service';

// ─── Quiz Form Dialog ───────────────────────────────────────────────────────────

function QuizFormDialog({
  open,
  onOpenChange,
  editingQuiz,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingQuiz: AdminQuiz | null;
  onSave: (data: CreateQuizParams | UpdateQuizParams) => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<QuizFormData>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      title: '',
      description: '',
      timeLimitMinutes: '',
      passingScore: 60,
      active: true,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingQuiz) {
        form.reset({
          title: editingQuiz.title,
          description: editingQuiz.description ?? '',
          timeLimitMinutes: editingQuiz.timeLimitMinutes !== null ? String(editingQuiz.timeLimitMinutes) : '',
          passingScore: editingQuiz.passingScore,
          active: editingQuiz.active,
        });
      } else {
        form.reset({
          title: '',
          description: '',
          timeLimitMinutes: '',
          passingScore: 60,
          active: true,
        });
      }
      setError('');
    }
  }, [open, editingQuiz, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError('');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(data: QuizFormData): Promise<void> {
    setIsLoading(true);
    setError('');
    try {
      const timeLimitMinutes = data.timeLimitMinutes
        ? Number(data.timeLimitMinutes)
        : undefined;

      if (editingQuiz) {
        await onSave({
          title: data.title.trim(),
          description: data.description?.trim() || undefined,
          passingScore: data.passingScore,
          timeLimitMinutes: timeLimitMinutes ?? null,
          active: data.active,
        } satisfies UpdateQuizParams);
      } else {
        await onSave({
          title: data.title.trim(),
          description: data.description?.trim() || undefined,
          passingScore: data.passingScore,
          timeLimitMinutes,
        } satisfies CreateQuizParams);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al guardar');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingQuiz ? 'Editar Evaluación' : 'Crear Evaluación'}</DialogTitle>
          <DialogDescription>
            {editingQuiz
              ? 'Modificá los datos de la evaluación.'
              : 'Completá los datos de la nueva evaluación.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
          noValidate
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-title">Título</Label>
              <Input
                id="quiz-title"
                placeholder="Título de la evaluación"
                disabled={isLoading}
                aria-describedby={
                  form.formState.errors.title !== undefined ? 'quiz-title-error' : undefined
                }
                {...form.register('title')}
              />
              {form.formState.errors.title !== undefined && (
                <p id="quiz-title-error" role="alert" className="text-destructive text-xs">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-description">Descripción</Label>
              <Input
                id="quiz-description"
                placeholder="Descripción (opcional)"
                disabled={isLoading}
                {...form.register('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quiz-passing-score">Puntaje mínimo (%)</Label>
                <Input
                  id="quiz-passing-score"
                  type="number"
                  placeholder="60"
                  min={0}
                  max={100}
                  disabled={isLoading}
                  aria-describedby={
                    form.formState.errors.passingScore !== undefined
                      ? 'quiz-passing-score-error'
                      : undefined
                  }
                  {...form.register('passingScore')}
                />
                {form.formState.errors.passingScore !== undefined && (
                  <p
                    id="quiz-passing-score-error"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    {form.formState.errors.passingScore.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quiz-time-limit">Tiempo límite (min)</Label>
                <Input
                  id="quiz-time-limit"
                  type="number"
                  placeholder="Sin límite"
                  min={1}
                  disabled={isLoading}
                  aria-describedby={
                    form.formState.errors.timeLimitMinutes !== undefined
                      ? 'quiz-time-limit-error'
                      : undefined
                  }
                  {...form.register('timeLimitMinutes')}
                />
                {form.formState.errors.timeLimitMinutes !== undefined && (
                  <p
                    id="quiz-time-limit-error"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    {form.formState.errors.timeLimitMinutes.message}
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-md px-1 py-1">
              <Checkbox
                id="quiz-active"
                checked={form.watch('active')}
                onCheckedChange={(checked) =>
                  form.setValue('active', checked === true, { shouldValidate: true })
                }
                disabled={isLoading}
              />
              <span className="text-sm font-medium">Activo</span>
            </label>
          </div>

          {error !== '' && (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Archive Confirmation ───────────────────────────────────────────────────────

function ArchiveConfirmDialog({
  open,
  quizTitle,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  quizTitle: string;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setArchiveError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleArchive(): Promise<void> {
    setArchiving(true);
    setArchiveError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setArchiveError(err.message);
      } else {
        setArchiveError('Error al archivar');
      }
    } finally {
      setArchiving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar Evaluación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Archivar <strong>{quizTitle}</strong>? Se desactivará y no estará
            disponible para los tenants.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {archiveError !== null && (
          <p role="alert" className="text-destructive text-sm">
            {archiveError}
          </p>
        )}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleOpenChange(false);
            }}
            disabled={archiving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleArchive()}
            disabled={archiving}
          >
            {archiving ? 'Archivando...' : 'Archivar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function QuizzesPage(): JSX.Element {
  const [quizzes, setQuizzes] = useState<AdminQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<AdminQuiz | null>(null);
  const [archivingQuiz, setArchivingQuiz] = useState<AdminQuiz | null>(null);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filterParam =
        filter === 'active'
          ? { active: true }
          : filter === 'archived'
            ? { active: false }
            : undefined;
      const result = await listQuizzes(filterParam);
      setQuizzes(result.quizzes);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar pruebas');
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  const handleCreate = () => {
    setEditingQuiz(null);
    setFormOpen(true);
  };

  const handleEdit = (quiz: AdminQuiz) => {
    setEditingQuiz(quiz);
    setFormOpen(true);
  };

  const handleSave = async (data: CreateQuizParams | UpdateQuizParams) => {
    if (editingQuiz) {
      await updateQuiz(editingQuiz.id, data as UpdateQuizParams);
    } else {
      await createQuiz(data as CreateQuizParams);
    }
    await loadQuizzes();
  };

  const handleArchive = async () => {
    if (archivingQuiz) {
      await archiveQuiz(archivingQuiz.id);
      await loadQuizzes();
    }
  };

  const handleReactivate = async (quiz: AdminQuiz) => {
    await updateQuiz(quiz.id, { active: true });
    await loadQuizzes();
  };

  const getQuestionCount = (quiz: AdminQuiz): number => {
    return quiz.questions?.length ?? 0;
  };

  if (loading) {
    return <p className="text-muted-foreground p-4 text-sm">Cargando pruebas...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pruebas</h2>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Crear Prueba
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(['all', 'active', 'archived'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setFilter(f);
            }}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Archivadas'}
          </Button>
        ))}
      </div>

      {error !== '' && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {quizzes.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            {filter === 'all'
              ? 'No hay pruebas creadas.'
              : `No hay pruebas ${filter === 'active' ? 'activas' : 'archivadas'}.`}
          </p>
          {filter !== 'archived' && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={handleCreate}>
              Crear la primera prueba
            </Button>
          )}
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Preguntas</th>
                <th className="px-4 py-3 font-medium">Puntaje mín.</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz.id} className="border-border border-t">
                  <td className="px-4 py-3 font-medium">{quiz.title}</td>
                  <td className="px-4 py-3">{getQuestionCount(quiz)}</td>
                  <td className="px-4 py-3">{quiz.passingScore}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        quiz.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {quiz.active ? 'Activa' : 'Archivada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/backoffice/quizzes/${quiz.id}`}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Preguntas de ${quiz.title}`}
                        asChild
                      >
                        <span>
                          <FileQuestion className="h-4 w-4" />
                        </span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        handleEdit(quiz);
                      }}
                      aria-label={`Editar ${quiz.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {quiz.active ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setArchivingQuiz(quiz);
                        }}
                        aria-label={`Archivar ${quiz.title}`}
                      >
                        <Archive className="h-4 w-4 text-orange-600" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleReactivate(quiz)}
                        aria-label={`Reactivar ${quiz.title}`}
                      >
                        <RotateCcw className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QuizFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingQuiz={editingQuiz}
        onSave={handleSave}
      />

      <ArchiveConfirmDialog
        open={archivingQuiz !== null}
        quizTitle={archivingQuiz?.title ?? ''}
        onConfirm={handleArchive}
        onOpenChange={() => {
          setArchivingQuiz(null);
        }}
      />
    </div>
  );
}
