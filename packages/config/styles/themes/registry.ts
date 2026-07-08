/**
 * Theme Registry
 *
 * Central source of truth for all available themes.
 * Supports both shadcn upstream themes and custom organization themes.
 *
 * @example
 * ```typescript
 * import { themeRegistry, getTheme, getAllThemes } from '@core/config/styles/themes/registry';
 *
 * // Get a specific theme
 * const ambar = getTheme('ambar');
 *
 * // Get all available themes
 * const themes = getAllThemes();
 *
 * // Get themes by source
 * const customThemes = getThemesBySource('custom');
 * ```
 */

/**
 * Theme source - where the theme comes from
 */
export type ThemeSource = 'shadcn' | 'custom';

/**
 * Theme category for grouping in UI
 */
export type ThemeCategory = 'neutral' | 'vibrant' | 'brand';

/**
 * Complete theme metadata
 */
export interface ThemeDefinition {
  /** Unique theme identifier (matches CSS class: theme-{name}) */
  name: string;
  /** Display name for UI */
  label: string;
  /** Theme description */
  description: string;
  /** Primary color HSL value (for preview swatches) */
  primaryHsl: string;
  /** Theme source */
  source: ThemeSource;
  /** Theme category */
  category: ThemeCategory;
  /** Default border radius */
  radius: string;
  /** Whether this is the default theme */
  isDefault?: boolean;
}

/**
 * shadcn/ui official themes
 */
const shadcnThemes: ThemeDefinition[] = [
  {
    name: 'zinc',
    label: 'Zinc',
    description: 'Neutral gray with subtle warmth',
    primaryHsl: '240 5.9% 10%',
    source: 'shadcn',
    category: 'neutral',
    radius: '0.5rem',
    isDefault: true,
  },
  {
    name: 'slate',
    label: 'Slate',
    description: 'Cool blue-gray, professional',
    primaryHsl: '222.2 47.4% 11.2%',
    source: 'shadcn',
    category: 'neutral',
    radius: '0.5rem',
  },
  {
    name: 'stone',
    label: 'Stone',
    description: 'Warm earthy tones',
    primaryHsl: '24 9.8% 10%',
    source: 'shadcn',
    category: 'neutral',
    radius: '0.95rem',
  },
  {
    name: 'gray',
    label: 'Gray',
    description: 'Balanced blue-gray',
    primaryHsl: '220.9 39.3% 11%',
    source: 'shadcn',
    category: 'neutral',
    radius: '0.35rem',
  },
  {
    name: 'neutral',
    label: 'Neutral',
    description: 'Pure black and white',
    primaryHsl: '0 0% 9%',
    source: 'shadcn',
    category: 'neutral',
    radius: '0.5rem',
  },
  {
    name: 'red',
    label: 'Red',
    description: 'Bold and vibrant',
    primaryHsl: '0 72.2% 50.6%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.4rem',
  },
  {
    name: 'rose',
    label: 'Rose',
    description: 'Soft pink/magenta',
    primaryHsl: '346.8 77.2% 49.8%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.5rem',
  },
  {
    name: 'orange',
    label: 'Orange',
    description: 'Warm and energetic',
    primaryHsl: '24.6 95% 53.1%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.95rem',
  },
  {
    name: 'green',
    label: 'Green',
    description: 'Fresh and natural',
    primaryHsl: '142.1 76.2% 36.3%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.5rem',
  },
  {
    name: 'blue',
    label: 'Blue',
    description: 'Bright and trustworthy',
    primaryHsl: '221.2 83.2% 53.3%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.5rem',
  },
  {
    name: 'yellow',
    label: 'Yellow',
    description: 'Sunny and optimistic',
    primaryHsl: '47.9 95.8% 53.1%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.95rem',
  },
  {
    name: 'violet',
    label: 'Violet',
    description: 'Creative and imaginative',
    primaryHsl: '262.1 83.3% 57.8%',
    source: 'shadcn',
    category: 'vibrant',
    radius: '0.5rem',
  },
];

/**
 * Custom organization themes
 */
const customThemes: ThemeDefinition[] = [
  {
    name: 'ambar',
    label: 'Ambar',
    description: 'Warm amber/gold brand theme',
    primaryHsl: '38 92% 50%',
    source: 'custom',
    category: 'brand',
    radius: '0.5rem',
  },
];

/**
 * Complete theme registry
 */
export const themeRegistry: ThemeDefinition[] = [...customThemes, ...shadcnThemes];

/**
 * Theme names as a const tuple for type safety
 */
export const themeNames = themeRegistry.map((t) => t.name) as readonly string[];

/**
 * Theme name type (union of all theme names)
 */
export type ThemeName = (typeof themeRegistry)[number]['name'];

/**
 * Default theme name
 */
export const defaultThemeName: ThemeName =
  themeRegistry.find((t) => t.isDefault)?.name ?? 'ambar';

/**
 * Get a theme definition by name
 */
export function getTheme(name: string): ThemeDefinition | undefined {
  return themeRegistry.find((t) => t.name === name);
}

/**
 * Get all theme definitions
 */
export function getAllThemes(): ThemeDefinition[] {
  return [...themeRegistry];
}

/**
 * Get themes filtered by source
 */
export function getThemesBySource(source: ThemeSource): ThemeDefinition[] {
  return themeRegistry.filter((t) => t.source === source);
}

/**
 * Get themes filtered by category
 */
export function getThemesByCategory(category: ThemeCategory): ThemeDefinition[] {
  return themeRegistry.filter((t) => t.category === category);
}

/**
 * Check if a name is a valid theme
 */
export function isValidTheme(name: string): name is ThemeName {
  return themeRegistry.some((t) => t.name === name);
}

/**
 * Get CSS class name for a theme
 */
export function getThemeClassName(name: string): string {
  return `theme-${name}`;
}

/**
 * Get theme names grouped by source
 */
export function getThemesGroupedBySource(): Record<ThemeSource, ThemeDefinition[]> {
  return {
    custom: getThemesBySource('custom'),
    shadcn: getThemesBySource('shadcn'),
  };
}

/**
 * Get theme names grouped by category
 */
export function getThemesGroupedByCategory(): Record<ThemeCategory, ThemeDefinition[]> {
  return {
    brand: getThemesByCategory('brand'),
    neutral: getThemesByCategory('neutral'),
    vibrant: getThemesByCategory('vibrant'),
  };
}
