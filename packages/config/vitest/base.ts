import { defineConfig, type ViteUserConfig } from 'vitest/config';

type VitestPresetOptions = {
  /** 'jsdom' for anything rendering React, 'node' for CLIs and servers. */
  environment: 'jsdom' | 'node';
  /** Extra coverage exclusions on top of the defaults below. */
  coverageExclude?: string[];
};

/**
 * Shared Vitest preset for packages in this monorepo.
 *
 * Lives here so thresholds and coverage exclusions are defined once. A package
 * that needs to diverge should pass options rather than hand-rolling a config —
 * divergent per-package configs are how a suite silently stops enforcing itself.
 *
 * Scope, deliberately: this serves library packages. The Next.js apps are not
 * candidates and should keep their own config. `apps/hub` alone needs the React
 * plugin, alias pinning, React deduplication and a list of workspace deps forced
 * inline to avoid dual-React errors — folding that into a shared preset would
 * either break the libraries or turn the preset into a union of every app's
 * quirks, which is the problem it exists to solve.
 */
export function createVitestConfig(options: VitestPresetOptions): ViteUserConfig {
  return defineConfig({
    test: {
      globals: true,
      environment: options.environment,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: [
          'src/**/*.test.ts',
          'src/**/*.test.tsx',
          'src/**/index.ts',
          'src/**/*.types.ts',
          'src/__tests__/**',
          ...(options.coverageExclude ?? []),
        ],
        // A coverage report that can never fail is a report nobody reads.
        thresholds: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },
  });
}
