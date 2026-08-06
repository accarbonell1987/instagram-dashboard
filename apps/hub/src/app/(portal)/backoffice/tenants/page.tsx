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
  Textarea,
} from '@core/ui';
import { useCallback, useEffect, useState, type JSX } from 'react';

import { ApiError } from '@/lib/api/errors';
import {
  listTenantPayments,
  type AdminPayment,
  type AdminPaymentStatus,
} from '@/modules/backoffice/payments';
import {
  listTenants,
  getTenant,
  changeTenantStatus,
  type AdminTenantListItem,
  type AdminTenantDetail,
  type TenantStatus,
} from '@/modules/backoffice/tenants/services/tenant-admin.service';

// ─── Payment labels ─────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bancard: 'Bancard',
  bank_transfer: 'Transferencia bancaria',
};

const SETTLEMENT_KIND_LABELS: Record<string, string> = {
  webhook: 'Automático (pasarela)',
  agent: 'Revisión del agente',
  manual_admin: 'Activación manual',
};

const PAYMENT_STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  approved: 'Aprobado',
  declined: 'Rechazado',
  cancelled: 'Cancelado',
  timeout: 'Expirado',
};

function formatPaymentDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TenantStatus }) {
  const colors: Record<TenantStatus, string> = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-orange-100 text-orange-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  const labels: Record<TenantStatus, string> = {
    active: 'Activo',
    suspended: 'Suspendido',
    pending: 'Pendiente',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// ─── Tenant Payments Section ────────────────────────────────────────────────────

function TenantPaymentsSection({ tenantId }: { tenantId: string }): JSX.Element {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listTenantPayments(tenantId)
      .then((result) => {
        if (!cancelled) setPayments(result.items);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los pagos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <div className="border-border border-t pt-4">
      <p className="text-muted-foreground mb-2 text-xs">Pagos</p>
      {loading ? (
        <p className="text-muted-foreground text-xs">Cargando pagos...</p>
      ) : error !== '' ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : payments.length === 0 ? (
        <p className="text-muted-foreground text-xs">Todavía no hay pagos.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {payments.map((payment) => (
            <li key={payment.id} className="border-border rounded-md border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {payment.amount.toLocaleString()} {payment.currency}
                </span>
                <span className="text-muted-foreground">{formatPaymentDate(payment.createdAt)}</span>
              </div>
              <div className="text-muted-foreground mt-1">
                {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method} ·{' '}
                {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                {payment.settlementKind != null &&
                  ` · ${SETTLEMENT_KIND_LABELS[payment.settlementKind] ?? payment.settlementKind}`}
              </div>
              {payment.note != null && payment.note !== '' && (
                <p className="mt-1 italic">{payment.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Activation Dialog (mandatory note) ────────────────────────────────────────

function ActivationDialog({
  open,
  onOpenChange,
  onActivate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: (note: string) => Promise<void>;
}): JSX.Element {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNote('');
      setError('');
    }
  }, [open]);

  const noteIsValid = note.trim().length > 0;

  async function handleSubmit(): Promise<void> {
    if (!noteIsValid) return;
    setIsSaving(true);
    setError('');
    try {
      await onActivate(note.trim());
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'No se pudo activar el tenant');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Activar tenant</DialogTitle>
          <DialogDescription>
            Esto queda como registro de auditoría y es lo que el cliente ve en su historial de pagos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activation-note">Nota de activación (obligatoria)</Label>
          <Textarea
            id="activation-note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            disabled={isSaving}
            placeholder="ej: activación de cortesía, sin pago requerido"
            aria-describedby="activation-note-hint"
            aria-required="true"
          />
          <p id="activation-note-hint" className="text-muted-foreground text-xs">
            Obligatorio para activar — el cliente la va a leer en su historial de pagos.
          </p>
        </div>

        {error !== '' && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter className="mt-4">
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
            onClick={() => void handleSubmit()}
            disabled={isSaving || !noteIsValid}
          >
            {isSaving ? 'Activando...' : 'Activar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tenant Detail Panel ───────────────────────────────────────────────────────

function TenantDetailPanel({
  tenantId,
  onClose,
  onStatusChanged,
}: {
  tenantId: string | null;
  onClose: () => void;
  onStatusChanged?: (() => void) | undefined;
}) {
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activationOpen, setActivationOpen] = useState(false);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await getTenant(id);
      setDetail(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar detalles');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) {
      void loadDetail(tenantId);
    } else {
      setDetail(null);
    }
  }, [tenantId, loadDetail]);

  if (!tenantId) return null;

  const handleStatusChange = async (status: TenantStatus) => {
    try {
      await changeTenantStatus(tenantId, status);
      await loadDetail(tenantId);
      onStatusChanged?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cambiar estado');
      }
    }
  };

  const handleActivate = async (note: string) => {
    await changeTenantStatus(tenantId, 'active', note);
    await loadDetail(tenantId);
    onStatusChanged?.();
  };

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Detalle del Tenant</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando detalles...</p>}
      {error !== '' && <p className="text-sm text-red-600">{error}</p>}

      {detail && (
        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground text-xs">Nombre</p>
            <p className="font-medium">{detail.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Slug</p>
            <p className="font-mono text-sm">{detail.slug}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Estado</p>
            <StatusBadge status={detail.status} />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Plan</p>
            <p className="font-medium">
              {detail.plan.name} — {detail.plan.price.toLocaleString()}{' '}
              {detail.plan.currency}/
              {detail.plan.billingInterval === 'month' ? 'mes' : 'año'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Usuarios</p>
            <p className="font-medium">{detail.userCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Creado</p>
            <p className="text-sm">{new Date(detail.createdAt).toLocaleDateString()}</p>
          </div>

          {/* Status actions */}
          <div className="border-border border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs">Cambiar estado</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={detail.status === 'active' ? 'default' : 'ghost'}
                onClick={() => { setActivationOpen(true); }}
              >
                Activar
              </Button>
              <Button
                size="sm"
                variant={detail.status === 'suspended' ? 'default' : 'ghost'}
                onClick={() => handleStatusChange('suspended')}
              >
                Suspender
              </Button>
            </div>
          </div>

          <TenantPaymentsSection tenantId={tenantId} />
        </div>
      )}

      <ActivationDialog
        open={activationOpen}
        onOpenChange={setActivationOpen}
        onActivate={handleActivate}
      />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TenantsPage(): JSX.Element {
  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listTenants({
        page,
        pageSize,
        search: committedSearch || undefined,
        status: statusFilter || undefined,
      });
      setTenants(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar tenants');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, committedSearch, statusFilter]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setCommittedSearch(search);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Tenants</h2>

      {/* Search and filter bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            placeholder="Buscar por nombre..."
            className="w-48"
          />
          <Button type="submit" size="sm" variant="ghost">
            Buscar
          </Button>
        </form>
        <Select
          value={statusFilter === '' ? 'all' : statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value === 'all' ? '' : (value as TenantStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="suspended">Suspendidos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error !== '' && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {loading ? (
            <p className="text-muted-foreground p-4 text-sm">Cargando tenants...</p>
          ) : tenants.length === 0 ? (
            <div className="border-border bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground text-sm">No se encontraron tenants.</p>
            </div>
          ) : (
            <>
              <div className="border-border overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nombre</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Usuarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className={`border-border cursor-pointer border-t transition-colors hover:bg-muted/50 ${
                          selectedTenantId === tenant.id ? 'bg-muted' : ''
                        }`}
                        onClick={() =>
                          { setSelectedTenantId(
                            selectedTenantId === tenant.id ? null : tenant.id,
                          ); }
                        }
                      >
                        <td className="px-4 py-3 font-medium">{tenant.name}</td>
                        <td className="px-4 py-3">{tenant.planName}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={tenant.status} />
                        </td>
                        <td className="px-4 py-3">{tenant.userCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); }}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => { setPage((p) => p + 1); }}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-80 shrink-0">
          <TenantDetailPanel
            tenantId={selectedTenantId}
            onClose={() => { setSelectedTenantId(null); }}
            onStatusChanged={() => void loadTenants()}
          />
        </div>
      </div>
    </div>
  );
}
