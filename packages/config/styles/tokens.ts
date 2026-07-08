/**
 * Design Token Types
 *
 * TypeScript type definitions for design tokens.
 * These types are derived from the JSON token files.
 */

// Color scale names
export type ColorScale =
  | 'zinc'
  | 'slate'
  | 'gray'
  | 'neutral'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

// Color scale steps
export type ColorStep =
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | '950';

// Semantic color tokens (shadcn/ui compatible)
export type SemanticColorToken =
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'border'
  | 'input'
  | 'ring';

// Chart color tokens
export type ChartColorToken = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5';

// Sidebar color tokens
export type SidebarColorToken =
  | 'sidebar-background'
  | 'sidebar-foreground'
  | 'sidebar-primary'
  | 'sidebar-primary-foreground'
  | 'sidebar-accent'
  | 'sidebar-accent-foreground'
  | 'sidebar-border'
  | 'sidebar-ring';

// Spacing tokens
export type SpacingToken =
  | '0'
  | 'px'
  | 'half'
  | '1'
  | '1half'
  | '2'
  | '2half'
  | '3'
  | '3half'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '14'
  | '16'
  | '20'
  | '24'
  | '28'
  | '32'
  | '36'
  | '40'
  | '44'
  | '48'
  | '52'
  | '56'
  | '60'
  | '64'
  | '72'
  | '80'
  | '96';

// Radius tokens
export type RadiusToken = 'none' | 'sm' | 'default' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

// Shadow tokens
export type ShadowToken = 'sm' | 'default' | 'md' | 'lg' | 'xl' | '2xl' | 'inner' | 'none';

// Font family tokens
export type FontFamilyToken = 'sans' | 'serif' | 'mono';

// Font size tokens
export type FontSizeToken =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl'
  | '8xl'
  | '9xl';

// Font weight tokens
export type FontWeightToken =
  | 'thin'
  | 'extralight'
  | 'light'
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold'
  | 'black';

// Duration tokens
export type DurationToken =
  | '0'
  | '75'
  | '100'
  | '150'
  | '200'
  | '300'
  | '500'
  | '700'
  | '1000'
  | 'fast'
  | 'normal'
  | 'slow'
  | 'slower';

// Easing tokens
export type EasingToken = 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut';

/**
 * Color definition for theme palette
 */
export interface ColorDefinition {
  light: string; // HSL value for light mode
  dark: string; // HSL value for dark mode
  description?: string; // Human-readable description
}

/**
 * Theme color palette
 */
export interface ThemeColorPalette {
  primary: ColorDefinition;
  secondary?: ColorDefinition;
  accent?: ColorDefinition;
  destructive?: ColorDefinition;
}

/**
 * Base tokens for programmatic access
 */
export const baseTokens = {
  name: 'Base',
  description: 'Default shadcn/ui design system - neutral and clean',

  fonts: {
    sans: 'Inter',
    serif: 'Georgia',
    mono: 'JetBrains Mono',
  },

  radius: {
    none: '0',
    sm: 'calc(var(--radius) - 4px)',
    md: 'calc(var(--radius) - 2px)',
    lg: 'var(--radius)',
    xl: 'calc(var(--radius) + 4px)',
    full: '9999px',
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
} as const;

export type BaseTokens = typeof baseTokens;

/**
 * Theme tokens type for app-specific themes
 */
export interface ThemeTokens {
  name: string;
  description: string;
  author?: string;
  version?: string;
  fonts: {
    sans: string;
    serif: string;
    mono: string;
  };
  colors?: ThemeColorPalette;
  radius: string | BaseTokens['radius']; // Can be a simple string like "0.5rem" or the full object
  spacing: BaseTokens['spacing'];
}

/**
 * Theme configuration input for createThemeTokens
 */
export interface ThemeConfig {
  name: string;
  description: string;
  author?: string;
  version?: string;
  fonts?: Partial<ThemeTokens['fonts']>;
  colors?: ThemeColorPalette;
  radius?: string; // Simple string override like "0.5rem", "0.75rem"
}

/**
 * Helper to create app-specific theme tokens that extend the base
 *
 * @example
 * ```ts
 * const theme = createThemeTokens({
 *   name: 'Corporate',
 *   description: 'Professional enterprise theme',
 *   colors: {
 *     primary: {
 *       light: 'hsl(239, 84%, 45%)',
 *       dark: 'hsl(239, 84%, 65%)',
 *       description: 'Deep indigo for authority'
 *     }
 *   },
 *   radius: '0.375rem'
 * });
 * ```
 */
export function createThemeTokens(config: ThemeConfig): ThemeTokens {
  const theme: ThemeTokens = {
    name: config.name,
    description: config.description,
    fonts: {
      ...baseTokens.fonts,
      ...config.fonts,
    },
    radius: config.radius || baseTokens.radius,
    spacing: baseTokens.spacing,
  };

  // Add optional properties only if defined
  if (config.author !== undefined) {
    theme.author = config.author;
  }
  if (config.version !== undefined) {
    theme.version = config.version;
  }
  if (config.colors !== undefined) {
    theme.colors = config.colors;
  }

  return theme;
}

/**
 * Helper to get a CSS variable reference
 */
export function cssVar(name: string): string {
  return `var(--${name})`;
}

/**
 * Helper to get a semantic color as HSL
 */
export function hslVar(name: SemanticColorToken | ChartColorToken | SidebarColorToken): string {
  return `hsl(var(--${name}))`;
}

/**
 * Helper to get a primitive color variable
 */
export function primitiveColorVar(scale: ColorScale, step: ColorStep): string {
  return cssVar(`color-${scale}-${step}`);
}

/**
 * Get color from theme palette
 *
 * @example
 * ```ts
 * const primary = getThemeColor(myTheme, 'primary', 'light');
 * // Returns: 'hsl(239, 84%, 45%)'
 * ```
 */
export function getThemeColor(
  theme: ThemeTokens,
  color: keyof ThemeColorPalette,
  mode: 'light' | 'dark' = 'light'
): string | undefined {
  return theme.colors?.[color]?.[mode];
}

/**
 * Check if theme has custom colors defined
 */
export function hasCustomColors(theme: ThemeTokens): boolean {
  return !!theme.colors && Object.keys(theme.colors).length > 0;
}

/**
 * Get all colors from theme palette
 */
export function getThemePalette(
  theme: ThemeTokens,
  mode: 'light' | 'dark' = 'light'
): Record<string, string> {
  if (!theme.colors) return {};

  const palette: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme.colors)) {
    palette[key] = value[mode];
  }

  return palette;
}

/**
 * Generate CSS custom properties from theme colors
 *
 * @example
 * ```ts
 * const cssVars = generateThemeVars(myTheme, 'light');
 * // Returns: { '--primary': '239 84% 45%', ... }
 * ```
 */
export function generateThemeVars(
  theme: ThemeTokens,
  mode: 'light' | 'dark' = 'light'
): Record<string, string> {
  const vars: Record<string, string> = {};

  if (theme.colors) {
    for (const [key, value] of Object.entries(theme.colors)) {
      // Extract HSL values without 'hsl()' wrapper
      const hslValue = value[mode].replace(/^hsl\(|\)$/g, '').trim();
      vars[`--${key}`] = hslValue;
    }
  }

  // Add radius if it's a simple string
  if (typeof theme.radius === 'string') {
    vars['--radius'] = theme.radius;
  }

  return vars;
}
