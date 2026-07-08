import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Pin all React resolutions to hub's own copies to prevent dual-instance errors
      // from workspace packages (@core/ui, input-otp, @radix-ui/*) that may have
      // resolved against an older React version installed elsewhere in the monorepo.
      react: path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
    },
    // Deduplicate React to prevent dual-instance errors from workspace packages
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        // Force inline transformation of workspace packages and their deps so they
        // all share the same React instance resolved by Vitest's jsdom environment.
        inline: [
          '@core/ui',
          'input-otp',
          '@radix-ui/react-checkbox',
          '@radix-ui/react-primitive',
          '@radix-ui/react-label',
          '@radix-ui/react-slot',
          /^@radix-ui\/.*/,
        ],
      },
    },
  },
});
