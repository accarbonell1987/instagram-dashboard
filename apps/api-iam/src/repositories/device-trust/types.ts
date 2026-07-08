import type { DeviceTrust } from '../../domain/index.js'

export interface DeviceTrustRepository {
  upsert(data: { userId: string; deviceHash: string; expiresAt: Date }): Promise<DeviceTrust>
  findByUserAndHash(userId: string, deviceHash: string): Promise<DeviceTrust | null>
  deleteExpired(): Promise<number>
}
