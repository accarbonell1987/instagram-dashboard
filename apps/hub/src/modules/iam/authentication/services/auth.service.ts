import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { SchemaPasswordPolicy, SchemaSession, SchemaOtpId } from '@/lib/api/types';
import { setSessionState } from '@/modules/iam/identity/session/store';
import type { Session, SessionUser, SessionTenant } from '@/modules/iam/identity/session/store';
import { setAccessToken, fromJwt } from '@/modules/iam/identity/session/token';
import { getOrCreateDeviceId } from '../lib/device';

// ─── Local input/output types ────────────────────────────────────────────────

export type PasswordPolicy = SchemaPasswordPolicy;

export interface SendOtpInput {
  channel: 'email' | 'sms';
  purpose: 'login' | 'first-login' | 'signup-rep' | 'recover' | 'invitation';
  identifier: string;
}

export interface SendOtpResult {
  otpId: string;
  expiresInSeconds: number;
}

export interface VerifyOtpInput {
  otpId: string;
  code: string;
}

export interface VerifyOtpResult {
  verificationToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginResult =
  | {
      otpRequired: true;
      otpId: string;
      otpChannel: 'email' | 'sms';
    }
  | {
      otpRequired: false;
    };

export interface CompleteLoginInput {
  otpId: string;
  code: string;
  trustDevice?: boolean | undefined;
}

export interface FirstLoginStartInput {
  email: string;
}

export interface FirstLoginStartResult {
  otpId: string;
}

export interface FirstLoginSetPasswordInput {
  otpVerificationToken: string;
  password: string;
}

export interface RecoverCompleteInput {
  otpVerificationToken: string;
  password: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function applySession(apiSession: SchemaSession): Session {
  const token = fromJwt(apiSession.accessToken);
  setAccessToken(token);

  const user: SessionUser = {
    id: apiSession.user.id,
    email: apiSession.user.email,
    fullName: apiSession.user.fullName,
    picture: apiSession.user.picture ?? undefined,
  };

  const tenant: SessionTenant = {
    id: apiSession.tenant.id,
    slug: apiSession.tenant.slug,
    name: apiSession.tenant.name ?? undefined,
  };

  const session: Session = {
    user,
    tenant,
    role: apiSession.role,
    accessToken: apiSession.accessToken,
    expiresAt: token.expiresAt,
  };

  setSessionState({ status: 'authenticated', session });
  return session;
}

// ─── Auth service functions ──────────────────────────────────────────────────

export async function sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
  const response = await apiFetchWithInterceptors<SchemaOtpId>('/auth/otp/send', {
    method: 'POST',
    body: {
      channel: input.channel,
      purpose: input.purpose,
      identifier: input.identifier,
    },
  });

  const expiresAt = new Date(response.expiresAt).getTime();
  const expiresInSeconds = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));

  return { otpId: response.otpId, expiresInSeconds };
}

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const response = await apiFetchWithInterceptors<{
    otpVerificationToken: string;
    expiresAt: string;
  }>('/auth/otp/verify', {
    method: 'POST',
    body: { otpId: input.otpId, code: input.code },
  });

  return { verificationToken: response.otpVerificationToken };
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const deviceId = getOrCreateDeviceId();

  const body: Record<string, unknown> = {
    email: input.email,
    password: input.password,
  };
  if (deviceId) {
    body['deviceId'] = deviceId;
  }

  const response = await apiFetchWithInterceptors<{
    otpRequired: boolean;
    otpId?: string | null;
    channel?: 'email' | 'sms' | null;
    session?: SchemaSession | null;
  }>('/auth/login', {
    method: 'POST',
    body,
  });

  if (!response.otpRequired && response.session !== null && response.session !== undefined) {
    applySession(response.session);
    return { otpRequired: false };
  }

  return {
    otpRequired: true,
    otpId: response.otpId ?? '',
    otpChannel: response.channel ?? 'email',
  };
}

export async function completeLogin(input: CompleteLoginInput): Promise<Session> {
  const deviceId = getOrCreateDeviceId();

  const body: Record<string, unknown> = {
    otpId: input.otpId,
    code: input.code,
    trustDevice: input.trustDevice ?? false,
  };
  if (deviceId) {
    body['deviceId'] = deviceId;
  }

  const response = await apiFetchWithInterceptors<SchemaSession>('/auth/login/complete', {
    method: 'POST',
    body,
  });

  return applySession(response);
}

export async function firstLoginStart(input: FirstLoginStartInput): Promise<FirstLoginStartResult> {
  const response = await apiFetchWithInterceptors<SchemaOtpId>('/auth/first-login/start', {
    method: 'POST',
    body: { email: input.email },
  });

  return { otpId: response.otpId };
}

export async function firstLoginSetPassword(input: FirstLoginSetPasswordInput): Promise<Session> {
  const response = await apiFetchWithInterceptors<SchemaSession>('/auth/first-login/set-password', {
    method: 'POST',
    body: {
      otpVerificationToken: input.otpVerificationToken,
      password: input.password,
    },
  });

  return applySession(response);
}

export async function recoverComplete(input: RecoverCompleteInput): Promise<void> {
  await apiFetchWithInterceptors<{ ok: boolean }>(
    '/auth/password/recover/complete',
    {
      method: 'POST',
      body: {
        otpVerificationToken: input.otpVerificationToken,
        password: input.password,
      },
    }
  );
  // No session is issued — user must log in with their new password.
  // The caller is responsible for redirecting to /login?recovered=true.
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  return apiFetchWithInterceptors<PasswordPolicy>('/auth/password/policy', {
    method: 'GET',
  });
}

export async function validateFirstLoginToken(token: string): Promise<{
  email: string;
  fullName: string;
  tenantName: string;
}> {
  return apiFetchWithInterceptors<{
    email: string;
    fullName: string;
    tenantName: string;
  }>(`/auth/first-login/validate?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
}
