'use client';

import { Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import { useDraftContext } from '../../context/draft-context';
import { patchDraft } from '../../services/draft.service';
import { type Product, fetchProducts } from '../../services/products.service';
import { StepErrorBanner } from '../shared/step-error-banner';

export function ProductSelectionStep({ draftId }: { draftId: string }): JSX.Element {
  const router = useRouter();
  const { draft } = useDraftContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(draft.productId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => {
        setError('Error al cargar productos');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleContinue(): Promise<void> {
    if (selected === null) return;
    setSaving(true);
    setError(null);
    try {
      await patchDraft(draftId, 'plan', { productId: selected, version: draft.version });
      router.push(`/signup/${draftId}/plan`);
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <StepHeader
        icon={Layers}
        title="Elegí un producto"
        description="Cargando productos..."
        currentStep="product"
        draftId={draftId}
      />
    );
  }

  const active = products.filter((p) => p.active);

  return (
    <div className="space-y-6">
      <StepHeader
        icon={Layers}
        title="¿Qué producto te interesa?"
        description="Seleccioná el producto con el que querés empezar."
        currentStep="product"
        draftId={draftId}
        onContinue={
          selected !== null
            ? () => {
                void handleContinue();
              }
            : undefined
        }
        isSubmitting={saving}
      />
      <StepErrorBanner message={error} className="mx-auto w-full max-w-3xl" />
      {/* flex-wrap + basis: cards share one row and a lone card fills the width */}
      <div className="flex flex-wrap justify-center gap-4">
        {active.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              if (!saving) setSelected(p.id);
            }}
            className={`border-border bg-card hover:border-primary min-w-0 max-w-md flex-1 basis-72 rounded-xl border p-6 text-left transition-all ${
              selected === p.id ? 'border-primary ring-primary ring-2' : ''
            }`}
          >
            <h3 className="text-foreground font-semibold">{p.name}</h3>
            {p.description !== null && (
              <p className="text-muted-foreground mt-1 text-sm">{p.description}</p>
            )}
            {p.trialEnabled && (
              <span className="bg-primary/10 text-primary mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium">
                Trial de {p.trialDurationDays} días
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
