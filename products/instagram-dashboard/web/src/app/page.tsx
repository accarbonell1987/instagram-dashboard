'use client';

import { useEffect } from 'react';

import { DashboardInstagramPage } from '@/features/dashboard/dashboard-page';
import { initHubToken } from '@/features/shared/lib/hub-token';

export default function HomePage() {
  // Start the postMessage handshake with the hub once, client-side.
  useEffect(() => initHubToken(), []);

  return <DashboardInstagramPage />;
}
