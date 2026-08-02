import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Pin React to this app's own copies to avoid dual-instance errors from
      // workspace packages (@core/ui, @radix-ui/*) resolved elsewhere in the monorepo.
      react: path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
    },
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
        inline: ['@core/ui', /^@radix-ui\/.*/],
      },
    },
  },
});
