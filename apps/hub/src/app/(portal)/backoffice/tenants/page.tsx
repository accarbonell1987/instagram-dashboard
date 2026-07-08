'use client';

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui';
import { useCallback, useEffect, useState, type JSX } from 'react';

import { ApiError } from '@/lib/api/errors';
import {
  listTenants,
  getTenant,
  changeTenantStatus,
  type AdminTenantListItem,
  type AdminTenantDetail,
  type TenantStatus,
} from '@/modules/backoffice/tenants/services/tenant-admin.service';

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
                onClick={() => handleStatusChange('active')}
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
        </div>
      )}
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
