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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Archive, RotateCcw, Puzzle, GripVertical, Star } from 'lucide-react';
import { useCallback, useEffect, useState, useMemo, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ModuleTransfer } from '@/components/module-transfer';
import { ApiError } from '@/lib/api/errors';
import {
  listModules,
  getPlanModules,
  setPlanModules,
  type AdminModule,
} from '@/modules/backoffice/modulo-admin/services/module-admin.service';
import { planFormSchema, type PlanFormData } from '@/modules/backoffice/planes/lib/plan-schema';
import {
  listPlans,
  createPlan,
  updatePlan,
  archivePlan,
  reorderPlans,
  savePlanQuotas,
  getPlanQuotas,
  type AdminPlan,
  type CreatePlanParams,
  type UpdatePlanParams,
} from '@/modules/backoffice/planes/services/plan-admin.service';

// ─── Plan Form Dialog ──────────────────────────────────────────────────────────

function PlanFormDialog({
  open,
  onOpenChange,
  editingPlan,
  onSave,
  productId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPlan: AdminPlan | null;
  onSave: (data: CreatePlanParams | UpdatePlanParams) => Promise<string>;
  productId: string;
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
        ...(editingPlan ? {} : { productId }),
      };
      const planId = await onSave(params);

      // Build quotas array from form fields (skip empty/zero = unlimited)
      const quotas: { resourceType: string; limit: number; period: string }[] = [];
      if (data.deepseekTokensLimit != null && data.deepseekTokensLimit > 0) {
        quotas.push({
          resourceType: 'deepseek_tokens',
          limit: data.deepseekTokensLimit,
          period: 'month',
        });
      }
      if (data.falImagesLimit != null && data.falImagesLimit > 0) {
        quotas.push({ resourceType: 'fal_images', limit: data.falImagesLimit, period: 'month' });
      }
      if (data.chatSessionsLimit != null && data.chatSessionsLimit > 0) {
        quotas.push({
          resourceType: 'chat_sessions',
          limit: data.chatSessionsLimit,
          period: 'month',
        });
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
            {editingPlan ? 'Modificá los datos del plan.' : 'Completá los datos del nuevo plan.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)} noValidate>
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
                    form.formState.errors.currency !== undefined ? 'currency-error' : undefined
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
                onValueChange={(value) => {
                  form.setValue('billingInterval', value as 'month' | 'year', {
                    shouldValidate: true,
                  });
                }}
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
                <p className="text-muted-foreground mt-0.5 text-xs">Dejar vacío o 0 = ilimitado</p>
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
            ¿Archivar <strong>{planName}</strong>? Los tenants que lo usan mantendrán el acceso.
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

// ─── Sortable Plan Row ─────────────────────────────────────────────────────────

function SortablePlanRow({
  plan,
  moduleCount,
  onModules,
  onEdit,
  onArchive,
  onReactivate,
  onSetDefault,
  isSettingDefault,
}: {
  plan: AdminPlan;
  moduleCount: number;
  onModules: (plan: AdminPlan) => void;
  onEdit: (plan: AdminPlan) => void;
  onArchive: (plan: AdminPlan) => void;
  onReactivate: (plan: AdminPlan) => void;
  onSetDefault: (plan: AdminPlan) => void;
  isSettingDefault: boolean;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
  });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-border border-t ${isDragging ? 'bg-muted relative z-10' : ''}`}
    >
      <td className="w-10 px-2 py-3">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Reordenar ${plan.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium">
        <span className="flex items-center gap-2">
          {plan.name}
          {plan.isDefault && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              Predeterminado
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        {plan.price.toLocaleString()} {plan.currency}
      </td>
      <td className="px-4 py-3">{plan.billingInterval === 'month' ? 'Mensual' : 'Anual'}</td>
      <td className="px-4 py-3">{plan.tenantCount}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            plan.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {plan.active ? 'Activo' : 'Archivado'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={plan.isDefault || isSettingDefault || !plan.active}
            onClick={() => {
              onSetDefault(plan);
            }}
            aria-label={`Marcar ${plan.name} como predeterminado`}
            title={plan.active ? 'Marcar como predeterminado' : 'Un plan archivado no puede ser el predeterminado'}
          >
            <Star className={`h-4 w-4 ${plan.isDefault ? 'fill-primary text-primary' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onModules(plan);
            }}
            aria-label={`Módulos de ${plan.name}`}
          >
            <Puzzle className="h-4 w-4" />
            {moduleCount > 0 && (
              <span className="bg-primary text-primary-foreground absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                {moduleCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              onEdit(plan);
            }}
            aria-label={`Editar ${plan.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {plan.active ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                onArchive(plan);
              }}
              aria-label={`Archivar ${plan.name}`}
            >
              <Archive className="h-4 w-4 text-orange-600" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                onReactivate(plan);
              }}
              aria-label={`Reactivar ${plan.name}`}
            >
              <RotateCcw className="h-4 w-4 text-green-600" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Module Assignment Dialog ──────────────────────────────────────────────────

function ModuleAssignmentDialog({
  open,
  planId,
  planName,
  productId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  planId: string;
  planName: string;
  /** Only modules of the plan's own product can be assigned to it. */
  productId: string | undefined;
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
        listModules(productId),
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
        const modulesResult = await listModules(productId);
        setAllModules(modulesResult.modules);
      } catch {
        // Modules couldn't load either — UI will show error
      }
    } finally {
      setIsLoadingModules(false);
    }
  }, [planId, productId]);

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
      const message = err instanceof ApiError ? err.message : 'Error al guardar módulos';
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
          <DialogDescription>Seleccioná los módulos para este plan.</DialogDescription>
        </DialogHeader>

        {isLoadingModules ? (
          <div className="space-y-3 py-2">
            <div className="bg-muted h-10 animate-pulse rounded-md" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="bg-muted h-5 w-24 animate-pulse rounded" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted h-[52px] animate-pulse rounded-md" />
                ))}
              </div>
              <div className="space-y-2">
                <div className="bg-muted h-5 w-24 animate-pulse rounded" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted h-[52px] animate-pulse rounded-md" />
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
          <ModuleTransfer
            available={availableModules}
            assigned={assignedModules}
            onAssign={addModule}
            onUnassign={removeModule}
            className="mt-2"
          />
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
          <Button type="button" onClick={() => void handleSave()} disabled={disabled}>
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
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [archivingPlan, setArchivingPlan] = useState<AdminPlan | null>(null);
  const [moduleDialogPlan, setModuleDialogPlan] = useState<AdminPlan | null>(null);
  const [productFilter, setProductFilter] = useState('instagram-dashboard');

  const PRODUCTS = useMemo(() => [{ id: 'instagram-dashboard', name: 'Dashboard Instagram' }], []);

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
        listPlans({ ...filterParam, productId: productFilter }),
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
  }, [filter, productFilter]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // Drag and drop ordering. The list is optimistic: on failure it reloads, so a
  // rejected reorder never leaves the table showing an order the server refused.
  // ponytail: reordering a filtered view ranks only the visible plans — archived
  // ones keep their old rank. Harmless today (the wizard only lists active plans).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;

    const oldIndex = plans.findIndex((p) => p.id === active.id);
    const newIndex = plans.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(plans, oldIndex, newIndex);
    setPlans(reordered);

    try {
      await reorderPlans(reordered.map((p) => p.id));
      toast.success('Orden actualizado');
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el orden');
      await loadPlans();
    }
  }

  async function handleSetDefault(plan: AdminPlan): Promise<void> {
    setSettingDefaultId(plan.id);
    try {
      await updatePlan(plan.id, { isDefault: true });
      // One default per product — the server demoted the others, mirror it here.
      setPlans((prev) => prev.map((p) => ({ ...p, isDefault: p.id === plan.id })));
      toast.success(`${plan.name} es el plan predeterminado`);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo marcar como predeterminado');
    } finally {
      setSettingDefaultId(null);
    }
  }

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
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Producto:</h2>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            onClick={() => {
              setFilter(f);
            }}
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="w-10 px-2 py-3" aria-label="Reordenar" />
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Ciclo</th>
                <th className="px-4 py-3 font-medium">Tenants</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <SortableContext
                items={plans.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {plans.map((plan) => (
                  <SortablePlanRow
                    key={plan.id}
                    plan={plan}
                    moduleCount={planModules.get(plan.id)?.count ?? 0}
                    onModules={setModuleDialogPlan}
                    onEdit={handleEdit}
                    onArchive={setArchivingPlan}
                    onReactivate={(plan) => {
                      void handleReactivate(plan);
                    }}
                    onSetDefault={(plan) => {
                      void handleSetDefault(plan);
                    }}
                    isSettingDefault={settingDefaultId !== null}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
          </DndContext>
        </div>
      )}

      <PlanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingPlan={editingPlan}
        onSave={handleSave}
        productId={productFilter}
      />

      <ArchiveConfirmDialog
        open={archivingPlan !== null}
        planName={archivingPlan?.name ?? ''}
        onConfirm={handleArchive}
        onOpenChange={() => {
          setArchivingPlan(null);
        }}
      />

      <ModuleAssignmentDialog
        open={moduleDialogPlan !== null}
        planId={moduleDialogPlan?.id ?? ''}
        planName={moduleDialogPlan?.name ?? ''}
        productId={moduleDialogPlan?.productId ?? undefined}
        onOpenChange={() => {
          setModuleDialogPlan(null);
        }}
        onSaved={(moduleIds, allModules) => {
          const names = moduleIds
            .map((id) => allModules.find((m) => m.id === id)?.name ?? id)
            .slice(0, 3);
          setPlanModulesMap((prev) => {
            const next = new Map(prev);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- onSaved only fires while the dialog is open, so moduleDialogPlan is non-null
            next.set(moduleDialogPlan!.id, { count: moduleIds.length, names });
            return next;
          });
        }}
      />
    </div>
  );
}
