'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@core/ui';
import { CheckIcon } from 'lucide-react';
import { type JSX } from 'react';

import { type Plan } from '../../services/plans.service';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PlanDetailsDialogProps {
  /** null keeps the dialog closed — it is driven entirely by the selected plan. */
  plan: Plan | null;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full breakdown of what a plan includes: every module it grants, each with its
 * functionalities. The card only shows a summary so the cards stay comparable.
 */
export function PlanDetailsDialog({ plan, onClose }: PlanDetailsDialogProps): JSX.Element {
  const modules = plan?.modules ?? [];
  const features = plan?.features ?? [];
  const priceFormatted = plan !== null ? new Intl.NumberFormat('es-PY').format(plan.price) : '';
  const cycleLabel = plan?.billingCycle === 'monthly' ? '/mes' : '/año';

  return (
    <Dialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan?.name ?? 'Plan'}</DialogTitle>
          <DialogDescription>
            {plan !== null && plan.price === 0
              ? 'Gratis'
              : `${priceFormatted} ${plan?.currency ?? ''}${cycleLabel}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <section>
            <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
              Módulos incluidos
            </h3>

            {modules.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Este plan todavía no tiene módulos asignados.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {modules.map((module) => (
                  <li key={module.id} className="flex flex-col gap-1">
                    <span className="text-foreground flex items-start gap-2 text-sm font-medium">
                      <CheckIcon
                        className="text-primary mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      {module.name}
                    </span>

                    {module.description !== undefined && (
                      <p className="text-muted-foreground ml-6 text-xs leading-relaxed">
                        {module.description}
                      </p>
                    )}

                    {module.subModules.length > 0 && (
                      <ul className="ml-6 mt-1 flex flex-col gap-1.5">
                        {module.subModules.map((subModule) => (
                          <li key={subModule.id} className="flex flex-col">
                            <span className="text-foreground flex items-start gap-2 text-xs">
                              <span
                                className="bg-muted-foreground/40 mt-1.5 h-1 w-1 shrink-0 rounded-full"
                                aria-hidden="true"
                              />
                              {subModule.name}
                            </span>
                            {subModule.description !== undefined && (
                              <span className="text-muted-foreground ml-4 text-xs leading-relaxed">
                                {subModule.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {features.length > 0 && (
            <section>
              <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                Además
              </h3>
              <ul className="flex flex-col gap-2">
                {features.map((feature) => (
                  <li
                    key={feature}
                    className="text-muted-foreground flex items-start gap-2 text-sm leading-snug"
                  >
                    <CheckIcon
                      className="text-primary/60 mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
