import type { OtpChannel, OtpPurpose } from '../../domain/index.js'

export interface OtpSendParams {
  identifier: string
  channel: OtpChannel
  code: string
  purpose: OtpPurpose
  ttlSeconds?: number
}

export interface OtpAdapter {
  send(params: OtpSendParams): Promise<void>
}
