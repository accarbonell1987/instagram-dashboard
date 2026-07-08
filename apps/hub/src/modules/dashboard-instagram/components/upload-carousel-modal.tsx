'use client'

import type { JSX, ChangeEvent } from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@core/ui'
import { X, Upload, ImagePlus, Trash2, Sparkles, ChevronUp, ChevronDown } from 'lucide-react'
import type { SlideRole, UploadSlideInput } from '../types/instagram.types'
import { createUploadCarousel, uploadSlideImage } from '../services/instagram.service'

interface UploadSlide {
  file: File | null
  preview: string | null
  text: string
  imageMode: 'uploaded' | 'img2img'
  visualPrompt: string
  role: SlideRole
}

function makeSlide(): UploadSlide {
  return { file: null, preview: null, text: '', imageMode: 'uploaded', visualPrompt: '', role: 'default' }
}

const ROLE_OPTIONS: Array<{ value: SlideRole; label: string }> = [
  { value: 'hook', label: 'Hook' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'cta', label: 'CTA' },
  { value: 'default', label: 'Normal' },
]

interface SlideEditorProps {
  slide: UploadSlide
  index: number
  total: number
  onChange: (patch: Partial<UploadSlide>) => void
  onRemove: () => void
  onMove: (direction: 'up' | 'down') => void
}

function SlideEditor({ slide, index, total, onChange, onRemove, onMove }: SlideEditorProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    onChange({ file, preview })
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Slide {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === 0}
            onClick={() => onMove('up')}
            aria-label="Mover arriba"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === total - 1}
            onClick={() => onMove('down')}
            aria-label="Mover abajo"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Select value={slide.role} onValueChange={(v) => onChange({ role: v as SlideRole })}>
            <SelectTrigger className="h-6 rounded border bg-background px-1 text-[10px] text-muted-foreground focus:outline-none [&_svg]:hidden" aria-label="Rol del slide">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label="Eliminar slide"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Image picker */}
        <Button
          type="button"
          variant="outline"
          className="shrink-0 h-28 w-[88px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/50 transition-colors overflow-hidden"
          onClick={() => fileInputRef.current?.click()}
          aria-label={slide.preview ? 'Cambiar imagen' : 'Seleccionar imagen'}
        >
          {slide.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
              <span className="text-[10px] text-muted-foreground/60 text-center leading-tight px-1">
                Subir foto
              </span>
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Fields */}
        <div className="flex-1 space-y-2">
          <Textarea
            value={slide.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Texto del slide (overlay)"
            rows={2}
            maxLength={150}
            className="rounded-lg px-2.5 py-1.5 text-xs resize-none"
          />

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ imageMode: 'uploaded' })}
              className={`flex-1 h-7 rounded-md border text-[11px] font-medium transition-colors ${
                slide.imageMode === 'uploaded'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted-foreground/20 text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <Upload className="h-3 w-3 inline mr-1" aria-hidden="true" />
              Usar tal cual
            </button>
            <button
              type="button"
              onClick={() => onChange({ imageMode: 'img2img' })}
              className={`flex-1 h-7 rounded-md border text-[11px] font-medium transition-colors ${
                slide.imageMode === 'img2img'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted-foreground/20 text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <Sparkles className="h-3 w-3 inline mr-1" aria-hidden="true" />
              Transformar con IA
            </button>
          </div>

          {slide.imageMode === 'img2img' && (
            <Input
              type="text"
              value={slide.visualPrompt}
              onChange={(e) => onChange({ visualPrompt: e.target.value })}
              placeholder="Prompt de transformación…"
              maxLength={300}
              className="rounded-lg px-2.5 py-1.5 text-xs"
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface UploadCarouselModalProps {
  onClose: () => void
  onCreated: (id: string) => void
}

type SubmitPhase = 'idle' | 'creating' | 'uploading' | 'done'

export function UploadCarouselModal({ onClose, onCreated }: UploadCarouselModalProps): JSX.Element | null {
  const [topic, setTopic] = useState('')
  const [slides, setSlides] = useState<UploadSlide[]>([makeSlide(), makeSlide()])
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const updateSlide = useCallback((index: number, patch: Partial<UploadSlide>) => {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }, [])

  const removeSlide = useCallback((index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const moveSlide = useCallback((index: number, direction: 'up' | 'down') => {
    setSlides((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      const swapVal = next[target]!
      next[target] = next[index]!
      next[index] = swapVal
      return next
    })
  }, [])

  const canSubmit =
    topic.trim().length > 0 &&
    slides.length >= 2 &&
    slides.every((s) => s.file !== null && s.text.trim().length > 0 && (s.imageMode === 'uploaded' || s.visualPrompt.trim().length > 0))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError(null)
    setPhase('creating')

    const slideInputs: UploadSlideInput[] = slides.map((s, i) => ({
      order: i + 1,
      role: s.role,
      text: s.text.trim(),
      imageMode: s.imageMode,
      ...(s.imageMode === 'img2img' && { visualPrompt: s.visualPrompt.trim() }),
    }))

    let carouselResult: { id: string; slides: Array<{ id: string; order: number }> }
    try {
      carouselResult = await createUploadCarousel(topic.trim(), slideInputs)
    } catch {
      setError('Error al crear el carrusel. Intentá de nuevo.')
      setPhase('idle')
      return
    }

    setPhase('uploading')
    setUploadProgress({ done: 0, total: slides.length })

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]!
      const slideRecord = carouselResult.slides.find((s) => s.order === i + 1)
      if (!slideRecord || !slide.file) continue

      try {
        await uploadSlideImage(carouselResult.id, slideRecord.id, slide.file)
      } catch {
        // Continue uploading others — backend marks individual slides as failed
      }
      setUploadProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setPhase('done')
    onCreated(carouselResult.id)
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Crear carrusel con fotos propias">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Carrusel con mis fotos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Subí imágenes y configurá cada slide</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Topic */}
          <div className="space-y-1.5">
            <Label htmlFor="carousel-topic" className="text-xs font-medium">Tema del carrusel</Label>
            <Input
              id="carousel-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Los beneficios de nuestro producto estrella"
              maxLength={200}
              className="rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Slides */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{slides.length} slide{slides.length !== 1 ? 's' : ''} <span className="text-muted-foreground font-normal">(mín. 2, máx. 10)</span></p>
              {slides.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setSlides((prev) => [...prev, makeSlide()])}
                >
                  <ImagePlus className="h-3 w-3" aria-hidden="true" />
                  Agregar slide
                </Button>
              )}
            </div>

            {slides.map((slide, i) => (
              <SlideEditor
                key={i}
                slide={slide}
                index={i}
                total={slides.length}
                onChange={(patch) => updateSlide(i, patch)}
                onRemove={() => removeSlide(i)}
                onMove={(dir) => moveSlide(i, dir)}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex items-center justify-between gap-3">
          {phase === 'uploading' ? (
            <p className="text-xs text-muted-foreground flex-1">
              Subiendo imágenes… {uploadProgress.done}/{uploadProgress.total}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground flex-1">
              {!canSubmit && slides.some((s) => !s.file) && 'Faltan imágenes en algunos slides'}
            </p>
          )}
          <div className="flex gap-2 shrink-0">
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClose} disabled={phase !== 'idle'}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 min-w-[100px] gap-1.5"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || phase !== 'idle'}
            >
              {phase === 'creating' ? (
                <><div className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creando…</>
              ) : phase === 'uploading' ? (
                <><div className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Subiendo…</>
              ) : (
                <><Upload className="h-3.5 w-3.5" aria-hidden="true" />Crear carrusel</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
