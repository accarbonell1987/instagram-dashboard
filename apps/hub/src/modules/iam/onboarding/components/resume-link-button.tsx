'use client';

import { useState, type JSX } from 'react';

import { Button } from '@core/ui';
import { requestResumeLink } from '../services/draft.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResumeLinkButtonProps {
  draftId: string;
  representativeEmail: string;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function ResumeLinkButton({ draftId, representativeEmail }: ResumeLinkButtonProps): JSX.Element {
  const [status, setStatus] = useState<SendStatus>('idle');

  async function handleClick(): Promise<void> {
    if (status === 'sending' || status === 'sent') return;

    setStatus('sending');
    try {
      await requestResumeLink(draftId);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <p className="text-center text-sm text-muted-foreground" role="status" aria-live="polite">
        ✓ Te enviamos un enlace a{' '}
        <span className="font-medium text-foreground">{representativeEmail}</span>
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p className="text-center text-sm text-destructive" role="alert">
        No pudimos enviar el enlace. Por favor, inténtalo de nuevo.{' '}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => { setStatus('idle'); }}
        >
          Reintentar
        </Button>
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="link"
      disabled={status === 'sending'}
      onClick={() => { void handleClick(); }}
      className="mx-auto block text-sm"
      aria-busy={status === 'sending'}
    >
      {status === 'sending' ? 'Enviando…' : '¿Quieres continuar después? Envíate un enlace al correo'}
    </Button>
  );
}
