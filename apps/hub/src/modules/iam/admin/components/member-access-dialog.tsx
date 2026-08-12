'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';

import type { components } from '@/lib/api/types';
import type { TenantProductRoles } from '@/modules/iam/admin/services/member.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MemberListItem = components['schemas']['MemberListItem'];

/** The Select needs a non-empty value for "no access"; '' is not selectable. */
const NO_ACCESS = 'none';

export interface MemberAccessFormProps {
  member: MemberListItem;
  products: TenantProductRoles[];
  onSave: (productRoleIds: string[]) => Promise<void>;
  onCancel: () => void;
}

export interface MemberAccessDialogProps extends Omit<MemberAccessFormProps, 'member'> {
  /** null closes the dialog. */
  member: MemberListItem | null;
}

// ─── Form ──────────────────────────────────────────────────────────────────────

/**
 * The pickers and the save action, separate from the dialog that frames them.
 *
 * Kept apart so it can be exercised on its own: a Radix Select nested inside a
 * Radix Dialog deadlocks in jsdom — the two focus scopes hand focus back and
 * forth forever — so the interaction is only testable outside the dialog.
 */
export function MemberAccessForm({
  member,
  products,
  onSave,
  onCancel,
}: MemberAccessFormProps): JSX.Element {
  // roleId per productId. NO_ACCESS means the member gets no role there.
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset from the member each time the form is pointed at a different one —
  // otherwise the previous member's access is what the admin would save.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const product of products) {
      const held = member.productRoles.find((role) => role.productId === product.productId);
      next[product.productId] = held?.id ?? NO_ACCESS;
    }
    setSelection(next);
    setError('');
  }, [member, products]);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setError('');
    try {
      await onSave(Object.values(selection).filter((roleId) => roleId !== NO_ACCESS));
    } catch {
      setError('No pudimos guardar los accesos. Intentá de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay productos contratados, así que no hay accesos que repartir.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((product) => {
            const selected = selection[product.productId] ?? NO_ACCESS;
            const role = product.roles.find((r) => r.id === selected);
            const selectId = `access-${product.productId}`;

            return (
              <div key={product.productId} className="flex flex-col gap-1.5">
                <Label htmlFor={selectId}>{product.productName}</Label>
                <Select
                  value={selected}
                  onValueChange={(value) => {
                    setSelection((prev) => ({ ...prev, [product.productId]: value }));
                  }}
                >
                  <SelectTrigger id={selectId} disabled={isSaving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCESS}>Sin rol asignado</SelectItem>
                    {product.roles.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* A role that opens nothing is the one way this screen can take
                    the product away from someone. Say so before saving. */}
                {role?.moduleCount === 0 && (
                  <p className="text-warning flex items-center gap-1.5 text-xs">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Este rol no habilita ningún módulo — el miembro no podrá abrir el producto.
                  </p>
                )}
                {selected === NO_ACCESS && (
                  <p className="text-muted-foreground text-xs">
                    Sin rol, el miembro ve todo lo que otorga el plan.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error !== '' && (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      )}

      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || products.length === 0}
          aria-busy={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar accesos'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Dialog ────────────────────────────────────────────────────────────────────

/**
 * Which products a member reaches, and with what role inside each.
 *
 * One role per product, chosen from the roles that product defines — the two
 * axes the tenant asked for. The tenant role (admin or plain user) is decided
 * at invitation time and is not editable here: it governs the hub, this governs
 * what opens inside a product.
 */
export function MemberAccessDialog({
  member,
  products,
  onSave,
  onCancel,
}: MemberAccessDialogProps): JSX.Element {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Accesos a productos</DialogTitle>
          <DialogDescription>
            {member !== null && (
              <>
                Qué puede abrir <strong>{member.email}</strong> dentro de cada producto
                contratado.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {member !== null && (
          <MemberAccessForm
            member={member}
            products={products}
            onSave={onSave}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
