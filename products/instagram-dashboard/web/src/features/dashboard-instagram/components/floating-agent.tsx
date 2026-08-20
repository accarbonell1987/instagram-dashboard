'use client'

import { Button } from '@core/ui'
import { MessageCircle, X, Bot, Maximize2, Minimize2, Settings } from 'lucide-react'
import type { JSX } from 'react'
import { useState, useEffect } from 'react'


import type { UseGrowthAgentResult } from '../hooks/use-growth-agent'
import { getUsage } from '../services/instagram.service'
import type { ContentSuggestion, UsageResponse } from '../types/instagram.types'

import { AgentSettingsModal } from './agent-settings'
import { CarouselPreviewPanel } from './carousel-preview-panel'
import { CarouselsSection } from './carousels-section'
import { ChatPanel } from './chat-panel'
import { ScriptPreviewModal } from './script-preview-modal'
import { SuggestionsPanel } from './suggestions-panel'
import { UsageMeter } from './usage-meter'


export type ActiveTab = 'chat' | 'suggestions' | 'carousels'

const ALL_TABS: ActiveTab[] = ['chat', 'suggestions', 'carousels']

interface FloatingAgentProps {
  hook: UseGrowthAgentResult
  // Tabs this tenant/user is entitled to (ig-ai-chat / ig-ai-suggestions /
  // ig-ai-carousels). Defaults to all three — the caller is responsible for
  // not mounting FloatingAgent at all when the list would be empty (an agent
  // with no permitted tabs is not a feature, see page.tsx).
  permittedTabs?: ActiveTab[]
}

