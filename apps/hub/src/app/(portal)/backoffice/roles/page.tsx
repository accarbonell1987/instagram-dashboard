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
} from '@core/ui';
import { Plus, Pencil, Trash2, Puzzle } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { toast } from 'sonner';

import { ModuleTransfer } from '@/components/module-transfer';
import { ApiError } from '@/lib/api/errors';
import { listModules, type AdminModule } from '@/modules/backoffice/modulo-admin/services/module-admin.service';
import {
  listProductRoles,
  createProductRole,
  updateProductRole,
  deleteProductRole,
  getRoleModules,
  setRoleModules,
  type AdminProductRole,
} from '@/modules/backoffice/roles/services/role-admin.service';

// Product list would normally come from an API; hardcode for now since we have
// one product. Replace with fetch when product CRUD exists.
const PRODUCTS = [{ id: 'instagram-dashboard', name: 'Dashboard Instagram' }];

export default function RolesPage(): JSX.Element {
  const [productId, setProductId] = useState(PRODUCTS[0]?.id ?? '');
  const [roles, setRoles] = useState<AdminProductRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminProductRole | null>(null);
  const [modulesOpen, setModulesOpen] = useState<AdminProductRole | null>(null);

  // Module assignment state
  const [allModules, setAllModules] = useState<AdminModule[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSaving, setModulesSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listProductRoles(productId);
      setRoles(result);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar roles');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  async function loadModulesData(roleId: string) {
    setModulesLoading(true);
    try {
      const [modulesResult, roleModulesResult] = await Promise.all([
        listModules(),
        getRoleModules(roleId).catch(() => [] as string[]),
      ]);
      setAllModules(modulesResult.modules);
      setSelectedIds(roleModulesResult);
    } catch {
      toast.error('Error al cargar módulos');
    } finally {
      setModulesLoading(false);
    }
  }

  function openModules(role: AdminProductRole) {
    setModulesOpen(role);
    void loadModulesData(role.id);
  }

  async function handleSaveModules() {
    if (!modulesOpen) return;
    setModulesSaving(true);
    try {
      await setRoleModules(modulesOpen.id, selectedIds);
      toast.success('Módulos actualizados');
      setModulesOpen(null);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setModulesSaving(false);
    }
  }

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formName, setFormName] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  function openCreate() {
    setEditingRole(null);
    setFormKey('');
    setFormName('');
    setFormOpen(true);
  }

  function openEdit(role: AdminProductRole) {
    setEditingRole(role);
    setFormKey(role.key);
    setFormName(role.name);
    setFormOpen(true);
  }

  async function handleFormSave() {
    setFormSaving(true);
    try {
      if (editingRole) {
        await updateProductRole(productId, editingRole.id, { name: formName });
      } else {
        await createProductRole(productId, { key: formKey, name: formName });
      }
      setFormOpen(false);
      await loadRoles();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(role: AdminProductRole) {
    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;
    try {
      await deleteProductRole(productId, role.id);
      await loadRoles();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  }

  const assignedModules = allModules.filter((m) => selectedIds.includes(m.id));
  const availableModules = allModules.filter((m) => !selectedIds.includes(m.id));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Roles</h2>
          <Select value={productId} onValueChange={setProductId}>
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
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Crear Rol
        </Button>
      </div>

      {error !== '' && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : roles.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">No hay roles para este producto.</p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Clave</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-border border-t">
                  <td className="px-4 py-3 font-mono text-xs">{role.key}</td>
                  <td className="px-4 py-3">{role.name}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { openModules(role); }}
                      aria-label={`Módulos de ${role.name}`}
                    >
                      <Puzzle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { openEdit(role); }}
                      aria-label={`Editar ${role.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void handleDelete(role)}
                      aria-label={`Eliminar ${role.name}`}
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

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar Rol' : 'Crear Rol'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Modificá el nombre del rol.' : 'Definí el rol para este producto.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingRole && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role-key">Clave</Label>
                <Input id="role-key" value={formKey} onChange={(e) => { setFormKey(e.target.value); }} placeholder="e.g., content-editor" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Nombre</Label>
              <Input id="role-name" value={formName} onChange={(e) => { setFormName(e.target.value); }} placeholder="Nombre del rol" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); }}>Cancelar</Button>
            <Button onClick={() => void handleFormSave()} disabled={formSaving}>
              {formSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Assignment Dialog */}
      <Dialog open={modulesOpen !== null} onOpenChange={() => { setModulesOpen(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Módulos — {modulesOpen?.name}</DialogTitle>
            <DialogDescription>
              Arrastrá los módulos entre las columnas para asignarlos al rol.
            </DialogDescription>
          </DialogHeader>
          {modulesLoading ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Cargando...</p>
          ) : (
            <ModuleTransfer
              available={availableModules}
              assigned={assignedModules}
              onAssign={(id) => { setSelectedIds((prev) => [...prev, id]); }}
              onUnassign={(id) => { setSelectedIds((prev) => prev.filter((p) => p !== id)); }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModulesOpen(null); }}>Cancelar</Button>
            <Button onClick={() => void handleSaveModules()} disabled={modulesSaving}>
              {modulesSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
