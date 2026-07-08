import type { OtpCode, OtpChannel, OtpPurpose } from '../../domain/index.js';

export interface CreateOtpCodeInput {
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
}

export interface OtpCodeRepository {
  create(data: CreateOtpCodeInput): Promise<OtpCode>;
  findActiveById(id: string, purpose: OtpPurpose): Promise<OtpCode | null>;
  findActiveByIdOnly(id: string): Promise<OtpCode | null>;
  incrementAttempts(id: string): Promise<OtpCode>;
  markUsed(id: string): Promise<void>;
  lockUntil(id: string, lockedUntil: Date): Promise<void>;
  deleteExpired(): Promise<number>;
}