export function FloatingAgent({ hook, permittedTabs = ALL_TABS }: FloatingAgentProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>(permittedTabs[0] ?? 'chat')
  const [isExpanded, setIsExpanded] = useState(false)
  // Null until the first load lands: unknown, not zero.
  const [seenCount, setSeenCount] = useState<number | null>(null)
  const [activeCarouselId, setActiveCarouselId] = useState<string | null>(null)
  const [carouselRefreshTrigger, setCarouselRefreshTrigger] = useState(0)
  const [scriptPreview, setScriptPreview] = useState<{ topic: string; suggestionId?: string } | null>(null)
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  // If the active tab loses its permission (entitlements change under us),
  // fall back to the first tab the tenant still has.
  useEffect(() => {
    if (permittedTabs.length > 0 && !permittedTabs.includes(activeTab)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- length checked above
      setActiveTab(permittedTabs[0]!)
    }
  }, [permittedTabs, activeTab])

  // Fetch usage data when the agent opens or tab changes
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setUsageLoading(true)
    getUsage()
      .then((data) => {
        if (!cancelled) { setUsage(data); setUsageLoading(false) }
      })
      .catch(() => {
        if (!cancelled) { setUsage(null); setUsageLoading(false) }
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, activeTab])

  /**
   * How many suggestions arrived while the panel was shut.
   *
   * It used to be `messages + suggestions` measured against a baseline of zero,
   * so on every page load it announced the whole history back — your own typed
   * messages included. A badge reading 4 for two messages you wrote and two
   * suggestions you had already read is not a notification, it is a tally of
   * things that exist.
   *
   * Messages are gone from the count: the agent only ever replies while you are
   * watching it, so a message is never news. Suggestions can appear on their
   * own, which is the only thing here worth a red dot.
   */
  const suggestionCount = hook.suggestions.length
  const unreadCount = isOpen || seenCount === null ? 0 : Math.max(0, suggestionCount - seenCount)

  // The baseline waits for the first load. Taken at mount it would be zero
  // against a list still in flight, and every existing suggestion would count
  // as new — which is the bug, in miniature.
  useEffect(() => {
    if (hook.suggestionsLoaded && seenCount === null) {
      setSeenCount(suggestionCount)
    }
  }, [hook.suggestionsLoaded, seenCount, suggestionCount])

  const handleOpen = () => {
    setIsOpen(true)
    setSeenCount(suggestionCount)
  }

  const handleClose = () => {
    setIsOpen(false)
    setSeenCount(suggestionCount)
  }

  const handleStartCarousel = (suggestion: ContentSuggestion) => {
    setScriptPreview({ topic: suggestion.content, suggestionId: suggestion.id })
  }

  return (
    <>
      {/*
        Scrim. The panel already declared `aria-modal="true"` while leaving the
        page behind it live and in focus — the markup claimed modality that
        nothing enforced. This is what that claim looks like: the page dims,
        blurs, and stops taking clicks until the agent is closed.

        Same values as the design system's overlays (`bg-black/50
        backdrop-blur-sm`) rather than a second opinion about how deep a modal
        sits. It is not a Dialog — this panel is a corner widget that grows,
        not a centred box — so it cannot reuse the component, only its look.
      */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Expanded panel */}
      <div
        className={`fixed z-50 flex flex-col rounded-xl border border-border bg-background shadow-2xl transition-all duration-200 ease-in-out ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={
          isExpanded
            ? { top: '10%', left: '10%', right: '10%', bottom: '10%', width: 'auto', height: 'auto' }
            : { bottom: '5rem', right: '1.5rem', width: '380px', height: '520px' }
        }
        aria-hidden={!isOpen}
        role="dialog"
        aria-label="Agente de Crecimiento"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex flex-col rounded-t-xl bg-zinc-900 px-4 pt-3 pb-2 text-white gap-1.5">
          {/* Row 1: title + controls */}
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 shrink-0 text-zinc-300" aria-hidden="true" />
            <span className="text-sm font-semibold flex-1">Agente de Crecimiento</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={hook.openSettings}
              className="text-zinc-400 hover:bg-zinc-700 hover:text-white"
              aria-label="Configurar agente"
              title="Configurar agente"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setIsExpanded((prev) => !prev); }}
              className="text-zinc-400 hover:bg-zinc-700 hover:text-white"
              aria-label={isExpanded ? 'Colapsar agente' : 'Expandir agente'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-zinc-400 hover:bg-zinc-700 hover:text-white"
              aria-label="Cerrar agente"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {/* Row 2: usage meter */}
          <div className="flex justify-end">
            <UsageMeter usage={usage} isLoading={usageLoading} />
          </div>
        </div>

        {/* Tabs — only permitted ones render */}
        <div className="flex border-b border-border bg-muted/30">
          {permittedTabs.includes('chat') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActiveTab('chat'); }}
              className={`flex-1 rounded-none ${
                activeTab === 'chat'
                  ? 'border-b-2 border-zinc-900 bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-selected={activeTab === 'chat'}
              role="tab"
            >
              Chat
            </Button>
          )}
          {permittedTabs.includes('suggestions') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActiveTab('suggestions'); }}
              className={`flex-1 rounded-none ${
                activeTab === 'suggestions'
                  ? 'border-b-2 border-zinc-900 bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-selected={activeTab === 'suggestions'}
              role="tab"
            >
              Sugerencias
              {hook.suggestions.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-zinc-900 px-1.5 py-0.5 text-xs text-white">
                  {hook.suggestions.length}
                </span>
              )}
            </Button>
          )}
          {permittedTabs.includes('carousels') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActiveTab('carousels'); }}
              className={`flex-1 rounded-none ${
                activeTab === 'carousels'
                  ? 'border-b-2 border-zinc-900 bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-selected={activeTab === 'carousels'}
              role="tab"
            >
              Carruseles
            </Button>
          )}
        </div>

        {/* Body — fill remaining space */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <ChatPanelCompact hook={hook} />
          ) : activeTab === 'suggestions' ? (
            <div className="h-full overflow-y-auto p-3">
              <SuggestionsPanel
                suggestions={hook.suggestions}
                suggestionBatches={hook.suggestionBatches}
                onMarkUsed={(id) => void hook.markUsed(id, '')}
                onDismiss={(id) => void hook.dismiss(id)}
                onClearAll={() => void hook.clearSuggestions()}
                onStartCarousel={(suggestion) => { handleStartCarousel(suggestion); }}
                onRefreshSuggestions={hook.refreshSuggestions}
              />
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-3">
              <CarouselsSection
                activeCarouselId={activeCarouselId}
                onOpenCarousel={(id) => { setActiveCarouselId(id); }}
                refreshTrigger={carouselRefreshTrigger}
                isExpanded={isExpanded}
                limits={hook.agentConfig?.limits}
              />
            </div>
          )}
        </div>
      </div>

      {/* Trigger bubble */}
      <Button
        variant="default"
        size="icon"
        onClick={isOpen ? handleClose : handleOpen}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        aria-label={isOpen ? 'Cerrar agente de crecimiento' : 'Abrir agente de crecimiento'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        )}

        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
            aria-label={`${String(unreadCount)} sin leer`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Agent settings modal — portal-rendered to body */}
      <AgentSettingsModal
        isOpen={hook.isSettingsOpen}
        onClose={hook.closeSettings}
        onSave={hook.saveAgentConfig}
        initialConfig={hook.agentConfig}
        hasFalApiKey={hook.hasFalApiKey}
        hasLlmApiKey={hook.hasLlmApiKey}
        editableSections={hook.editableSections}
        settingsFailed={hook.settingsFailed}
      />

      {/* Script preview modal — shown before carousel is created */}
      {scriptPreview !== null && (
        <ScriptPreviewModal
          topic={scriptPreview.topic}
          {...(scriptPreview.suggestionId !== undefined && { suggestionId: scriptPreview.suggestionId })}
          {...(hook.agentConfig?.limits !== undefined && { limits: hook.agentConfig.limits })}
          onClose={() => { setScriptPreview(null); }}
          onCreated={(id) => {
            setScriptPreview(null)
            setActiveCarouselId(id)
            setActiveTab('carousels')
            if (scriptPreview.suggestionId) {
              void hook.markUsed(scriptPreview.suggestionId, '')
            }
          }}
        />
      )}

      {/* Carousel preview panel — fixed overlay, sits above everything */}
      {activeCarouselId !== null && (
        <CarouselPreviewPanel
          carouselId={activeCarouselId}
          onClose={() => {
            setActiveCarouselId(null)
            setCarouselRefreshTrigger((n) => n + 1)
          }}
        />
      )}
    </>
  )
}

// Compact version of ChatPanel adapted for the floating widget's fixed height
// It reuses the same hook but removes the outer card border/shadow (the widget provides them)
function ChatPanelCompact({ hook }: { hook: UseGrowthAgentResult }): JSX.Element {
  // We render the existing ChatPanel but override its container styles via a wrapper
  // that clips its border/bg so the widget shell is used instead.
  return (
    <div className="h-full overflow-hidden [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
      <ChatPanel hook={hook} />
    </div>
  )
}
