'use client';

import { use, type JSX } from 'react';

import { ProductSettingsSection } from '@/modules/shared/modules/components/product-settings-section';

interface PageProps {
  params: Promise<{ sectionKey: string }>;
}

// Unwrapping the route params is all this file does — Next.js allows nothing
// but the default export here, and the panel needs to be importable on its own.
export default function ProductSettingsSectionPage({ params }: PageProps): JSX.Element {
  const { sectionKey } = use(params);
  return <ProductSettingsSection sectionKey={sectionKey} />;
}
