#!/usr/bin/env node
/**
 * Design Token Build Script
 *
 * Builds all token configurations using Style Dictionary.
 * Generates CSS variables compatible with shadcn/ui (HSL format).
 */
import StyleDictionary from 'style-dictionary';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Custom format for CSS variables
 * Outputs shadcn/ui compatible format with HSL values
 */
StyleDictionary.registerFormat({
  name: 'css/variables-custom',
  format: ({ dictionary, options }) => {
    const { selector = ':root' } = options;

    const formatTokenName = (path) => {
      return path.join('-').toLowerCase();
    };

    const formatValue = (token) => {
      const value = token.$value ?? token.value;
      const type = token.$type ?? token.type;

      // Handle shadow type
      if (type === 'shadow') {
        const formatShadow = (shadow) => {
          if (!shadow || typeof shadow !== 'object') return shadow;
          const { offsetX, offsetY, blur, spread, color, inset } = shadow;
          const insetStr = inset ? 'inset ' : '';
          return `${insetStr}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
        };

        if (Array.isArray(value)) {
          return value.map(formatShadow).join(', ');
        }
        return formatShadow(value);
      }

      // Handle cubic-bezier type
      if (type === 'cubicBezier') {
        if (Array.isArray(value)) {
          return `cubic-bezier(${value.join(', ')})`;
        }
        return value;
      }

      // Handle font family type
      if (type === 'fontFamily') {
        if (Array.isArray(value)) {
          return value.map(font =>
            font.includes(' ') ? `"${font}"` : font
          ).join(', ');
        }
        return value;
      }

      return value;
    };

    const variables = dictionary.allTokens
      .map(token => {
        const name = formatTokenName(token.path);
        const value = formatValue(token);
        return `  --${name}: ${value};`;
      })
      .join('\n');

    return `${selector} {\n${variables}\n}`;
  },
});

/**
 * Custom format for semantic CSS variables (shadcn/ui style)
 * Maps camelCase to kebab-case for CSS variable names
 */
StyleDictionary.registerFormat({
  name: 'css/semantic-variables',
  format: ({ dictionary, options }) => {
    const { selector = ':root' } = options;

    // Map token names to CSS variable names (shadcn/ui convention)
    const nameMap = {
      'cardForeground': 'card-foreground',
      'popoverForeground': 'popover-foreground',
      'primaryForeground': 'primary-foreground',
      'secondaryForeground': 'secondary-foreground',
      'mutedForeground': 'muted-foreground',
      'accentForeground': 'accent-foreground',
      'destructiveForeground': 'destructive-foreground',
      'chart1': 'chart-1',
      'chart2': 'chart-2',
      'chart3': 'chart-3',
      'chart4': 'chart-4',
      'chart5': 'chart-5',
      'sidebarBackground': 'sidebar-background',
      'sidebarForeground': 'sidebar-foreground',
      'sidebarPrimary': 'sidebar-primary',
      'sidebarPrimaryForeground': 'sidebar-primary-foreground',
      'sidebarAccent': 'sidebar-accent',
      'sidebarAccentForeground': 'sidebar-accent-foreground',
      'sidebarBorder': 'sidebar-border',
      'sidebarRing': 'sidebar-ring',
    };

    const variables = dictionary.allTokens
      .filter(token => token.path[0] === 'semantic')
      .map(token => {
        const tokenName = token.path[1];
        const cssName = nameMap[tokenName] || tokenName.toLowerCase();
        const value = token.$value ?? token.value;
        return `  --${cssName}: ${value};`;
      })
      .join('\n');

    return `${selector} {\n${variables}\n}`;
  },
});

// Filter functions
const isSemanticToken = (token) =>
  token.filePath.includes('light.tokens.json') ||
  token.filePath.includes('dark.tokens.json');
const isPrimitiveToken = (token) => token.filePath.includes('primitives/');

console.log('Building design tokens...\n');

// Build primitives
console.log('Building primitives...');
const primitivesSd = new StyleDictionary({
  source: [join(__dirname, 'primitives/**/*.tokens.json')],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: join(__dirname, '../styles/generated/'),
      files: [
        {
          destination: 'primitives.css',
          format: 'css/variables-custom',
          options: { selector: ':root' },
        },
      ],
    },
  },
});
await primitivesSd.buildAllPlatforms();
console.log('  ✔ primitives.css\n');

// Build light mode semantic tokens
console.log('Building light mode...');
const lightSd = new StyleDictionary({
  log: { warnings: 'disabled' },
  source: [join(__dirname, 'semantic/light.tokens.json')],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: join(__dirname, '../styles/generated/'),
      files: [
        {
          destination: 'semantic-light.css',
          format: 'css/semantic-variables',
          options: { selector: ':root' },
        },
      ],
    },
  },
});
await lightSd.buildAllPlatforms();
console.log('  ✔ semantic-light.css\n');

// Build dark mode semantic tokens
console.log('Building dark mode...');
const darkSd = new StyleDictionary({
  log: { warnings: 'disabled' },
  source: [join(__dirname, 'semantic/dark.tokens.json')],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: join(__dirname, '../styles/generated/'),
      files: [
        {
          destination: 'semantic-dark.css',
          format: 'css/semantic-variables',
          options: { selector: '.dark' },
        },
      ],
    },
  },
});
await darkSd.buildAllPlatforms();
console.log('  ✔ semantic-dark.css\n');

console.log('Design tokens built successfully!');
