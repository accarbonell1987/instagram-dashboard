'use client'

import type { JSX } from 'react'
import { X } from 'lucide-react'

import { Button } from '@core/ui'

import type { ChatMessage } from '../types/instagram.types'
import { MarkdownRenderer } from './markdown-renderer'

interface ChatMessageBubbleProps {
  message: ChatMessage
  onDelete?: (id: string) => void
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export function ChatMessageBubble({
  message,
  onDelete,
  isSelected = false,
  onToggleSelect,
}: ChatMessageBubbleProps): JSX.Element {
  const isUser = message.role === 'user'
  const formattedTime = new Date(message.createdAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="group relative">
      {/* Hover delete button (normal mode) */}
      {onDelete && !onToggleSelect && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(message.id)}
          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100
            rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground
            z-10"
          aria-label="Eliminar mensaje"
          title="Eliminar mensaje"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}

      {/* Selection checkbox (selection mode) */}
      {onToggleSelect && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onToggleSelect(message.id)}
          className="absolute top-1/2 -translate-y-1/2 -left-7 z-10"
          aria-label={isSelected ? 'Deseleccionar mensaje' : 'Seleccionar mensaje'}
        >
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/40 bg-transparent'
            }`}
          >
            {isSelected && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-2.5 w-2.5"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </Button>
      )}

      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role label */}
        <span className="text-xs text-muted-foreground px-1">
          {isUser ? 'Vos' : 'Agente'} · {formattedTime}
        </span>

        {/* Message bubble */}
        <div
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">{message.content}</span>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}
