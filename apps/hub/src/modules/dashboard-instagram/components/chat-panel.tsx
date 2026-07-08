'use client'

import type { JSX } from 'react'
import { useState, useRef, useEffect } from 'react'

import { Button, Textarea } from '@core/ui'

import type { UseGrowthAgentResult } from './chat-panel.types'
import { ChatMessageBubble } from './chat-message'
import { SendHorizonal, Trash2, CheckSquare } from 'lucide-react'

interface ChatPanelProps {
  hook: UseGrowthAgentResult
}

export function ChatPanel({ hook }: ChatPanelProps): JSX.Element {
  const {
    messages,
    isLoading,
    sendMessage,
    error,
    deleteMessage,
    clearConversation,
    selectedIds,
    toggleSelection,
    deleteSelected,
    clearSelection,
  } = hook
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [selectionMode, setSelectionMode] = useState(false)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSubmit = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return
    setInputValue('')
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) clearSelection()
      return !prev
    })
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm h-[500px]">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">Agente de Crecimiento</h3>
            <p className="text-xs text-muted-foreground">
              Consultá estrategias de contenido para Instagram
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Clear conversation button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void clearConversation()}
              className="text-muted-foreground"
              title="Limpiar conversación"
              aria-label="Limpiar conversación"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            {/* Selection mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleSelectionMode}
              className={selectionMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}
              title="Seleccionar mensajes"
              aria-label="Seleccionar mensajes"
              aria-pressed={selectionMode}
            >
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Selection bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between">
          <span className="text-xs font-medium">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void deleteSelected()}
            aria-label="Eliminar seleccionados"
          >
            Eliminar seleccionados
          </Button>
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center">
              Hola! Preguntame sobre estrategias de contenido,{' '}
              publicaciones destacadas o cuándo publicar.
            </p>
          </div>
        )}
        {messages.map((message) =>
          selectionMode ? (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isSelected={selectedIds.has(message.id)}
              onToggleSelect={toggleSelection}
            />
          ) : (
            <ChatMessageBubble
              key={message.id}
              message={message}
              onDelete={deleteMessage}
            />
          ),
        )}
        {/* Loading indicator */}
        {isLoading && (
          <div
            role="status"
            aria-label="Pensando..."
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </div>
            <span>Pensando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t flex gap-2">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Escribí tu pregunta..."
          rows={2}
          className="flex-1 resize-none"
          aria-label="Mensaje"
        />
        <Button
          variant="default"
          onClick={() => void handleSubmit()}
          disabled={isLoading || !inputValue.trim()}
          className="self-end"
          aria-label="Enviar mensaje"
        >
          <SendHorizonal className="h-4 w-4" aria-hidden="true" />
          Enviar
        </Button>
      </div>

    </div>
  )
}
