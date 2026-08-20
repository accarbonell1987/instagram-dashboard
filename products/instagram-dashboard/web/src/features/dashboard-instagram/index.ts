'use client'

export { DashboardInstagramPage } from './page'
export {
  useInstagramDashboard,
  useConnectionStatus,
  useSyncStatus,
} from './hooks/use-instagram-dashboard'
export { getDashboardData, getPostDetail } from './services/instagram.service'
export { LinkedAccountsAdminPage } from '@/features/account/linked-accounts-admin-page'
export { initHubToken, getHubToken, clearHubToken, reportHeightToHub } from '@/features/shared/lib/hub-token'
export * from './components'
export type * from './types/instagram.types'
