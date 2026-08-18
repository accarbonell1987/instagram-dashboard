import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { AgentConfig, AgentSettingsSectionKey  } from '../types/instagram.types'

import { AgentSettingsModal } from './agent-settings'


/** These tests are about the panel; the gate has its own describe block. */
const ALL_SECTIONS: AgentSettingsSectionKey[] = [
  'topics', 'prompt', 'limits', 'model', 'imageKey', 'imageModels', 'imageStyles',
]


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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        // Secrets travel as their own object now. Empty means "change nothing":
        // an empty string would replace a stored key with none.
        {},
      )
    })
  })

  it('cancel button calls onClose', () => {
    render(
      <AgentSettingsModal
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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
        editableSections={ALL_SECTIONS}
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

/**
 * The model stopped being a property of the deployment. An account picks its
 * own provider, model and key; configuring nothing keeps the platform default.
 */
describe('AgentSettingsModal — model tab', () => {
  const onClose = vi.fn()
  const onSave = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    onSave.mockResolvedValue(undefined)
  })

  // Radix tabs switch on the full pointer sequence, which fireEvent.click does
  // not send — the panel would never mount and every query would miss.
  async function openModelTab(initialConfig: AgentConfig | null = null, hasLlmApiKey = false) {
    render(
      <AgentSettingsModal
        editableSections={ALL_SECTIONS}
        isOpen
        onClose={onClose}
        onSave={onSave}
        initialConfig={initialConfig}
        hasLlmApiKey={hasLlmApiKey}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Modelo' }))
  }

  it('sends the chosen provider and model', async () => {
    await openModelTab()

    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), { target: { value: 'gpt-4o' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    })
    const config = onSave.mock.calls[0]?.[0] as { llm?: { model?: string } }
    expect(config.llm?.model).toBe('gpt-4o')
  })

  /**
   * The backend treats a present key as a replacement, so sending an empty
   * string would wipe a working one. Blank has to mean "leave it alone".
   */
  it('omits the key when the field is left blank', async () => {
    await openModelTab(null, true)

    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    })
    const secrets = onSave.mock.calls[0]?.[1] as Record<string, unknown>
    expect(secrets).not.toHaveProperty('llmApiKey')
  })

  it('sends the key when one is typed', async () => {
    await openModelTab()

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    })
    const secrets = onSave.mock.calls[0]?.[1] as { llmApiKey?: string }
    expect(secrets.llmApiKey).toBe('sk-secret')
  })

  // Nothing chosen must stay nothing: writing today's default into the account
  // would pin it there and stop it following the platform.
  it('sends no llm block when nothing was chosen', async () => {
    await openModelTab()

    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    })
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('llm')
  })

  it('says when a key is already stored', async () => {
    await openModelTab(null, true)
    // The placeholder is the honest signal: the key itself never comes back.
    expect(
      screen.getByPlaceholderText('Dejala vacía para conservar la actual'),
    ).toBeInTheDocument()
  })

  /**
   * Hiding is cosmetic — the API refuses the change regardless — but drawing a
   * control the caller cannot use only produces a save that comes back 403.
   */
  describe('permitted sections', () => {
    const renderWith = (sections: AgentSettingsSectionKey[]) =>
      render(
        <AgentSettingsModal
          editableSections={sections}
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          initialConfig={null}
        />,
      )

    it('hides the Modelo tab from a caller who cannot change the model', () => {
      renderWith(['topics', 'prompt'])

      expect(screen.queryByRole('tab', { name: 'Modelo' })).not.toBeInTheDocument()
    })

    it('shows the Modelo tab when the caller may change it', () => {
      renderWith(['model'])

      expect(screen.getByRole('tab', { name: 'Modelo' })).toBeInTheDocument()
    })

    // The three admin-only options, each hidden on its own while its tab stays.
    it('keeps the Agente tab but drops the character limits', () => {
      renderWith(['topics', 'prompt'])

      expect(screen.getByRole('tab', { name: 'Agente' })).toBeInTheDocument()
      expect(screen.getByText('Temas de contenido')).toBeInTheDocument()
      expect(screen.queryByText('Límites de caracteres')).not.toBeInTheDocument()
    })

    it('keeps the Imágenes tab but drops the fal.ai key', () => {
      renderWith(['imageModels', 'imageStyles'])

      expect(screen.getByRole('tab', { name: 'Imágenes' })).toBeInTheDocument()
      expect(screen.queryByText('API Key de fal.ai')).not.toBeInTheDocument()
    })

    // A tab with nothing left in it is not an empty tab, it is no tab.
    it('drops a tab whose every option is withheld', () => {
      renderWith(['topics'])

      expect(screen.queryByRole('tab', { name: 'Imágenes' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Modelo' })).not.toBeInTheDocument()
    })

    // Opening on a hidden tab would leave the panel blank.
    it('opens on the first tab the caller can actually see', () => {
      renderWith(['model'])

      expect(screen.getByRole('tab', { name: 'Modelo' })).toHaveAttribute('aria-selected', 'true')
    })
  })
})
