import { z } from '@hono/zod-openapi';

// ──────────────────────────────────────────────
// Shared sub-schemas
// ──────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  picture: z.string().nullable().optional(),
  role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
  status: z.enum(['pending_first_login', 'active', 'suspended']),
});

export const TenantInSessionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  planId: z.string(),
  status: z.enum(['active', 'suspended', 'pending']),
});

export const SessionSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
  role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
  user: UserSchema,
  tenant: TenantInSessionSchema,
});

export const OtpIdSchema = z.object({
  otpId: z.string(),
  channel: z.enum(['email', 'sms']),
  maskedDestination: z.string(),
  expiresAt: z.string(),
  resendAvailableAt: z.string(),
});

export const OtpVerificationTokenSchema = z.object({
  otpVerificationToken: z.string(),
  expiresAt: z.string(),
});

// ──────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceId: z.string().uuid().optional(),
});

export const LoginResponseSchema = z.union([
  z.object({
    otpRequired: z.literal(true),
    otpId: z.string(),
    channel: z.string(),
    maskedDestination: z.string(),
    expiresAt: z.string(),
    resendAvailableAt: z.string(),
  }),
  z.object({
    otpRequired: z.literal(false),
    session: SessionSchema,
  }),
]);

export const LoginCompleteRequestSchema = z.object({
  otpId: z.string(),
  code: z.string(),
  trustDevice: z.boolean().optional().default(false),
  deviceId: z.string().uuid().optional(),
});

// ──────────────────────────────────────────────
// OTP
// ──────────────────────────────────────────────

export const OtpSendRequestSchema = z.object({
  identifier: z.string(),
  channel: z.enum(['email', 'sms']),
  purpose: z.enum(['login', 'first-login', 'signup-rep', 'recover', 'invitation']),
});

export const OtpSendResponseSchema = OtpIdSchema;

export const OtpVerifyRequestSchema = z.object({
  otpId: z.string(),
  code: z.string(),
});

export const OtpVerifyResponseSchema = OtpVerificationTokenSchema;

export const OtpResendRequestSchema = z.object({
  otpId: z.string(),
});

export const OtpResendResponseSchema = OtpIdSchema;

// ──────────────────────────────────────────────
// Refresh / logout
// ──────────────────────────────────────────────

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

// ──────────────────────────────────────────────
// Password
// ──────────────────────────────────────────────

export const PasswordPolicySchema = z.object({
  minLength: z.number(),
  requireUpper: z.boolean(),
  requireLower: z.boolean(),
  requireDigit: z.boolean(),
  requireSymbol: z.boolean(),
  disallowCommon: z.boolean(),
});

export const PasswordRecoverRequestSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().optional(), // @deprecated — no longer used; recovery is global (findByEmailGlobal)
});

export const PasswordRecoverCompleteRequestSchema = z.object({
  otpVerificationToken: z.string(),
  password: z.string(),
});

// ──────────────────────────────────────────────
// First login
// ──────────────────────────────────────────────

export const FirstLoginStartRequestSchema = z.object({
  email: z.string().email(),
});

export const FirstLoginSetPasswordRequestSchema = z.object({
  otpVerificationToken: z.string(),
  password: z.string(),
});

// ──────────────────────────────────────────────
// First login responses
// ──────────────────────────────────────────────

export const ActivationTokenValidateQuerySchema = z.object({
  token: z.string().min(1),
});

export const ActivationTokenValidateResponseSchema = z.object({
  email: z.string(),
  fullName: z.string(),
  tenantName: z.string(),
});
