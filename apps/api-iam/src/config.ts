import { z } from 'zod'

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((s) => s.split(',').map((o) => o.trim())),

  DATABASE_URL: z.string().url(),

  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ACTIVE_KID: z.string().min(1),
  JWT_PREVIOUS_PUBLIC_KEY_PATH: z.string().optional(),
  JWT_PREVIOUS_KID: z.string().optional(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  JWT_ISSUER: z.string().default('https://iam.corehub.com'),
  JWT_AUDIENCE: z.string().default('corehub-hub'),
  JWT_OTP_VERIFICATION_AUDIENCE: z.string().default('otp-verification'),
  JWT_OTP_VERIFICATION_TTL_SECONDS: z.coerce.number().default(300),

  OTP_EMAIL_PROVIDER: z.enum(['stub', 'smtp', 'resend']).default('stub'),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_LOCKOUT_SECONDS: z.coerce.number().default(900),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(30),
  OTP_STUB_CODE: z.string().regex(/^\d{6}$/).optional(),

  EMAIL_PROVIDER: z.enum(['stub', 'smtp', 'resend']).default('stub'),
  EMAIL_FROM: z.string().email().default('no-reply@corehub.com'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),

  HUB_BASE_URL: z.string().url().default('http://localhost:3001'),

  BANCARD_PROVIDER: z.enum(['stub', 'real']).default('stub'),
  BANCARD_API_KEY: z.string().optional(),
  BANCARD_API_URL: z.string().url().default('https://vpos.infonet.com.py'),
  BANCARD_WEBHOOK_SECRET: z.string().min(16),
  BANCARD_RETURN_URL: z.string().url().default('http://localhost:3001/onboarding/payment/return'),
  BANCARD_SHOP_PROCESS_PREFIX: z.string().default('corehub'),

  PDF_PROVIDER: z.enum(['stub', 'react-pdf']).default('stub'),

  STORAGE_PROVIDER: z.enum(['stub', 's3']).default('stub'),
  STORAGE_STUB_DIR: z.string().default('/tmp/iam-storage'),
  AWS_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86400),
  DEVICE_TRUST_TTL_SECONDS: z.coerce.number().default(5184000),
  DRAFT_TTL_SECONDS: z.coerce.number().default(604800),
  RESUME_TOKEN_TTL_SECONDS: z.coerce.number().default(604800),

  RESERVED_TENANT_SLUGS: z
    .string()
    .default('www,api,app,admin,hub,mail,static,cdn,signup,login,superadmin,__system__')
    .transform((s) => s.split(',').map((x) => x.trim().toLowerCase())),

  SUPERADMIN_EMAIL: z.string().email().default('admin@corehub.com'),
  SUPERADMIN_PASSWORD: z.string().default('Change-me-in-production!'),

  PLAN_CHANGE_NOTIFY_TO: z.string().email().default('plan-changes@corehub.com'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  LOG_TO_CONSOLE: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? true : value === 'true'))
    .pipe(z.boolean()),

  LOG_FILE_PATH: z
    .string()
    .min(1)
    .default('./logs/api-iam.log'),

  LOG_FORMAT: z
    .enum(['json', 'pretty'])
    .default('json'),
}).superRefine((cfg, ctx) => {
  if (cfg.OTP_EMAIL_PROVIDER === 'resend' && !cfg.RESEND_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['RESEND_API_KEY'],
      message: 'required when OTP_EMAIL_PROVIDER=resend',
    })
  }
  if (cfg.STORAGE_PROVIDER === 's3' && (!cfg.AWS_BUCKET || !cfg.AWS_REGION)) {
    ctx.addIssue({
      code: 'custom',
      path: ['AWS_BUCKET'],
      message: 'required when STORAGE_PROVIDER=s3',
    })
  }
  if (cfg.JWT_PREVIOUS_PUBLIC_KEY_PATH && !cfg.JWT_PREVIOUS_KID) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_PREVIOUS_KID'],
      message: 'required when JWT_PREVIOUS_PUBLIC_KEY_PATH is set',
    })
  }
})

export type Config = z.infer<typeof configSchema>

export function parseConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    console.error('Invalid environment configuration:', result.error.flatten())
    throw new Error('Configuration validation failed — see logs above')
  }
  return Object.freeze(result.data)
}

let cachedConfig: Config | undefined

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = parseConfig()
  }
  return cachedConfig
}
