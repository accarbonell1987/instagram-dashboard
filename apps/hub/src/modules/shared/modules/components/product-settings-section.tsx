'use client';

import type { JSX } from 'react';

import { useAdminSections } from '../hooks/use-admin-sections';
import { resolveSectionUrl } from '../lib/resolve-url';

import { ModuleFrame } from './module-frame';

/**
 * A settings screen contributed by one of the tenant's products.
 *
 * The hub owns the frame, the heading and the placement; the product owns
 * everything inside. Nothing here knows what Instagram is — the section says
 * where its page lives and the frame mounts it.
 */
export function ProductSettingsSection({ sectionKey }: { sectionKey: string }): JSX.Element {
  const { sections, isLoading } = useAdminSections();

  const section = sections.find((candidate) => candidate.key === sectionKey);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando la sección"
        className="bg-muted h-64 animate-pulse rounded-lg"
      />
    );
  }

  // Unknown key, product not contracted, module not entitled, or the caller's
  // role does not reach it — the API filtered it out and the reason is not the
  // customer's problem. One honest message covers them all.
  if (section === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-foreground text-xl font-semibold">Sección no disponible</h2>
        <p className="text-muted-foreground text-sm">
          Esta configuración no existe o no está disponible para tu organización.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-xl font-semibold">{section.label}</h2>
        <p className="text-muted-foreground text-sm">
          {section.description ?? section.productName}
        </p>
      </div>

      <ModuleFrame
        src={resolveSectionUrl(section.productId, section.productUrl, section.path)}
        title={section.label}
        sizing="content"
      />
    </section>
  );
}
