import { z } from 'zod';
import { config as loadEnv } from 'dotenv';

// Load .env file before parsing — tsx does NOT auto-load it
loadEnv();

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string(),
  IAM_JWKS_URL: z.string().url(),
  IAM_JWT_ISSUER: z.string().default('https://iam.corehub.com'),
  IG_APP_ID: z.string(),
  IG_APP_SECRET: z.string(),
  IG_REDIRECT_URI: z.string().url(),
  IG_API_BASE_URL: z.string().url().default('https://graph.instagram.com/v25.0'),
  CORS_ORIGIN: z.string().default('*'),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i, 'Must be 64 hex characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.string().url().optional().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().optional().default('deepseek-v4-flash'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3003'),
  ENABLE_USAGE_TRACKING: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .pipe(z.boolean())
    .default('true'),
  IAM_INTERNAL_URL: z.string().url().default('http://localhost:8080'),
});

export const config = ConfigSchema.parse(process.env);
export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
