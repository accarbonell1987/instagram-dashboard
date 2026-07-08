/**
 * Creative Theme Configuration
 *
 * Extends the base design system with creative-specific tokens.
 * Use this for programmatic access to theme values.
 *
 * Color Palette:
 * - Primary: Vibrant Purple (271° 91% 65%) - Creative energy & innovation
 * - Secondary: Electric Cyan (189° 94% 43%) - Tech-forward & fresh
 * - Accent: Hot Pink (330° 81% 60%) - Bold expression & excitement
 *
 * This theme provides a vibrant, energetic, and creative feel
 * perfect for design agencies, creative portfolios, and innovative brands.
 */

import { createThemeTokens } from '@core/config/styles';

export const themeConfig = createThemeTokens({
  name: 'Creative',
  description: 'Vibrant creative theme with purple, cyan, and pink electric palette',

  colors: {
    primary: {
      light: 'hsl(271, 91%, 65%)',
      dark: 'hsl(271, 91%, 75%)',
      description: 'Vibrant purple for creative energy',
    },
    secondary: {
      light: 'hsl(189, 94%, 43%)',
      dark: 'hsl(189, 94%, 55%)',
      description: 'Electric cyan for innovation',
    },
    accent: {
      light: 'hsl(330, 81%, 60%)',
      dark: 'hsl(330, 81%, 70%)',
      description: 'Hot pink for bold expression',
    },
  },

  fonts: {
    sans: 'Inter',
    serif: 'Sora',
    mono: 'JetBrains Mono',
  },

  radius: '0.75rem', // More rounded for playful feel
});

export type ThemeConfig = typeof themeConfig;
