'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@core/ui'
import { X, ExternalLink, AlertTriangle } from 'lucide-react'
import { publishCarousel, InstagramApiError, getOAuthUrl } from '../services/instagram.service'

type DialogState = 'idle' | 'publishing' | 'success' | 'insufficient_scope' | 'error'

interface PublishConfirmDialogProps {
  carouselId: string
  caption: string
  onClose: () => void
  onSuccess: (permalink: string) => void
}

export function PublishConfirmDialog({
  carouselId,
  caption,
  onClose,
  onSuccess,
}: PublishConfirmDialogProps): JSX.Element {
  const [state, setState] = useState<DialogState>('idle')
  const [permalink, setPermalink] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingReconnect, setIsLoadingReconnect] = useState(false)

  const handlePublish = async () => {
    setState('publishing')
    setErrorMessage(null)
    try {
      const result = await publishCarousel(carouselId, caption || undefined)
      setPermalink(result.permalink)
      setState('success')
      onSuccess(result.permalink)
    } catch (error) {
      if (error instanceof InstagramApiError && error.code === 'INSUFFICIENT_SCOPE') {
        setState('insufficient_scope')
      } else {
        setState('error')
        setErrorMessage(
          error instanceof Error ? error.message : 'Error desconocido al publicar',
        )
      }
    }
  }

  const handleReconnect = async () => {
    setIsLoadingReconnect(true)
    try {
      const url = await getOAuthUrl()
      window.location.href = url
    } catch {
      setIsLoadingReconnect(false)
    }
  }

  const dialog = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar publicación"
    >
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">
            {state === 'success' ? '¡Publicado!' : 'Publicar en Instagram'}
          </h2>
          {state !== 'publishing' && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* idle: preview + confirm */}
          {state === 'idle' && (
            <>
              <p className="text-sm text-muted-foreground">
                Esta acción publicará el carrusel en tu cuenta de Instagram y no se puede deshacer.
              </p>
              {caption && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Caption</p>
                  <p className="text-sm line-clamp-4">{caption}</p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
                  Cancelar
                </Button>
                <Button size="sm" className="flex-1" onClick={() => void handlePublish()}>
                  Publicar ahora
                </Button>
              </div>
            </>
          )}

          {/* publishing */}
          {state === 'publishing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Publicando en Instagram...</p>
            </div>
          )}

          {/* success */}
          {state === 'success' && (
            <>
              <p className="text-sm text-muted-foreground">
                Tu carrusel ha sido publicado exitosamente.
              </p>
              {permalink && (
                <a
                  href={permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Ver en Instagram
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              <Button size="sm" className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </>
          )}

          {/* insufficient_scope */}
          {state === 'insufficient_scope' && (
            <>
              <div className="flex gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm">
                  Tu cuenta necesita reconectarse para habilitar la publicación. Esto requiere
                  aceptar un permiso adicional en Instagram.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
                  Ahora no
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => void handleReconnect()}
                  disabled={isLoadingReconnect}
                >
                  {isLoadingReconnect ? 'Redirigiendo...' : 'Reconectar'}
                </Button>
              </div>
            </>
          )}

          {/* error */}
          {state === 'error' && (
            <>
              <p className="text-sm text-destructive">
                {errorMessage ?? 'Error al publicar. Inténtalo de nuevo.'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
                  Cerrar
                </Button>
                <Button size="sm" className="flex-1" onClick={() => void handlePublish()}>
                  Reintentar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return dialog
  return createPortal(dialog, document.body)
}
