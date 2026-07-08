import { OtpPurpose as PrismaOtpPurpose, type PrismaClient } from '../../generated/prisma/client.js';
import type { OtpCode, OtpPurpose } from '../../domain/index.js';
import type { CreateOtpCodeInput, OtpCodeRepository } from './types.js';

// Domain uses hyphenated strings ('signup-rep', 'first-login').
// Prisma enum uses underscored names (signup_rep, first_login).
// These mappers bridge the two representations.
const PURPOSE_TO_PRISMA: Record<OtpPurpose, PrismaOtpPurpose> = {
  login: PrismaOtpPurpose.login,
  'first-login': PrismaOtpPurpose.first_login,
  'signup-rep': PrismaOtpPurpose.signup_rep,
  recover: PrismaOtpPurpose.recover,
  invitation: PrismaOtpPurpose.invitation,
};

const PRISMA_TO_PURPOSE: Record<string, OtpPurpose> = {
  login: 'login',
  first_login: 'first-login',
  signup_rep: 'signup-rep',
  recover: 'recover',
  invitation: 'invitation',
};

function toPrismaPurpose(purpose: OtpPurpose): PrismaOtpPurpose {
  return PURPOSE_TO_PRISMA[purpose];
}

function fromPrismaPurpose(raw: string): OtpPurpose {
  const mapped = PRISMA_TO_PURPOSE[raw];
  if (!mapped) throw new Error(`Unknown Prisma OtpPurpose: ${raw}`);
  return mapped;
}

function mapOtp(raw: {
  id: string;
  identifier: string;
  channel: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  used: boolean;
  lockedUntil: Date | null;
  expiresAt: Date;
  createdAt: Date;
}): OtpCode {
  return {
    id: raw.id,
    identifier: raw.identifier,
    channel: raw.channel as OtpCode['channel'],
    purpose: fromPrismaPurpose(raw.purpose),
    codeHash: raw.codeHash,
    attempts: raw.attempts,
    used: raw.used,
    lockedUntil: raw.lockedUntil ?? undefined,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
  };
}

export class PrismaOtpCodeRepository implements OtpCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateOtpCodeInput): Promise<OtpCode> {
    const raw = await this.prisma.otpCode.create({
      data: {
        identifier: data.identifier,
        channel: data.channel,
        purpose: toPrismaPurpose(data.purpose),
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
      },
    });
    return mapOtp(raw);
  }

  async findActiveById(id: string, purpose: OtpPurpose): Promise<OtpCode | null> {
    const raw = await this.prisma.otpCode.findFirst({
      where: {
        id,
        purpose: toPrismaPurpose(purpose),
        used: false,
        lockedUntil: null,
        expiresAt: { gt: new Date() },
      },
    });
    return raw ? mapOtp(raw) : null;
  }

  async findActiveByIdOnly(id: string): Promise<OtpCode | null> {
    const raw = await this.prisma.otpCode.findFirst({
      where: {
        id,
        used: false,
        lockedUntil: null,
        expiresAt: { gt: new Date() },
      },
    });
    return raw ? mapOtp(raw) : null;
  }

  async incrementAttempts(id: string): Promise<OtpCode> {
    const raw = await this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
    return mapOtp(raw);
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.otpCode.update({ where: { id }, data: { used: true } });
  }

  async lockUntil(id: string, lockedUntil: Date): Promise<void> {
    await this.prisma.otpCode.update({ where: { id }, data: { lockedUntil } });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
