'use client'

export { DashboardInstagramPage } from './page'
export {
  useInstagramDashboard,
  useConnectionStatus,
  useSyncStatus,
} from './hooks/use-instagram-dashboard'
export { getDashboardData, getPostDetail } from './services/instagram.service'
export * from './components'
export type * from './types/instagram.types'
