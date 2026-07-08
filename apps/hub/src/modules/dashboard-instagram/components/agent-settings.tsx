'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@core/ui'

import type { AgentConfig, AgentLimits, ImageGenConfig } from '../types/instagram.types'

const PREDEFINED_TAGS = [
  'Ferretería',
  'Moda',
  'Gastronomía',
  'Tecnología',
  'Mascotas',
  'Belleza',
  'Fitness',
  'Bienes Raíces',
  'Salud',
  'Educación',
  'Consultoría',
  'Arte',
  'Música',
  'Fotografía',
  'Manualidades',
  'Viajes',
  'Automotriz',
  'Finanzas',
  'Gaming',
]

type ActiveTab = 'agent' | 'images'
type PromptTab = 'base' | 'hook' | 'development' | 'cta'

const T2I_MODELS: Array<{ id: string; label: string; description: string }> = [
  { id: 'fal-ai/ideogram/v3', label: 'Ideogram V3', description: 'Tipografía perfecta para logos y carteles. Por defecto.' },
  { id: 'fal-ai/flux/dev', label: 'FLUX.1 dev', description: 'Balance calidad/velocidad, uso comercial libre.' },
  { id: 'fal-ai/flux/schnell', label: 'FLUX.1 schnell', description: 'El más rápido. Ideal para pruebas rápidas.' },
  { id: 'fal-ai/flux-pro/v1.1', label: 'FLUX1.1 pro', description: 'Alta calidad y detalle fino. Premium.' },
  { id: 'fal-ai/flux-2-pro', label: 'FLUX.2 pro', description: 'Último modelo de Black Forest Labs.' },
]

const I2I_MODELS: Array<{ id: string; label: string; description: string }> = [
  { id: 'fal-ai/flux/dev/image-to-image', label: 'FLUX.1 dev img2img', description: 'Transforma tu foto manteniendo la composición. Por defecto.' },
  { id: 'fal-ai/flux-2-pro', label: 'FLUX.2 pro', description: 'Manipulación avanzada y style transfer.' },
]

interface AgentSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: AgentConfig, falApiKey?: string) => Promise<void>
  initialConfig: AgentConfig | null
  hasFalApiKey?: boolean
}

