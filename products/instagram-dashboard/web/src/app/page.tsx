'use client';

import { useEffect } from 'react';

import { DashboardInstagramPage, initHubToken } from '@/features/dashboard-instagram';

export default function HomePage() {
  // Start the postMessage handshake with the hub once, client-side.
  useEffect(() => initHubToken(), []);

  return <DashboardInstagramPage />;
}
