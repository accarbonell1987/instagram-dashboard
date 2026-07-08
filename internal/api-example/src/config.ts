import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3005),
  DATA_SOURCE: z.enum(['memory', 'file', 'prisma']).default('memory'),
  DATA_DIR: z.string().default('./data'),
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config = ConfigSchema.parse(process.env);
