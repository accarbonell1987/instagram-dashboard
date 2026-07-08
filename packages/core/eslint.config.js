import library from '@core/config/eslint/library';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...library,
  {
    // Disable unbound-method rule in test files - vi.mocked() handles this
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
];
