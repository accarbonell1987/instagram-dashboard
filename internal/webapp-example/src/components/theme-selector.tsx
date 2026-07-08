'use client';

import { getThemesGroupedBySource, type ThemeDefinition } from '@core/config/styles/themes/registry';
import { useColorTheme } from '@core/shared/providers';
import { Button, cn } from '@core/ui';
import * as React from 'react';

// Hoisted to module scope — theme registry is static data (rendering-hoist-jsx)
const groupedThemes = getThemesGroupedBySource();

interface ThemeSelectorProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ThemeSelector({ open = false, onOpenChange }: ThemeSelectorProps) {
  const [mounted, setMounted] = React.useState(false);
  const { colorTheme, setColorTheme } = useColorTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Panel */}
      <div className="bg-card fixed top-4 right-4 z-50 max-h-[90vh] overflow-y-auto rounded-lg border p-4 shadow-lg">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Select Theme</h3>
        <p className="text-muted-foreground text-xs">Change the color theme</p>
      </div>

      {/* Custom/Brand Themes */}
      {groupedThemes.custom.length > 0 && (
        <div className="mb-4">
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Brand
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {groupedThemes.custom.map((theme) => (
              <ThemeButton
                key={theme.name}
                theme={theme}
                isActive={colorTheme === theme.name}
                onClick={() => { setColorTheme(theme.name); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* shadcn Themes */}
      <div>
        <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          shadcn/ui
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {groupedThemes.shadcn.map((theme) => (
            <ThemeButton
              key={theme.name}
              theme={theme}
              isActive={colorTheme === theme.name}
              onClick={() => { setColorTheme(theme.name); }}
            />
          ))}
        </div>
      </div>
      </div>
    </>
  );
}

interface ThemeButtonProps {
  theme: ThemeDefinition;
  isActive: boolean;
  onClick: () => void;
}

function ThemeButton({ theme, isActive, onClick }: ThemeButtonProps) {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className={cn(
        'relative justify-start gap-2',
        isActive && 'ring-primary ring-2 ring-offset-2'
      )}
    >
      <span
        className="h-3 w-3 rounded-full border"
        style={{ backgroundColor: `hsl(${theme.primaryHsl})` }}
      />
      <span className="capitalize">{theme.name}</span>
    </Button>
  );
}
