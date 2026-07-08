import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentSettingsModal } from './agent-settings'
import type { AgentConfig } from '../types/instagram.types'

describe('AgentSettingsModal', () => {
  const onClose = vi.fn();
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <AgentSettingsModal
        isOpen={false}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders dialog when isOpen is true', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Configurar Agente')).toBeInTheDocument()
  })

  it('renders predefined tag chips', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )
    // Verify some predefined tags are visible (may appear in both chips and selected tags)
    const ferreteriaElements = screen.getAllByText('Ferretería')
    expect(ferreteriaElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Moda')).toBeInTheDocument()
    expect(screen.getByText('Gastronomía')).toBeInTheDocument()
  })

  it('clicking tag chip toggles selection', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    // Ferretería starts selected (default), so aria-label is "Quitar"
    const ferreteriaChip = screen.getByRole('button', { name: /Quitar tema Ferretería/i })
    expect(ferreteriaChip).toHaveAttribute('aria-pressed', 'true')

    // Click to deselect
    fireEvent.click(ferreteriaChip)
    // Now it's "Agregar tema Ferretería"
    const addChip = screen.getByRole('button', { name: /Agregar tema Ferretería/i })
    expect(addChip).toHaveAttribute('aria-pressed', 'false')

    // Click to reselect
    fireEvent.click(addChip)
    expect(addChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('custom tag input adds tag on Enter', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    const input = screen.getByRole('textbox', { name: /Agregar tema personalizado/i })
    fireEvent.change(input, { target: { value: 'Soldadura' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // The custom tag should appear in selected tags
    expect(screen.getByText('Soldadura')).toBeInTheDocument()
  })

  it('custom tag input adds tag on + button click', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    const input = screen.getByRole('textbox', { name: /Agregar tema personalizado/i })
    fireEvent.change(input, { target: { value: 'Carpintería' } })

    const addBtn = screen.getByRole('button', { name: /Agregar tema personalizado/i })
    fireEvent.click(addBtn)

    expect(screen.getByText('Carpintería')).toBeInTheDocument()
  })

  it('does not add duplicate custom tag', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    const input = screen.getByRole('textbox', { name: /Agregar tema personalizado/i })

    // Add "Soldadura" twice
    fireEvent.change(input, { target: { value: 'Soldadura' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'Soldadura' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Should only appear once
    const occurrences = screen.getAllByText('Soldadura')
    expect(occurrences).toHaveLength(1)
  })

  it('save button calls onSave with correct config', async () => {
    onSave.mockClear()

    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    // Set custom prompt
    const textarea = screen.getByRole('textbox', { name: /Instrucciones personalizadas/i })
    fireEvent.change(textarea, { target: { value: 'Sé breve' } })

    // Click save
    const saveBtn = screen.getByRole('button', { name: /Guardar configuración/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          niche: 'Ferretería',
          tags: ['Ferretería'],
          customPrompt: 'Sé breve',
        }),
        undefined,
      )
    })
  })

  it('cancel button calls onClose', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('close ✕ button calls onClose', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    const closeBtn = screen.getByRole('button', { name: /Cerrar/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pre-fills from initialConfig', () => {
    const initialConfig: AgentConfig = {
      niche: 'Moda',
      tags: ['Moda', 'Ropa'],
      customPrompt: 'Usa lenguaje juvenil',
    }

    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={initialConfig}
      />,
    )

    // The textarea should be pre-filled
    const textarea = screen.getByRole('textbox', { name: /Instrucciones personalizadas/i })
    expect(textarea).toHaveValue('Usa lenguaje juvenil')

    // Selected tags should show
    expect(screen.getByText('Ropa')).toBeInTheDocument()
  })

  it('save is disabled when no tags selected', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    // Deselect the only selected tag (Ferretería)
    const ferreteriaChip = screen.getByRole('button', { name: /Quitar tema Ferretería/i })
    fireEvent.click(ferreteriaChip)

    const saveBtn = screen.getByRole('button', { name: /Guardar configuración/i })
    expect(saveBtn).toBeDisabled()
  })

  it('removing a tag removes it from selected list', () => {
    const initialConfig: AgentConfig = {
      niche: 'Moda',
      tags: ['Moda', 'Ropa'],
    }

    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={initialConfig}
      />,
    )

    // Remove "Ropa" from selected list
    const removeBtn = screen.getByRole('button', { name: /Quitar Ropa/i })
    fireEvent.click(removeBtn)

    // Ropa should no longer be in the selected list
    expect(screen.queryByText('Ropa')).not.toBeInTheDocument()
  })

  it('shows character count for custom prompt', () => {
    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialConfig={null}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: /Instrucciones personalizadas/i })
    fireEvent.change(textarea, { target: { value: 'Hello World' } })

    expect(screen.getByText('11/2000 caracteres')).toBeInTheDocument()
  })

  it('does not close modal on save error', async () => {
    const failingSave = vi.fn().mockRejectedValue(new Error('Network error'))

    render(
      <AgentSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={failingSave}
        initialConfig={null}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: /Guardar configuración/i })
    fireEvent.click(saveBtn)

    // Modal should still be open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(failingSave).toHaveBeenCalled()
  })
})
