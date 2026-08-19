'use client'

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@core/ui'
import type { JSX } from 'react'
import { useState } from 'react'


import type { AgentConfig, AgentLimits, AgentSecrets, AgentSettingsSectionKey, ImageGenConfig, LlmConfig } from '../types/instagram.types'

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

type ActiveTab = 'agent' | 'images' | 'model'

/**
 * Every provider here speaks the OpenAI chat-completions protocol, which is why
 * one code path reaches all of them. Claude and Gemini arrive through
 * OpenRouter rather than natively — their own protocols would need a second
 * implementation for the same result.
 */
const LLM_PROVIDERS: { id: string; label: string; hint: string }[] = [
  { id: 'deepseek', label: 'DeepSeek', hint: 'Por defecto. Barato y con buen soporte de herramientas.' },
  { id: 'openai', label: 'OpenAI', hint: 'GPT-4o, GPT-4o mini, o1.' },
  { id: 'openrouter', label: 'OpenRouter', hint: 'Una sola clave para Claude, Gemini, Llama y cientos más.' },
  { id: 'groq', label: 'Groq', hint: 'El más rápido. Llama y Mixtral.' },
  { id: 'together', label: 'Together AI', hint: 'Catálogo amplio de modelos abiertos.' },
  { id: 'custom', label: 'Otro (compatible con OpenAI)', hint: 'Incluye un modelo propio, por ejemplo Ollama.' },
]

/** A starting point per provider — the field stays free text. */
const MODEL_PLACEHOLDERS: Record<string, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4o',
  openrouter: 'anthropic/claude-sonnet-4',
  groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  custom: 'llama3',
}
type PromptTab = 'base' | 'hook' | 'development' | 'cta'

const T2I_MODELS: { id: string; label: string; description: string }[] = [
  { id: 'fal-ai/ideogram/v3', label: 'Ideogram V3', description: 'Tipografía perfecta para logos y carteles. Por defecto.' },
  { id: 'fal-ai/flux/dev', label: 'FLUX.1 dev', description: 'Balance calidad/velocidad, uso comercial libre.' },
  { id: 'fal-ai/flux/schnell', label: 'FLUX.1 schnell', description: 'El más rápido. Ideal para pruebas rápidas.' },
  { id: 'fal-ai/flux-pro/v1.1', label: 'FLUX1.1 pro', description: 'Alta calidad y detalle fino. Premium.' },
  { id: 'fal-ai/flux-2-pro', label: 'FLUX.2 pro', description: 'Último modelo de Black Forest Labs.' },
]

const I2I_MODELS: { id: string; label: string; description: string }[] = [
  { id: 'fal-ai/flux/dev/image-to-image', label: 'FLUX.1 dev img2img', description: 'Transforma tu foto manteniendo la composición. Por defecto.' },
  { id: 'fal-ai/flux-2-pro', label: 'FLUX.2 pro', description: 'Manipulación avanzada y style transfer.' },
]

export type AgentSettingsSurface = 'product' | 'settings'

/**
 * Where each section is edited.
 *
 * Derived from the API's own minimum-role table rather than restated: the three
 * TenantAdmin sections are exactly the credentials and the spend levers, which
 * is what makes them organisation configuration and not day-to-day work. Should
 * the two ever need to diverge — a User-level setting that still belongs in the
 * hub — this is the one place to say so.
 */
const SETTINGS_SURFACE_SECTIONS: readonly AgentSettingsSectionKey[] = ['limits', 'model', 'imageKey']

export function sectionsForSurface(
  sections: readonly AgentSettingsSectionKey[],
  surface: AgentSettingsSurface,
): AgentSettingsSectionKey[] {
  return sections.filter((section) =>
    surface === 'settings'
      ? SETTINGS_SURFACE_SECTIONS.includes(section)
      : !SETTINGS_SURFACE_SECTIONS.includes(section),
  )
}

