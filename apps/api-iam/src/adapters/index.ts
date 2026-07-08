import type { Config } from '../config.js'
import type { Logger } from '../lib/logger.js'
import { PemKeyProvider } from './key-provider/index.js'
import { StubOtpAdapter, SmtpOtpAdapter, ResendOtpAdapter } from './otp/index.js'
import { StubEmailAdapter, SmtpEmailAdapter, ResendEmailAdapter } from './email/index.js'
import { StubBancardAdapter, RealBancardAdapter } from './bancard/index.js'
import { StubPdfAdapter, ReactPdfAdapter } from './pdf/index.js'
import { StubStorageAdapter } from './storage/index.js'
import { createInMemoryRateLimiter } from './rate-limiter/index.js'

export type { KeyProvider } from './key-provider/index.js'
export type { OtpAdapter, OtpSendParams } from './otp/index.js'
export type { EmailAdapter, EmailSendParams } from './email/index.js'
export type { BancardAdapter, BancardInitiateParams, BancardInitiateResult } from './bancard/index.js'
export type { PdfAdapter, PdfGenerateParams, PdfDocumentType } from './pdf/index.js'
export type { StorageAdapter, StorageUploadParams, StorageSignedUrlParams } from './storage/index.js'
export type { RateLimiter } from './rate-limiter/index.js'

export function createAdapters(config: Config, logger: Logger) {
  return {
    keyProvider: new PemKeyProvider(config),
    otpAdapter:
      config.OTP_EMAIL_PROVIDER === 'resend'
        ? new ResendOtpAdapter(config.RESEND_API_KEY!)
        : config.OTP_EMAIL_PROVIDER === 'smtp'
          ? new SmtpOtpAdapter(config.SMTP_HOST, config.SMTP_PORT, config.EMAIL_FROM)
          : new StubOtpAdapter(logger),
    emailAdapter:
      config.EMAIL_PROVIDER === 'resend'
        ? new ResendEmailAdapter(config.RESEND_API_KEY!)
        : config.EMAIL_PROVIDER === 'smtp'
          ? new SmtpEmailAdapter(config.SMTP_HOST, config.SMTP_PORT, config.EMAIL_FROM)
          : new StubEmailAdapter(logger),
    bancardAdapter:
      config.BANCARD_PROVIDER === 'real' ? new RealBancardAdapter() : new StubBancardAdapter(),
    pdfAdapter:
      config.PDF_PROVIDER === 'react-pdf' ? new ReactPdfAdapter() : new StubPdfAdapter(),
    storageAdapter: new StubStorageAdapter(config.STORAGE_STUB_DIR, `http://localhost:${config.PORT}`),
    rateLimiter: createInMemoryRateLimiter(),
  }
}

export type Adapters = ReturnType<typeof createAdapters>
