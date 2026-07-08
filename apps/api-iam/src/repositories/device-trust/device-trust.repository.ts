import type { PrismaClient } from '../../generated/prisma/client.js'
import type { DeviceTrust } from '../../domain/index.js'
import type { DeviceTrustRepository } from './types.js'

function mapDeviceTrust(raw: {
  id: string
  userId: string
  deviceHash: string
  expiresAt: Date
  createdAt: Date
}): DeviceTrust {
  return {
    id: raw.id,
    userId: raw.userId,
    deviceHash: raw.deviceHash,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
  }
}

export class PrismaDeviceTrustRepository implements DeviceTrustRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(data: { userId: string; deviceHash: string; expiresAt: Date }): Promise<DeviceTrust> {
    const raw = await this.prisma.deviceTrust.upsert({
      where: { userId_deviceHash: { userId: data.userId, deviceHash: data.deviceHash } },
      create: { userId: data.userId, deviceHash: data.deviceHash, expiresAt: data.expiresAt },
      update: { expiresAt: data.expiresAt },
    })
    return mapDeviceTrust(raw)
  }

  async findByUserAndHash(userId: string, deviceHash: string): Promise<DeviceTrust | null> {
    const raw = await this.prisma.deviceTrust.findUnique({
      where: { userId_deviceHash: { userId, deviceHash } },
    })
    return raw ? mapDeviceTrust(raw) : null
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.deviceTrust.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return result.count
  }
}
