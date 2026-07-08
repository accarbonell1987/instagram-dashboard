'use client';

import { Button, Input } from '@core/ui';
import { Pencil } from 'lucide-react';
import { useState, useRef, useEffect, type JSX } from 'react';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface InlineEditFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InlineEditField({ label, value, onSave }: InlineEditFieldProps): JSX.Element {
  const [mode, setMode] = useState<'idle' | 'editing' | 'saving'>('idle');
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'editing') {
      inputRef.current?.focus();
    }
  }, [mode]);

  function startEdit() {
    setDraft(value);
    setError(null);
    setMode('editing');
  }

  function cancel() {
    setMode('idle');
    setError(null);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed.length < 1) {
      setError('El nombre no puede estar vacío');
      return;
    }
    if (trimmed === value) {
      setMode('idle');
      return;
    }
    setMode('saving');
    setError(null);
    try {
      await onSave(trimmed);
      setMode('idle');
    } catch {
      setError('Error al guardar. Intenta nuevamente.');
      setMode('editing');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void save();
    if (e.key === 'Escape') cancel();
  }

  if (mode === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-foreground text-sm font-medium">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={startEdit}
          aria-label={`Editar ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={mode === 'saving'}
          aria-label={label}
          className="py-1 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void save()}
          disabled={mode === 'saving' || draft.trim() === value}
          className="text-primary disabled:opacity-50"
        >
          {mode === 'saving' ? '…' : 'Guardar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={mode === 'saving'}
          className="text-muted-foreground"
        >
          Cancelar
        </Button>
      </div>
      {error !== null && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
