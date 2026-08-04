'use client';

import { Switch } from '@core/ui';
import { Package } from 'lucide-react';
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
  type AdminProduct,
} from '@/modules/backoffice/productos/index';

export default function ProductsPage(): JSX.Element {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [modules, setModules] = useState<AdminModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [productList, moduleResult] = await Promise.all([listProducts(), listModules()]);
      setProducts(productList);
      setModules(moduleResult.modules);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(product: AdminProduct, active: boolean): Promise<void> {
    setSaving(product.id);
    try {
      await updateProduct(product.id, { active });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, active } : p)));
      toast.success('Actualizado');
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="text-muted-foreground p-4 text-sm">Cargando...</p>;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Productos</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Cada módulo pertenece a un solo producto. Los trials se gestionan en su propia sección.
      </p>

      {error !== '' && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-4">
        {products.map((product) => {
          const productModules = modules.filter((m) => m.productId === product.id);
          const roots = productModules.filter((m) => m.parentId === null);
          const orphans = productModules.filter(
            (m) => m.parentId !== null && !productModules.some((p) => p.id === m.parentId)
          );

          return (
            <section key={product.id} className="border-border rounded-lg border">
              <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h3 className="text-foreground font-medium">{product.name}</h3>
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">{product.id}</p>
                  {product.description !== null && (
                    <p className="text-muted-foreground mt-1 text-sm">{product.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {product.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <Switch
                    checked={product.active}
                    disabled={saving === product.id}
                    aria-label={`Activar ${product.name}`}
                    onCheckedChange={(checked) => {
                      void toggleActive(product, checked);
                    }}
                  />
                </div>
              </header>

              <div className="px-4 py-3">
                <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                  Módulos ({productModules.length})
                </h4>

                {productModules.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Este producto todavía no tiene módulos.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {[...roots, ...orphans].map((module) => {
                      const children = productModules.filter((m) => m.parentId === module.id);
                      return (
                        <li key={module.id} className="flex flex-col gap-1">
                          <span className="flex items-center gap-2 text-sm">
                            <Package
                              className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className={module.active ? '' : 'text-muted-foreground'}>
                              {module.name}
                              {!module.active && ' (inactivo)'}
                            </span>
                          </span>
                          {children.length > 0 && (
                            <ul className="ml-6 flex flex-col gap-1">
                              {children.map((child) => (
                                <li
                                  key={child.id}
                                  className="text-muted-foreground flex items-center gap-2 text-xs"
                                >
                                  <span
                                    className="bg-muted-foreground/40 h-1 w-1 shrink-0 rounded-full"
                                    aria-hidden="true"
                                  />
                                  {child.name}
                                  {!child.active && ' (inactivo)'}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