export function AgentSettingsModal({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  hasFalApiKey = false,
}: AgentSettingsModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<ActiveTab>('agent')
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialConfig?.tags ?? ['Ferretería'],
  )
  const [customTagInput, setCustomTagInput] = useState('')
  const [customPrompt, setCustomPrompt] = useState(
    initialConfig?.customPrompt ??
    'Eres un experto en marketing digital para negocios locales. Enfócate en productos de alta demanda, tips prácticos y promociones atractivas. Usa un tono profesional pero cercano. Genera ideas que eduquen al cliente, muestren la variedad del negocio y generen confianza en la marca.',
  )
  const [isSaving, setIsSaving] = useState(false)

  // Character limits
  const [slideTextLimit, setSlideTextLimit] = useState(initialConfig?.limits?.slideText ?? 150)
  const [visualPromptLimit, setVisualPromptLimit] = useState(initialConfig?.limits?.visualPrompt ?? 300)

  // Image generation config
  const [falApiKey, setFalApiKey] = useState('')
  const [t2iModel, setT2iModel] = useState(initialConfig?.imageGen?.t2iModel ?? 'fal-ai/ideogram/v3')
  const [i2iModel, setI2iModel] = useState(initialConfig?.imageGen?.i2iModel ?? 'fal-ai/flux/dev/image-to-image')
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>('base')
  const [basePrompt, setBasePrompt] = useState(
    initialConfig?.imageGen?.basePrompt ??
    'Fotografía comercial profesional, iluminación suave y uniforme, fondo claro neutro (blanco o gris perla), colores cálidos y confiables, tipografía bold sans-serif en tonos oscuros, composición limpia y ordenada, estilo moderno y aspiracional.',
  )
  const [hookPrompt, setHookPrompt] = useState(
    initialConfig?.imageGen?.hookPrompt ??
    'Composición dinámica con el producto principal en primer plano y gran protagonismo visual, colores más vibrantes y contrastados que el resto del carrusel, tipografía extra-bold de impacto, fondo con degradado sutil. Diseñado para detener el scroll.',
  )
  const [developmentPrompt, setDevelopmentPrompt] = useState(
    initialConfig?.imageGen?.developmentPrompt ??
    'Layout dividido: producto o icono a la izquierda, texto explicativo a la derecha. Paleta coherente con el slide de portada. Iconografía simple y clara. Espaciado generoso, fácil lectura en mobile.',
  )
  const [ctaPrompt, setCtaPrompt] = useState(
    initialConfig?.imageGen?.ctaPrompt ??
    'Fondo sólido en color de marca (azul marino o verde oscuro), texto de llamada a la acción grande y centrado en blanco, logotipo visible en esquina inferior, sensación de confianza y urgencia moderada. Sin ruido visual.',
  )

  if (!isOpen) return null

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const addCustomTag = () => {
    const trimmed = customTagInput.trim()
    if (!trimmed || selectedTags.includes(trimmed)) return
    setSelectedTags((prev) => [...prev, trimmed])
    setCustomTagInput('')
  }

  const handleCustomTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomTag()
    }
  }

  const handleSave = async () => {
    if (selectedTags.length === 0) return
    if (isSaving) return
    setIsSaving(true)
    try {
      const imageGen: ImageGenConfig = {}
      if (basePrompt.trim()) imageGen.basePrompt = basePrompt.trim()
      if (hookPrompt.trim()) imageGen.hookPrompt = hookPrompt.trim()
      if (developmentPrompt.trim()) imageGen.developmentPrompt = developmentPrompt.trim()
      if (ctaPrompt.trim()) imageGen.ctaPrompt = ctaPrompt.trim()
      imageGen.t2iModel = t2iModel
      imageGen.i2iModel = i2iModel

      const limits: AgentLimits = {
        slideText: slideTextLimit,
        visualPrompt: visualPromptLimit,
      }

      await onSave(
        {
          niche: selectedTags[0] ?? '',
          tags: selectedTags,
          ...(customPrompt.trim() ? { customPrompt: customPrompt.trim() } : {}),
          ...(Object.keys(imageGen).length > 0 ? { imageGen } : {}),
          limits,
        },
        falApiKey.trim() ? falApiKey.trim() : undefined,
      )
      setFalApiKey('')
      onClose()
    } catch {
      // Error is handled by the parent hook (sets error state)
    } finally {
      setIsSaving(false)
    }
  }

  const PROMPT_TABS: Array<{
    key: PromptTab
    label: string
    value: string
    setValue: (v: string) => void
    placeholder: string
    hint: string
  }> = [
    {
      key: 'base',
      label: 'Base',
      value: basePrompt,
      setValue: setBasePrompt,
      placeholder: 'Ej: Estilo minimalista, colores neutros, tipografía sans-serif, fotografía lifestyle...',
      hint: 'Se aplica a todos los slides que no tienen prompt propio.',
    },
    {
      key: 'hook',
      label: 'Hook',
      value: hookPrompt,
      setValue: setHookPrompt,
      placeholder: 'Vacío = usa el prompt base...',
      hint: 'Primer slide — el gancho visual que detiene el scroll.',
    },
    {
      key: 'development',
      label: 'Desarrollo',
      value: developmentPrompt,
      setValue: setDevelopmentPrompt,
      placeholder: 'Vacío = usa el prompt base...',
      hint: 'Slides de contenido — cuerpo del carrusel.',
    },
    {
      key: 'cta',
      label: 'CTA',
      value: ctaPrompt,
      setValue: setCtaPrompt,
      placeholder: 'Vacío = usa el prompt base...',
      hint: 'Último slide — llamada a la acción.',
    },
  ]

  const activePrompt = PROMPT_TABS.find((t) => t.key === activePromptTab) ?? PROMPT_TABS[0]!

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Configuración del agente"
    >
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-semibold">Configurar Agente</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground"
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 shrink-0">
            <TabsTrigger value="agent">Agente</TabsTrigger>
            <TabsTrigger value="images">Imágenes</TabsTrigger>
          </TabsList>

          {/* Tab: Imágenes */}
          <TabsContent value="images" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
            <>
              {/* FAL API Key */}
              <div>
                <Label htmlFor="fal-api-key" className="block text-sm font-medium mb-1">
                  API Key de fal.ai
                  {hasFalApiKey && (
                    <span className="ml-2 text-xs text-green-600 font-normal">✓ Configurada</span>
                  )}
                </Label>
                <Input
                  id="fal-api-key"
                  type="password"
                  value={falApiKey}
                  onChange={(e) => setFalApiKey(e.target.value)}
                  placeholder={hasFalApiKey ? 'Dejar vacío para mantener la actual' : 'fal_xxxxxxxxxxxx'}
                  className="font-mono"
                  aria-label="API Key de fal.ai"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Obtén tu API key en{' '}
                  <a
                    href="https://fal.ai/dashboard/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    fal.ai/dashboard/keys
                  </a>
                  {'. '}
                  <a
                    href="https://fal.ai/dashboard/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Ver crédito disponible →
                  </a>
                </p>
              </div>

              {/* Model selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Modelos de generación</label>

                <div>
                  <Label htmlFor="t2i-model" className="block text-xs text-muted-foreground mb-1">
                    Texto → Imagen <span className="text-[10px]">(carruseles IA)</span>
                  </Label>
                  <Select value={t2iModel} onValueChange={(v) => setT2iModel(v)}>
                    <SelectTrigger id="t2i-model" className="w-full h-9 rounded-md px-3 text-sm" aria-label="Modelo de generación texto a imagen">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {T2I_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {T2I_MODELS.find((m) => m.id === t2iModel)?.description}
                  </p>
                </div>

                <div>
                  <Label htmlFor="i2i-model" className="block text-xs text-muted-foreground mb-1">
                    Imagen → Imagen <span className="text-[10px]">(transformar con fal.ai)</span>
                  </Label>
                  <Select value={i2iModel} onValueChange={(v) => setI2iModel(v)}>
                    <SelectTrigger id="i2i-model" className="w-full h-9 rounded-md px-3 text-sm" aria-label="Modelo de transformación imagen a imagen">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {I2I_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {I2I_MODELS.find((m) => m.id === i2iModel)?.description}
                  </p>
                </div>
              </div>

              {/* Prompt por rol — mini-tabs */}
              <div>
                <label className="block text-sm font-medium mb-2">Estilo visual por rol</label>

                {/* Mini tab bar */}
                <Tabs value={activePromptTab} onValueChange={(v) => setActivePromptTab(v as PromptTab)}>
                  <TabsList className="mb-3 w-full">
                    {PROMPT_TABS.map((t) => (
                      <TabsTrigger key={t.key} value={t.key} className="flex-1 text-xs">{t.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {/* Active prompt textarea */}
                <Textarea
                  key={activePromptTab}
                  value={activePrompt.value}
                  onChange={(e) => activePrompt.setValue(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder={activePrompt.placeholder}
                  className="resize-none"
                  aria-label={`Prompt de estilo — ${activePrompt.label}`}
                />
                <p className="text-xs text-muted-foreground mt-1">{activePrompt.hint}</p>
              </div>
            </>
          </TabsContent>

          {/* Tab: Agente */}
          <TabsContent value="agent" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
            <>
              {/* Tag selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Temas de contenido</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PREDEFINED_TAGS.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      type="button"
                      className="rounded-full"
                      aria-pressed={selectedTags.includes(tag)}
                      aria-label={`${selectedTags.includes(tag) ? 'Quitar' : 'Agregar'} tema ${tag}`}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>

                {/* Custom tag input */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={handleCustomTagKeyDown}
                    placeholder="Agregar tema..."
                    className="flex-1"
                    aria-label="Agregar tema personalizado"
                    maxLength={50}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addCustomTag}
                    type="button"
                    disabled={!customTagInput.trim()}
                    aria-label="Agregar tema personalizado"
                  >
                    +
                  </Button>
                </div>

                {/* Selected tags */}
                {selectedTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1 self-center">Seleccionados:</span>
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {tag}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleTag(tag)}
                          type="button"
                          className="text-primary/60 hover:text-primary"
                          aria-label={`Quitar ${tag}`}
                        >
                          ✕
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom prompt */}
              <div>
                <Label htmlFor="agent-custom-prompt" className="block text-sm font-medium mb-2">
                  Instrucciones personalizadas (opcional)
                </Label>
                <Textarea
                  id="agent-custom-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Ej: Sé conciso, usa ejemplos concretos..."
                  className="resize-none"
                  aria-label="Instrucciones personalizadas"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {customPrompt.length}/2000 caracteres
                </p>
              </div>

              {/* Character limits */}
              <div>
                <label className="block text-sm font-medium mb-2">Límites de caracteres</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="limit-slide-text" className="block text-xs text-muted-foreground mb-1">
                      Texto de slide (español)
                    </Label>
                    <Input
                      id="limit-slide-text"
                      type="number"
                      min={50}
                      max={500}
                      value={slideTextLimit}
                      onChange={(e) => setSlideTextLimit(Math.min(500, Math.max(50, Number(e.target.value))))}
                      aria-label="Límite de caracteres para texto de slide"
                    />
                  </div>
                  <div>
                    <Label htmlFor="limit-visual-prompt" className="block text-xs text-muted-foreground mb-1">
                      Prompt visual (inglés)
                    </Label>
                    <Input
                      id="limit-visual-prompt"
                      type="number"
                      min={50}
                      max={1000}
                      value={visualPromptLimit}
                      onChange={(e) => setVisualPromptLimit(Math.min(1000, Math.max(50, Number(e.target.value))))}
                      aria-label="Límite de caracteres para prompt visual"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Controlan el máximo de caracteres en el editor de guiones.
                </p>
              </div>
            </>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            type="button"
            disabled={isSaving}
            aria-label="Cancelar"
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={() => void handleSave()}
            type="button"
            disabled={selectedTags.length === 0 || isSaving}
            aria-label="Guardar configuración"
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
