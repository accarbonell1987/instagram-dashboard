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
} from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Archive, RotateCcw, Search, X, Puzzle } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api/errors';
import { planFormSchema, type PlanFormData } from '@/modules/backoffice/planes/lib/plan-schema';
import {
  listPlans,
  createPlan,
  updatePlan,
  archivePlan,
  savePlanQuotas,
  getPlanQuotas,
  type AdminPlan,
  type CreatePlanParams,
  type UpdatePlanParams,
} from '@/modules/backoffice/planes/services/plan-admin.service';
import {
  listModules,
  getPlanModules,
  setPlanModules,
  type AdminModule,
} from '@/modules/backoffice/modulo-admin/services/module-admin.service';

// ─── Plan Form Dialog ──────────────────────────────────────────────────────────

function PlanFormDialog({
  open,
  onOpenChange,
  editingPlan,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPlan: AdminPlan | null;
  onSave: (data: CreatePlanParams | UpdatePlanParams) => Promise<string>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      currency: 'PYG',
      billingInterval: 'month',
      deepseekTokensLimit: undefined,
      falImagesLimit: undefined,
      chatSessionsLimit: undefined,
    },
  });

  // Reset form when dialog opens with a plan to edit
  useEffect(() => {
    if (open) {
      if (editingPlan) {
        form.reset({
          name: editingPlan.name,
          description: editingPlan.description ?? '',
          price: editingPlan.price,
          currency: editingPlan.currency,
          billingInterval: editingPlan.billingInterval as 'month' | 'year',
          deepseekTokensLimit: undefined,
          falImagesLimit: undefined,
          chatSessionsLimit: undefined,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          price: 0,
          currency: 'PYG',
          billingInterval: 'month',
          deepseekTokensLimit: undefined,
          falImagesLimit: undefined,
          chatSessionsLimit: undefined,
        });
      }
      setError('');
    }
  }, [open, editingPlan, form]);

  // Pre-populate quota fields when editing an existing plan
  useEffect(() => {
    if (open && editingPlan) {
      getPlanQuotas(editingPlan.id)
        .then((quotas) => {
          const deepseekQuota = quotas.find((q) => q.resourceType === 'deepseek_tokens');
          const falQuota = quotas.find((q) => q.resourceType === 'fal_images');
          const chatQuota = quotas.find((q) => q.resourceType === 'chat_sessions');
          form.setValue('deepseekTokensLimit', deepseekQuota?.limit);
          form.setValue('falImagesLimit', falQuota?.limit);
          form.setValue('chatSessionsLimit', chatQuota?.limit);
        })
        .catch(() => {
          // Quota fetch is best-effort — plan edit still works
        });
    }
  }, [open, editingPlan, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError('');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(data: PlanFormData): Promise<void> {
    setIsLoading(true);
    setError('');
    try {
      const params = {
        name: data.name.trim(),
        description: data.description?.trim() ?? undefined,
        price: data.price,
        currency: data.currency,
        billingInterval: data.billingInterval,
      };
      const planId = await onSave(params);

      // Build quotas array from form fields (skip empty/zero = unlimited)
      const quotas: Array<{ resourceType: string; limit: number; period: string }> = [];
      if (data.deepseekTokensLimit != null && data.deepseekTokensLimit > 0) {
        quotas.push({ resourceType: 'deepseek_tokens', limit: data.deepseekTokensLimit, period: 'month' });
      }
      if (data.falImagesLimit != null && data.falImagesLimit > 0) {
        quotas.push({ resourceType: 'fal_images', limit: data.falImagesLimit, period: 'month' });
      }
      if (data.chatSessionsLimit != null && data.chatSessionsLimit > 0) {
        quotas.push({ resourceType: 'chat_sessions', limit: data.chatSessionsLimit, period: 'month' });
      }

      if (quotas.length > 0) {
        await savePlanQuotas(planId, quotas);
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
          <DialogTitle>{editingPlan ? 'Editar Plan' : 'Crear Plan'}</DialogTitle>
          <DialogDescription>
            {editingPlan
              ? 'Modificá los datos del plan.'
              : 'Completá los datos del nuevo plan.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
          noValidate
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Nombre del plan"
                disabled={isLoading}
                aria-describedby={
                  form.formState.errors.name !== undefined ? 'name-error' : undefined
                }
                {...form.register('name')}
              />
              {form.formState.errors.name !== undefined && (
                <p id="name-error" role="alert" className="text-destructive text-xs">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descripción (opcional)"
                disabled={isLoading}
                {...form.register('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  min={0}
                  step="0.01"
                  disabled={isLoading}
                  aria-describedby={
                    form.formState.errors.price !== undefined ? 'price-error' : undefined
                  }
                  {...form.register('price')}
                />
                {form.formState.errors.price !== undefined && (
                  <p id="price-error" role="alert" className="text-destructive text-xs">
                    {form.formState.errors.price.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currency">Moneda</Label>
                <Input
                  id="currency"
                  disabled={isLoading}
                  aria-describedby={
                    form.formState.errors.currency !== undefined
                      ? 'currency-error'
                      : undefined
                  }
                  {...form.register('currency')}
                />
                {form.formState.errors.currency !== undefined && (
                  <p id="currency-error" role="alert" className="text-destructive text-xs">
                    {form.formState.errors.currency.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="billingInterval">Ciclo de facturación</Label>
              <Select
                value={form.watch('billingInterval')}
                onValueChange={(value) =>
                  { form.setValue('billingInterval', value as 'month' | 'year', {
                    shouldValidate: true,
                  }); }
                }
                disabled={isLoading}
              >
                <SelectTrigger id="billingInterval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensual</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quota section */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Cuotas de IA</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dejar vacío o 0 = ilimitado
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="deepseekTokensLimit" className="text-xs">
                    Tokens DeepSeek / mes
                  </Label>
                  <Input
                    id="deepseekTokensLimit"
                    type="number"
                    min={0}
                    placeholder="Ej: 100000"
                    disabled={isLoading}
                    {...form.register('deepseekTokensLimit', { valueAsNumber: true })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="falImagesLimit" className="text-xs">
                    Imágenes fal.ai / mes
                  </Label>
                  <Input
                    id="falImagesLimit"
                    type="number"
                    min={0}
                    placeholder="Ej: 50"
                    disabled={isLoading}
                    {...form.register('falImagesLimit', { valueAsNumber: true })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="chatSessionsLimit" className="text-xs">
                    Scripts / mes
                  </Label>
                  <Input
                    id="chatSessionsLimit"
                    type="number"
                    min={0}
                    placeholder="Ej: 30"
                    disabled={isLoading}
                    {...form.register('chatSessionsLimit', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
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

// ─── Archive Confirmation ──────────────────────────────────────────────────────

function ArchiveConfirmDialog({
  open,
  planName,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  planName: string;
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
          <AlertDialogTitle>Archivar Plan</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Archivar <strong>{planName}</strong>? Los tenants que lo usan mantendrán el
            acceso.
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
            onClick={() => { handleOpenChange(false); }}
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

// ─── Module Assignment Dialog ──────────────────────────────────────────────────

function ModuleAssignmentDialog({
  open,
  planId,
  planName,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  planId: string;
  planName: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: ((moduleIds: string[], allModules: AdminModule[]) => void) | undefined;
}) {
  const [allModules, setAllModules] = useState<AdminModule[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadModulesData = useCallback(async () => {
    setIsLoadingModules(true);
    setLoadError('');
    try {
      const [modulesResult, planModulesResult] = await Promise.all([
        listModules(),
        getPlanModules(planId).catch(() => ({ moduleIds: [] as string[] })),
      ]);
      setAllModules(modulesResult.modules);
      setSelectedIds(planModulesResult.moduleIds);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setLoadError(err.message);
      } else {
        setLoadError('Error al cargar módulos');
      }
      try {
        const modulesResult = await listModules();
        setAllModules(modulesResult.modules);
      } catch {
        // Modules couldn't load either — UI will show error
      }
    } finally {
      setIsLoadingModules(false);
    }
  }, [planId]);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      void loadModulesData();
    }
  }, [open, loadModulesData]);

  function addModule(id: string) {
    setSelectedIds((prev) => [...prev, id]);
  }

  function removeModule(id: string) {
    setSelectedIds((prev) => prev.filter((pid) => pid !== id));
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    try {
      await setPlanModules(planId, selectedIds);
      toast.success('Módulos actualizados');
      onSaved?.(selectedIds, allModules);
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Error al guardar módulos';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const disabled = isLoadingModules || isSaving;
  const query = searchQuery.toLowerCase();
  const assignedModules = allModules.filter(
    (m) =>
      selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
  );
  const availableModules = allModules.filter(
    (m) =>
      !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Módulos — {planName}</DialogTitle>
          <DialogDescription>
            Seleccioná los módulos para este plan.
          </DialogDescription>
        </DialogHeader>

        {isLoadingModules ? (
          <div className="space-y-3 py-2">
            <div className="bg-muted h-10 animate-pulse rounded-md" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="bg-muted h-5 w-24 animate-pulse rounded" />
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted h-[52px] animate-pulse rounded-md"
                  />
                ))}
              </div>
              <div className="space-y-2">
                <div className="bg-muted h-5 w-24 animate-pulse rounded" />
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted h-[52px] animate-pulse rounded-md"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : loadError !== '' ? (
          <div className="py-4 text-center">
            <p role="alert" className="text-destructive text-sm">
              {loadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void loadModulesData()}
            >
              Reintentar
            </Button>
          </div>
        ) : allModules.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No hay módulos configurados.
          </p>
        ) : (
          <>
            {/* Search bar */}
            <div className="relative">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar módulo..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                className="pl-9"
                disabled={disabled}
              />
            </div>

            {/* Dual list */}
            <div className="grid grid-cols-2 gap-4">
              {/* Assigned column */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ASIGNADOS ({assignedModules.length})
                </h4>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {assignedModules.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      Sin módulos asignados
                    </p>
                  ) : (
                    assignedModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{mod.name}</p>
                          <p className="text-muted-foreground text-xs font-mono">
                            {mod.id}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            removeModule(mod.id);
                          }}
                          disabled={disabled}
                          aria-label={`Quitar ${mod.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Available column */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  DISPONIBLES ({availableModules.length})
                </h4>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {availableModules.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      Todos los módulos asignados
                    </p>
                  ) : (
                    availableModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{mod.name}</p>
                          <p className="text-muted-foreground text-xs font-mono">
                            {mod.id}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            addModule(mod.id);
                          }}
                          disabled={disabled}
                          aria-label={`Agregar ${mod.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={disabled}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={disabled}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage(): JSX.Element {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [planModules, setPlanModulesMap] = useState<
    Map<string, { count: number; names: string[] }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [archivingPlan, setArchivingPlan] = useState<AdminPlan | null>(null);
  const [moduleDialogPlan, setModuleDialogPlan] = useState<AdminPlan | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filterParam =
        filter === 'active'
          ? { active: true }
          : filter === 'archived'
            ? { active: false }
            : undefined;
      const [plansResult, modulesResult] = await Promise.all([
        listPlans(filterParam),
        listModules(),
      ]);
      setPlans(plansResult.plans);

      const entries = await Promise.all(
        plansResult.plans.map(async (plan) => {
          try {
            const { moduleIds } = await getPlanModules(plan.id);
            const names = moduleIds
              .map((id) => modulesResult.modules.find((m) => m.id === id)?.name ?? id)
              .slice(0, 3);
            return [plan.id, { count: moduleIds.length, names }] as const;
          } catch {
            return [plan.id, { count: 0, names: [] as string[] }] as const;
          }
        })
      );
      setPlanModulesMap(new Map(entries));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar planes');
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleCreate = () => {
    setEditingPlan(null);
    setFormOpen(true);
  };

  const handleEdit = (plan: AdminPlan) => {
    setEditingPlan(plan);
    setFormOpen(true);
  };

  const handleSave = async (data: CreatePlanParams | UpdatePlanParams): Promise<string> => {
    if (editingPlan) {
      const updated = await updatePlan(editingPlan.id, data as UpdatePlanParams);
      await loadPlans();
      return updated.id;
    } else {
      const created = await createPlan(data as CreatePlanParams);
      await loadPlans();
      return created.id;
    }
  };

  const handleArchive = async () => {
    if (archivingPlan) {
      await archivePlan(archivingPlan.id);
      await loadPlans();
    }
  };

  const handleReactivate = async (plan: AdminPlan) => {
    await updatePlan(plan.id, { active: true });
    await loadPlans();
  };

  if (loading) {
    return <p className="text-muted-foreground p-4 text-sm">Cargando planes...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planes</h2>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Crear Plan
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(['all', 'active', 'archived'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setFilter(f); }}
          >
            {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Archivados'}
          </Button>
        ))}
      </div>

      {error !== '' && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {plans.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            {filter === 'all'
              ? 'No hay planes configurados.'
              : `No hay planes ${filter === 'active' ? 'activos' : 'archivados'}.`}
          </p>
          {filter !== 'archived' && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={handleCreate}>
              Crear el primer plan
            </Button>
          )}
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Ciclo</th>
                <th className="px-4 py-3 font-medium">Tenants</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-border border-t">
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3">
                    {plan.price.toLocaleString()} {plan.currency}
                  </td>
                  <td className="px-4 py-3">
                    {plan.billingInterval === 'month' ? 'Mensual' : 'Anual'}
                  </td>
                  <td className="px-4 py-3">{plan.tenantCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {plan.active ? 'Activo' : 'Archivado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setModuleDialogPlan(plan); }}
                        aria-label={`Módulos de ${plan.name}`}
                      >
                        <Puzzle className="h-4 w-4" />
                        {(planModules.get(plan.id)?.count ?? 0) > 0 && (
                          <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {planModules.get(plan.id)?.count}
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                      onClick={() => { handleEdit(plan); }}
                      aria-label={`Editar ${plan.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {plan.active ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setArchivingPlan(plan); }}
                        aria-label={`Archivar ${plan.name}`}
                      >
                        <Archive className="h-4 w-4 text-orange-600" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleReactivate(plan)}
                        aria-label={`Reactivar ${plan.name}`}
                      >
                        <RotateCcw className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingPlan={editingPlan}
        onSave={handleSave}
      />

      <ArchiveConfirmDialog
        open={archivingPlan !== null}
        planName={archivingPlan?.name ?? ''}
        onConfirm={handleArchive}
        onOpenChange={() => { setArchivingPlan(null); }}
      />

      <ModuleAssignmentDialog
        open={moduleDialogPlan !== null}
        planId={moduleDialogPlan?.id ?? ''}
        planName={moduleDialogPlan?.name ?? ''}
        onOpenChange={() => { setModuleDialogPlan(null); }}
        onSaved={(moduleIds, allModules) => {
          const names = moduleIds
            .map((id) => allModules.find((m) => m.id === id)?.name ?? id)
            .slice(0, 3);
          setPlanModulesMap((prev) => {
            const next = new Map(prev);
            next.set(moduleDialogPlan!.id, { count: moduleIds.length, names });
            return next;
          });
        }}
      />
    </div>
  );
}
