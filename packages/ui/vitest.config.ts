import react from '@vitejs/plugin-react';

import { createVitestConfig } from '@core/config/vitest';

/**
 * The design system renders React, so its tests need a DOM and the React
 * plugin for JSX. Everything else — includes, coverage thresholds — comes from
 * the shared preset, so this package cannot quietly drift below the bar.
 */
const config = createVitestConfig({ environment: 'jsdom' });

export default {
  ...config,
  plugins: [react()],
  test: {
    ...config.test,
    setupFiles: ['./vitest.setup.ts'],
  },
};
