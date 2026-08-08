'use client';

import {
  getThemesGroupedBySource,
  type ThemeDefinition,
} from '@core/config/styles/themes/registry';
import { useColorTheme } from '@core/shared/providers';
import { Button, cn } from '@core/ui';
import { useState, type JSX } from 'react';
import { toast } from 'sonner';

import { updateTenantColorTheme } from '@/modules/iam/admin/services/organization.service';

// Static registry data — hoisted so it is not rebuilt on every render.
const groupedThemes = getThemesGroupedBySource();

interface VisualStyleCardProps {
  /** Theme currently stored for the tenant; null while loading or unset. */
  colorTheme: string | null;
  isLoading: boolean;
  onSaved: (colorTheme: string) => void;
}

/**
 * Lets an admin pick the visual style for the whole organisation.
 *
 * Picking applies the theme immediately for the admin so the choice can be
 * judged on the real UI instead of a swatch; everyone else in the tenant gets
 * it the next time they open the app.
 */
export function VisualStyleCard({
  colorTheme,
  isLoading,
  onSaved,
}: VisualStyleCardProps): JSX.Element {
  const { colorTheme: activeTheme, setColorTheme } = useColorTheme();
  const [saving, setSaving] = useState<string | null>(null);

  async function handlePick(theme: string): Promise<void> {
    const previous = activeTheme;
    setSaving(theme);
    // Optimistic: show the theme while the request is in flight, roll back if
    // it fails so the admin never leaves believing a style was saved.
    setColorTheme(theme);
    try {
      await updateTenantColorTheme(theme);
      onSaved(theme);
      toast.success('Estilo visual actualizado para toda la organización');
    } catch {
      setColorTheme(previous);
      toast.error('No pudimos guardar el estilo visual. Intentá de nuevo.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h3 className="text-foreground text-lg font-medium">Estilo visual</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        El estilo que elijas se aplica a todas las personas de tu organización cuando abren el
        sistema.
      </p>

      {isLoading ? (
        <div className="bg-muted mt-4 h-24 animate-pulse rounded-md" />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {groupedThemes.shadcn.map((theme) => (
            <ThemeButton
              key={theme.name}
              theme={theme}
              isActive={colorTheme === theme.name}
              isSaving={saving === theme.name}
              onClick={() => {
                void handlePick(theme.name);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ThemeButtonProps {
  theme: ThemeDefinition;
  isActive: boolean;
  isSaving: boolean;
  onClick: () => void;
}

function ThemeButton({ theme, isActive, isSaving, onClick }: ThemeButtonProps): JSX.Element {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={isSaving}
      aria-pressed={isActive}
      className={cn('justify-start gap-2', isActive && 'ring-primary ring-2 ring-offset-2')}
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full border"
        style={{ backgroundColor: `hsl(${theme.primaryHsl})` }}
      />
      <span className="truncate capitalize">{theme.name}</span>
    </Button>
  );
}