interface AgentSettingsPanelProps {
  /** Called when the caller is finished — closes the modal, or navigates back. */
  onDone: () => void
  onSave: (config: AgentConfig, secrets?: AgentSecrets) => Promise<void>
  initialConfig: AgentConfig | null
  hasFalApiKey?: boolean
  hasLlmApiKey?: boolean
  /**
   * Which settings sections this caller may change, as decided by the API.
   * Hiding here is cosmetic — PUT /agent/settings refuses the change whatever
   * this screen drew — but drawing a control the caller cannot use only
   * produces a save that comes back 403.
   */
  editableSections?: AgentSettingsSectionKey[]
  /**
   * Which surface is drawing this. The settings screen in the hub shows the
   * tenant-wide controls — model, credentials, spend — and the panel inside the
   * product shows the content preferences. Same component either way: the split
   * is a filter, not a second implementation.
   */
  surface?: AgentSettingsSurface
  /**
   * The settings request failed. Distinct from an empty `editableSections`,
   * which means the caller genuinely may not change anything — the two look
   * identical on screen and need different words.
   */
  settingsFailed?: boolean
}

export function AgentSettingsPanel({
  onDone,
  onSave,
  initialConfig,
  hasFalApiKey = false,
  hasLlmApiKey = false,
  editableSections = [],
  settingsFailed = false,
  surface = 'product',
}: AgentSettingsPanelProps): JSX.Element {
  // 'agent' even when that tab is hidden: Radix activates the only remaining
  // trigger on its own, so computing an opening tab here was dead code.
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

  // Model config. Empty provider means "whatever the platform runs" — the
  // account has not chosen, and the deployment default applies.
  const [llmProvider, setLlmProvider] = useState(initialConfig?.llm?.provider ?? '')
  const [llmModel, setLlmModel] = useState(initialConfig?.llm?.model ?? '')
  const [llmBaseUrl, setLlmBaseUrl] = useState(initialConfig?.llm?.baseUrl ?? '')
  const [llmApiKey, setLlmApiKey] = useState('')
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

      // Only the fields the account actually chose. An empty object here would
      // pin the model to today's default and stop following the platform.
      const llm: LlmConfig = {}
      if (llmProvider) llm.provider = llmProvider
      if (llmModel.trim()) llm.model = llmModel.trim()
      if (llmProvider === 'custom' && llmBaseUrl.trim()) llm.baseUrl = llmBaseUrl.trim()

      await onSave(
        {
          niche: selectedTags[0] ?? '',
          tags: selectedTags,
          ...(customPrompt.trim() ? { customPrompt: customPrompt.trim() } : {}),
          ...(Object.keys(imageGen).length > 0 ? { imageGen } : {}),
          limits,
          ...(Object.keys(llm).length > 0 ? { llm } : {}),
        },
        {
          // Blank means "leave the stored one alone": sending an empty string
          // would replace a working key with nothing.
          ...(falApiKey.trim() ? { falApiKey: falApiKey.trim() } : {}),
          ...(llmApiKey.trim() ? { llmApiKey: llmApiKey.trim() } : {}),
        },
      )
      setFalApiKey('')
      setLlmApiKey('')
      onDone()
    } catch {
      // Error is handled by the parent hook (sets error state)
    } finally {
      setIsSaving(false)
    }
  }

  const PROMPT_TABS: {
    key: PromptTab
    label: string
    value: string
    setValue: (v: string) => void
    placeholder: string
    hint: string
  }[] = [
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

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PROMPT_TABS is a non-empty constant array, so [0] is always defined
  const activePrompt = PROMPT_TABS.find((t) => t.key === activePromptTab) ?? PROMPT_TABS[0]!

  const visibleSections = sectionsForSurface(editableSections, surface)
  const can = (section: AgentSettingsSectionKey) => visibleSections.includes(section)
  // A tab with nothing left in it is not an empty tab, it is no tab.
  const showAgentTab = can('topics') || can('prompt') || can('limits')
  const showImagesTab = can('imageKey') || can('imageModels') || can('imageStyles')

  return (
    <div className="flex min-h-0 flex-col">
        {/* Tabs */}
        {settingsFailed || visibleSections.length === 0 ? (
          <div className="text-muted-foreground px-6 py-10 text-center text-sm">
            {settingsFailed
              ? 'No pudimos cargar la configuración. Volvé a intentarlo en un momento.'
              : 'Tu rol no tiene ninguna opción de configuración habilitada.'}
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ActiveTab); }} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 shrink-0">
            {showAgentTab && <TabsTrigger value="agent">Agente</TabsTrigger>}
            {can('model') && <TabsTrigger value="model">Modelo</TabsTrigger>}
            {showImagesTab && <TabsTrigger value="images">Imágenes</TabsTrigger>}
          </TabsList>

          {/* Tab: Modelo */}
          <TabsContent value="model" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
            <p className="text-muted-foreground text-sm">
              Elegí qué modelo responde por esta cuenta. Si no configurás nada, se usa el de la
              plataforma.
            </p>

            <div>
              <Label htmlFor="llm-provider" className="mb-1 block text-sm font-medium">
                Proveedor
              </Label>
              <Select value={llmProvider} onValueChange={setLlmProvider}>
                <SelectTrigger id="llm-provider">
                  <SelectValue placeholder="El de la plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {llmProvider !== '' && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {LLM_PROVIDERS.find((provider) => provider.id === llmProvider)?.hint}
                </p>
              )}
            </div>

            {/* Free text rather than a list: catalogues change weekly and a
                stale dropdown blocks a model that already works. */}
            <div>
              <Label htmlFor="llm-model" className="mb-1 block text-sm font-medium">
                Modelo
              </Label>
              <Input
                id="llm-model"
                value={llmModel}
                onChange={(e) => { setLlmModel(e.target.value); }}
                placeholder={MODEL_PLACEHOLDERS[llmProvider] ?? 'deepseek-v4-flash'}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                El identificador exacto del proveedor, tal cual aparece en su documentación.
              </p>
            </div>

            {llmProvider === 'custom' && (
              <div>
                <Label htmlFor="llm-base-url" className="mb-1 block text-sm font-medium">
                  Dirección del servicio
                </Label>
                <Input
                  id="llm-base-url"
                  value={llmBaseUrl}
                  onChange={(e) => { setLlmBaseUrl(e.target.value); }}
                  placeholder="http://localhost:11434/v1"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Cualquier servicio compatible con la API de OpenAI, incluido uno propio.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="llm-api-key" className="mb-1 block text-sm font-medium">
                API Key
                {hasLlmApiKey && (
                  <span className="text-success ml-2 text-xs font-normal">✓ Configurada</span>
                )}
              </Label>
              <Input
                id="llm-api-key"
                type="password"
                value={llmApiKey}
                onChange={(e) => { setLlmApiKey(e.target.value); }}
                placeholder={hasLlmApiKey ? 'Dejala vacía para conservar la actual' : 'sk-...'}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Se guarda cifrada y no vuelve a mostrarse. Dejala vacía para no cambiarla.
              </p>
            </div>
          </TabsContent>

          {/* Tab: Imágenes */}
          <TabsContent value="images" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
            <>
              {can('imageKey') && (
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
                  onChange={(e) => { setFalApiKey(e.target.value); }}
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
              )}

              {can('imageModels') && (
              <div className="space-y-3">
                <label className="block text-sm font-medium">Modelos de generación</label>

                <div>
                  <Label htmlFor="t2i-model" className="block text-xs text-muted-foreground mb-1">
                    Texto → Imagen <span className="text-[10px]">(carruseles IA)</span>
                  </Label>
                  <Select value={t2iModel} onValueChange={(v) => { setT2iModel(v); }}>
                    <SelectTrigger id="t2i-model" className="w-full h-9 rounded-md px-3 text-sm" aria-label="Modelo de generación texto a imagen">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Select value={i2iModel} onValueChange={(v) => { setI2iModel(v); }}>
                    <SelectTrigger id="i2i-model" className="w-full h-9 rounded-md px-3 text-sm" aria-label="Modelo de transformación imagen a imagen">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
              )}

              {can('imageStyles') && (
              <div>
                <label className="block text-sm font-medium mb-2">Estilo visual por rol</label>

                {/* Mini tab bar */}
                <Tabs value={activePromptTab} onValueChange={(v) => { setActivePromptTab(v as PromptTab); }}>
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
                  onChange={(e) => { activePrompt.setValue(e.target.value); }}
                  maxLength={1000}
                  rows={4}
                  placeholder={activePrompt.placeholder}
                  className="resize-none"
                  aria-label={`Prompt de estilo — ${activePrompt.label}`}
                />
                <p className="text-xs text-muted-foreground mt-1">{activePrompt.hint}</p>
              </div>
              )}
            </>
          </TabsContent>

          {/* Tab: Agente */}
          <TabsContent value="agent" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
            <>
              {can('topics') && (
              <div>
                <label className="block text-sm font-medium mb-2">Temas de contenido</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PREDEFINED_TAGS.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => { toggleTag(tag); }}
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
                    onChange={(e) => { setCustomTagInput(e.target.value); }}
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
                          onClick={() => { toggleTag(tag); }}
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
              )}

              {can('prompt') && (
              <div>
                <Label htmlFor="agent-custom-prompt" className="block text-sm font-medium mb-2">
                  Instrucciones personalizadas (opcional)
                </Label>
                <Textarea
                  id="agent-custom-prompt"
                  value={customPrompt}
                  onChange={(e) => { setCustomPrompt(e.target.value); }}
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
              )}

              {can('limits') && (
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
                      onChange={(e) => { setSlideTextLimit(Math.min(500, Math.max(50, Number(e.target.value)))); }}
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
                      onChange={(e) => { setVisualPromptLimit(Math.min(1000, Math.max(50, Number(e.target.value)))); }}
                      aria-label="Límite de caracteres para prompt visual"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Controlan el máximo de caracteres en el editor de guiones.
                </p>
              </div>
              )}
            </>
          </TabsContent>
        </Tabs>
        )}

        {/* Actions. Hidden when there is nothing to edit: a Guardar beside "no
            pudimos cargar la configuración" offers to save what was never
            loaded, and Cancelar has nothing to abandon. */}
        {!settingsFailed && visibleSections.length > 0 && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0">
            {/* A page has nowhere to go back to; only the dialog does. */}
            {surface === 'product' && (
              <Button
                variant="outline"
                onClick={onDone}
                type="button"
                disabled={isSaving}
                aria-label="Cancelar"
              >
                Cancelar
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => void handleSave()}
              type="button"
              // The empty-tags guard belongs to the topics section. On the
              // settings surface topics are not even drawn, so applying it
              // there disables Guardar permanently for an admin who only came
              // to change the model.
              disabled={(can('topics') && selectedTags.length === 0) || isSaving}
              aria-label="Guardar configuración"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
    </div>
  )
}

/**
 * The panel in a dialog, for the product shell. The hub's settings screen mounts
 * `AgentSettingsPanel` directly — a page is not an overlay.
 */
export function AgentSettingsModal({
  isOpen,
  onClose,
  ...panelProps
}: Omit<AgentSettingsPanelProps, 'onDone'> & { isOpen: boolean; onClose: () => void }): JSX.Element | null {
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose() }}>
      {/*
        The design system's Dialog, not a hand-rolled portal. The previous shell
        sat at `z-[9999]`, which put it above every Radix popover: a Select
        opened inside it rendered its list behind the panel and read as "the
        dropdown doesn't work". Dialog and Select both live at `z-50` on
        purpose — they are sibling portals, so DOM order decides, and whatever
        opened last wins.
      */}
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 p-0"
        closeLabel="Cerrar"
      >
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Configurar Agente</DialogTitle>
        </DialogHeader>
        <AgentSettingsPanel {...panelProps} onDone={onClose} />
      </DialogContent>
    </Dialog>
  )
}
