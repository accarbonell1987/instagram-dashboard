'use client';

import { useState, useCallback, type JSX } from 'react';
import { Check, Copy, Link } from 'lucide-react';

import { Button } from '@core/ui';

export interface CopyButtonProps {
  url: string;
  label: string;
}

export function CopyButton({ url, label }: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }, [url]);

  const handleOpen = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  return (
    <div className="border-border bg-background flex w-full items-center gap-2 rounded-lg border px-4 py-3">
      <div className="text-muted-foreground min-w-0 flex-1 truncate text-left text-sm">
        {label}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        aria-label="Abrir enlace"
      >
        <Link className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? 'Copiado' : 'Copiar enlace'}
      >
        {copied ? <Check className="text-green-500 h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
