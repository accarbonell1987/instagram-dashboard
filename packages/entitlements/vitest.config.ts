import { createVitestConfig } from '@core/config/vitest';

// index barrels are re-exports only; the preset already excludes src/**/index.ts,
// which covers both this package's root barrel and src/react/index.ts.
export default createVitestConfig({ environment: 'jsdom' });
