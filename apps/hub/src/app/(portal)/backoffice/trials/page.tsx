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
  Switch,
} from '@core/ui';
import { RotateCcw, Plus, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api/errors';
import {
  listModules,
  type AdminModule,
} from '@/modules/backoffice/modulo-admin/services/module-admin.service';
import {
  listProducts,
  updateProduct,
  listTrials,
  grantTrial,
  resetTrial,
  extendTrial,
  type AdminProduct,
  type TrialEntry,
} from '@/modules/backoffice/productos/index';
import {
  listTenants,
  type AdminTenantListItem,
} from '@/modules/backoffice/tenants/services/tenant-admin.service';

const WHOLE_PRODUCT = '__whole_product__';
const TRIAL_DURATION_OPTIONS = [15, 30, 60, 90];

// ─── Grant Trial Dialog ─────────────────────────────────────────────────────────

function GrantTrialDialog({
  open,
  onOpenChange,
  product,
  onGranted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProduct | undefined;
  onGranted: () => void;
}): JSX.Element {
  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [modules, setModules] = useState<AdminModule[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [moduleId, setModuleId] = useState(WHOLE_PRODUCT);
  const [durationDays, setDurationDays] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const productId = product?.id;
  const defaultDuration = product?.trialDurationDays ?? 14;

  useEffect(() => {
    if (!open || productId === undefined) return;

    setError('');
    setTenantId('');
    setModuleId(WHOLE_PRODUCT);
    setDurationDays(String(defaultDuration));

    void Promise.all([listTenants({ pageSize: 100 }), listModules(productId)])
      .then(([tenantPage, moduleResult]) => {
        setTenants(tenantPage.items);
        // Only the product's own modules can be granted — a trial never crosses
        // the product boundary.
        setModules(moduleResult.modules.filter((m) => m.active));
      })
      .catch(() => {
        setError('No se pudieron cargar tenants o módulos');
      });
  }, [open, productId, defaultDuration]);

  async function handleGrant(): Promise<void> {
    if (productId === undefined || tenantId === '') return;
    setIsSaving(true);
    setError('');
    try {
      await grantTrial(tenantId, {
        productId,
        moduleId: moduleId === WHOLE_PRODUCT ? undefined : moduleId,
        durationDays: Number(durationDays),
      });
      toast.success('Trial creado');
      onGranted();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el trial');
    } finally {
      setIsSaving(false);
    }
  }

  const durationIsValid = Number(durationDays) >= 1 && Number(durationDays) <= 365;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear trial</DialogTitle>
          <DialogDescription>
            Otorga acceso temporal a {product?.name ?? 'el producto'} para un tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trial-tenant">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId} disabled={isSaving}>
              <SelectTrigger id="trial-tenant">
                <SelectValue placeholder="Elegí un tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trial-scope">Alcance</Label>
            <Select value={moduleId} onValueChange={setModuleId} disabled={isSaving}>
              <SelectTrigger id="trial-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WHOLE_PRODUCT}>Producto completo</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trial-duration">Duración (días)</Label>
            <Input
              id="trial-duration"
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => {
                setDurationDays(e.target.value);
              }}
              disabled={isSaving}
            />
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
              onOpenChange(false);
            }}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleGrant();
            }}
            disabled={isSaving || tenantId === '' || !durationIsValid}
          >
            {isSaving ? 'Creando...' : 'Crear trial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function TrialsPage(): JSX.Element {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState('');
  const [trials, setTrials] = useState<TrialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    void listProducts()
      .then((result) => {
        setProducts(result);
        setProductId((current) => (current === '' ? (result[0]?.id ?? '') : current));
      })
      .catch(() => {
        toast.error('No se pudieron cargar los productos');
      });
  }, []);

  const loadTrials = useCallback(async () => {
    if (productId === '') return;
    setLoading(true);
    try {
      setTrials(await listTrials(productId));
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error al cargar trials');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadTrials();
  }, [loadTrials]);

  async function patchProduct(patch: Partial<AdminProduct>): Promise<void> {
    if (selectedProduct === undefined) return;
    setSavingProduct(true);
    try {
      await updateProduct(selectedProduct.id, patch);
      setProducts((prev) => prev.map((p) => (p.id === selectedProduct.id ? { ...p, ...patch } : p)));
      toast.success('Actualizado');
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSavingProduct(false);
    }
  }

  async function runAction(id: string, action: () => Promise<void>, message: string): Promise<void> {
    setActionId(id);
    try {
      await action();
      toast.success(message);
      await loadTrials();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Trials</h2>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Producto" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          disabled={selectedProduct === undefined}
          onClick={() => {
            setGrantOpen(true);
          }}
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          Crear trial
        </Button>
      </div>

      {/* Per-product trial settings live here, next to the trials they govern —
          the Productos section is about the product and its modules. */}
      {selectedProduct !== undefined && (
        <div className="border-border bg-muted/30 mb-6 flex flex-wrap items-center gap-6 rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2">
            <Switch
              id="trial-enabled"
              checked={selectedProduct.trialEnabled}
              disabled={savingProduct}
              onCheckedChange={(checked) => {
                void patchProduct({ trialEnabled: checked });
              }}
            />
            <Label htmlFor="trial-enabled">Trials habilitados</Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="trial-default-duration">Duración por defecto</Label>
            <Select
              value={String(selectedProduct.trialDurationDays)}
              disabled={savingProduct || !selectedProduct.trialEnabled}
              onValueChange={(value) => {
                void patchProduct({ trialDurationDays: Number(value) });
              }}
            >
              <SelectTrigger id="trial-default-duration" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIAL_DURATION_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {days} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground p-4 text-sm">Cargando...</p>
      ) : trials.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay trials activos.</p>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Módulo</th>
                <th className="px-4 py-3 font-medium">Consumido</th>
                <th className="px-4 py-3 font-medium">Restante</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-border border-t">
                  <td className="px-4 py-3 font-mono text-xs">{t.tenantId.slice(0, 8)}...</td>
                  <td className="px-4 py-3">{t.moduleName ?? 'Producto completo'}</td>
                  <td className="px-4 py-3">{t.consumedDays ?? '—'} días</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        t.remainingDays !== null && t.remainingDays <= 3
                          ? 'font-medium text-red-600'
                          : ''
                      }
                    >
                      {t.remainingDays ?? '—'} días
                    </span>
                  </td>
                  <td className="space-x-1 px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionId === t.id}
                      onClick={() => {
                        void runAction(t.id, () => extendTrial(t.id, 15), '+15 días');
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      15
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionId === t.id}
                      onClick={() => {
                        void runAction(t.id, () => extendTrial(t.id, 30), '+30 días');
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      30
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Resetear trial"
                      disabled={actionId === t.id}
                      onClick={() => {
                        void runAction(t.id, () => resetTrial(t.id), 'Trial reseteado');
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GrantTrialDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        product={selectedProduct}
        onGranted={() => {
          void loadTrials();
        }}
      />
    </div>
  );
}
