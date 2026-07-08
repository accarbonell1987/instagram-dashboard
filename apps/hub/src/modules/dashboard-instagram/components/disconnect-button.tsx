'use client';

import { useState } from 'react';

import { Button } from '@core/ui';
import { Unplug } from 'lucide-react';
import { disconnectAccount } from '../services/instagram.service';

interface DisconnectButtonProps {
  onDisconnected: () => void | Promise<void>;
}

export function DisconnectButton({ onDisconnected }: DisconnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await disconnectAccount();
      await onDisconnected();
    } catch {
      setError('Error al desconectar. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDisconnect}
        disabled={isLoading}
        title={isLoading ? 'Desconectando...' : 'Desconectar cuenta'}
        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
        aria-label="Desconectar cuenta"
      >
        <Unplug className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} aria-hidden="true" />
      </Button>
      {error !== null && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
