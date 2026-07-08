'use client';

import {
  Button,
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '@/lib/api/errors';
import {
  moduleFormSchema,
  type ModuleFormData,
} from '@/modules/backoffice/modulo-admin/lib/module-schema';
import {
  listModules,
  createModule,
  updateModule,
  deleteModule,
  type AdminModule,
  type CreateModuleParams,
  type UpdateModuleParams,
} from '@/modules/backoffice/modulo-admin/services/module-admin.service';

// ─── Module Form Dialog ────────────────────────────────────────────────────────

function ModuleFormDialog({
  open,
  onOpenChange,
  editingModule,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingModule: AdminModule | null;
  onSave: (data: CreateModuleParams | UpdateModuleParams) => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<ModuleFormData>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: {
      id: '',
      name: '',
      description: '',
      defaultUrl: '/',
    },
  });

  const isEditing = editingModule !== null;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingModule) {
        form.reset({
          id: editingModule.id,
          name: editingModule.name,
          description: editingModule.description ?? '',
          defaultUrl: editingModule.defaultUrl,
        });
      } else {
        form.reset({
          id: '',
          name: '',
          description: '',
          defaultUrl: '/',
        });
      }
      setError('');
    }
  }, [open, editingModule, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError('');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(data: ModuleFormData): Promise<void> {
    setIsLoading(true);
    setError('');
    try {
      if (isEditing) {
        await onSave({
          name: data.name.trim(),
          description: data.description?.trim() ?? undefined,
        });
      } else {
        await onSave({
          id: data.id.trim(),
          name: data.name.trim(),
          description: data.description?.trim() ?? undefined,
          defaultUrl: data.defaultUrl.trim() || '/',
        });
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
          <DialogTitle>
            {isEditing ? 'Editar Módulo' : 'Crear Módulo'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modificá los datos del módulo.'
              : 'Completá los datos del nuevo módulo.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
          noValidate
        >
          <div className="space-y-4">
            {!isEditing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="module-id">ID del módulo</Label>
                <Input
                  id="module-id"
                  placeholder="e.g., billing"
                  disabled={isLoading}
                  aria-describedby={
                    form.formState.errors.id !== undefined ? 'module-id-error' : undefined
                  }
                  {...form.register('id')}
                />
                {form.formState.errors.id !== undefined && (
                  <p id="module-id-error" role="alert" className="text-destructive text-xs">
                    {form.formState.errors.id.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="module-name">Nombre</Label>
              <Input
                id="module-name"
                placeholder="Nombre del módulo"
                disabled={isLoading}
                aria-describedby={
                  form.formState.errors.name !== undefined
                    ? 'module-name-error'
                    : undefined
                }
                {...form.register('name')}
              />
              {form.formState.errors.name !== undefined && (
                <p id="module-name-error" role="alert" className="text-destructive text-xs">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="module-description">Descripción</Label>
              <Input
                id="module-description"
                placeholder="Descripción (opcional)"
                disabled={isLoading}
                {...form.register('description')}
              />
            </div>

            {!isEditing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="module-default-url">URL por defecto</Label>
                <Input
                  id="module-default-url"
                  placeholder="/"
                  disabled={isLoading}
                  aria-describedby={
                    form.formState.errors.defaultUrl !== undefined
                      ? 'module-default-url-error'
                      : undefined
                  }
                  {...form.register('defaultUrl')}
                />
                {form.formState.errors.defaultUrl !== undefined && (
                  <p
                    id="module-default-url-error"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    {form.formState.errors.defaultUrl.message}
                  </p>
                )}
              </div>
            )}
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
              onClick={() => { handleOpenChange(false); }}
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

// ─── Delete Confirmation ───────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  moduleName,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  moduleName: string;
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
          <AlertDialogTitle>Eliminar Módulo</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar <strong>{moduleName}</strong>? Esta
            acción no se puede deshacer.
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
            onClick={() => { handleOpenChange(false); }}
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ModulesPage(): JSX.Element {
  const [modules, setModules] = useState<AdminModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<AdminModule | null>(null);
  const [deletingModule, setDeletingModule] = useState<AdminModule | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listModules();
      setModules(result.modules);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar módulos');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const handleCreate = () => {
    setEditingModule(null);
    setFormOpen(true);
  };

  const handleEdit = (mod: AdminModule) => {
    setEditingModule(mod);
    setFormOpen(true);
  };

  const handleSave = async (data: CreateModuleParams | UpdateModuleParams) => {
    if (editingModule) {
      await updateModule(editingModule.id, data as UpdateModuleParams);
    } else {
      await createModule(data as CreateModuleParams);
    }
    await loadModules();
  };

  const handleDelete = async () => {
    if (deletingModule) {
      await deleteModule(deletingModule.id);
      await loadModules();
    }
  };

  if (loading) {
    return <p className="text-muted-foreground p-4 text-sm">Cargando módulos...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Módulos</h2>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Crear Módulo
        </Button>
      </div>

      {error !== '' && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {modules.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">No hay módulos configurados.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={handleCreate}>
            Crear el primer módulo
          </Button>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod.id} className="border-border border-t">
                  <td className="px-4 py-3 font-mono text-xs">{mod.id}</td>
                  <td className="px-4 py-3">{mod.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        mod.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {mod.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { handleEdit(mod); }}
                      aria-label={`Editar ${mod.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setDeletingModule(mod); }}
                      aria-label={`Eliminar ${mod.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingModule={editingModule}
        onSave={handleSave}
      />

      <DeleteConfirmDialog
        open={deletingModule !== null}
        moduleName={deletingModule?.name ?? ''}
        onConfirm={handleDelete}
        onOpenChange={() => { setDeletingModule(null); }}
      />
    </div>
  );
}
