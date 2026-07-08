import { z } from 'zod';

/**
 * Zod schema for the login credentials form.
 * Validates email format and presence of password.
 * Extracted from login-form.tsx for reuse and testability.
 */
export const credentialsSchema = z.object({
  email: z.string().email('Ingresá un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type CredentialsFormData = z.infer<typeof credentialsSchema>;
