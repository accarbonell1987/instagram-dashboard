'use client';

import { useState } from 'react';

import { Button, Checkbox, Label } from '@core/ui';
import { getOAuthUrl } from '../services/instagram.service';

export function ConnectAccount() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleConnect = async () => {
    if (!confirmed) return;
    setIsConnecting(true);
    try {
      const url = await getOAuthUrl();
      window.location.href = url;
    } catch {
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="bg-card border rounded-xl p-8 space-y-6">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">
            Conectá tu cuenta de Instagram
          </h2>
          <p className="text-sm text-muted-foreground">
            Para empezar a analizar tu contenido, necesitamos acceso a tus
            métricas de Instagram.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
          <p className="font-medium">Requisitos:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>✅ Cuenta de Instagram Business o Creator</li>
            <li>✅ Cuenta vinculada a una página de Facebook</li>
            <li>✅ Solo lectura — no publicamos ni interactuamos</li>
          </ul>
        </div>

        {/* Permanent binding warning */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4 text-left">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
            ⚠️ Vinculación permanente
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Esta cuenta quedará vinculada de forma <strong>permanente</strong> a
            tu espacio de trabajo. No vas a poder enlazar otra cuenta después.
            Si necesitás cambiarla, deberás contactar a soporte.
          </p>
        </div>

        {/* Confirmation checkbox */}
        <div className="flex items-start gap-3 text-left">
          <Checkbox
            id="permanent-binding"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="permanent-binding" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
            Entiendo que esta vinculación es permanente y que no podré
            enlazar otra cuenta de Instagram a este espacio de trabajo.
          </Label>
        </div>

        <Button
          variant="default"
          onClick={handleConnect}
          disabled={isConnecting || !confirmed}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isConnecting ? 'Conectando...' : 'Conectar Instagram'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Al conectar, autorizás a Corehub a leer las métricas de tu cuenta. No
          publicamos ni interactuamos con tu contenido.
        </p>
      </div>
    </div>
  );
}
