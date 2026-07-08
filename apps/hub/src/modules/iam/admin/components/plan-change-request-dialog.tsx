'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui';
import { useState, type JSX } from 'react';

import type { components } from '@/lib/api/types';
import { ConflictError } from '@/lib/api/errors';
import { requestPlanChange } from '../services/plan-change.service';
import { PlanCatalog } from './plan-catalog';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Plan = components['schemas']['Plan'];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PlanChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: Plan[];
  currentPlanId: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PlanChangeRequestDialog({
  open,
  onOpenChange,
  plans,
  currentPlanId,
}: PlanChangeRequestDialogProps): JSX.Element {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedPlanId(null);
      setError(null);
      setSuccess(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (selectedPlanId === null) return;
    setIsLoading(true);
    setError(null);
    try {
      await requestPlanChange(selectedPlanId);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        setError('Ya existe una solicitud pendiente.');
      } else {
        setError('Error al enviar la solicitud. Intenta nuevamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar plan</DialogTitle>
          <DialogDescription>
            Selecciona el plan al que deseas migrar. El equipo procesará tu solicitud.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-4 text-center">
            <p className="text-foreground text-sm font-medium">
              ¡Solicitud enviada correctamente!
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              El equipo revisará tu solicitud y te contactará pronto.
            </p>
          </div>
        ) : (
          <>
            <PlanCatalog
              plans={plans}
              currentPlanId={currentPlanId}
              selectedPlanId={selectedPlanId}
              onSelect={setSelectedPlanId}
            />
            {error !== null && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </>
        )}

        <DialogFooter>
          {success ? (
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
            >
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={selectedPlanId === null || isLoading}
              >
                {isLoading ? '…' : 'Confirmar solicitud'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
