'use client';

import { Download } from 'lucide-react';
import { useState, type JSX } from 'react';

import { Button } from '@core/ui';
import { getDocumentSignedUrl } from '../services/document.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentDownloadButtonProps {
  documentId: string;
  label: string;
  variant?: 'primary' | 'secondary' | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentDownloadButton({
  documentId,
  label,
  variant = 'secondary',
}: DocumentDownloadButtonProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setIsLoading(true);
    setDownloadError(null);

    try {
      const { url } = await getDocumentSignedUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setDownloadError('No pudimos generar el enlace. Intentá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  const isPrimary = variant === 'primary';

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={isPrimary ? 'default' : 'outline'}
        onClick={() => void handleClick()}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label={label}
        className="w-full justify-between rounded-lg px-4 py-3 text-sm font-medium"
      >
        <span>{isLoading ? 'Generando…' : label}</span>
        <Download className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      </Button>

      {downloadError !== null && (
        <p
          role="alert"
          aria-live="polite"
          className="text-xs text-destructive"
        >
          {downloadError}
        </p>
      )}
    </div>
  );
}
