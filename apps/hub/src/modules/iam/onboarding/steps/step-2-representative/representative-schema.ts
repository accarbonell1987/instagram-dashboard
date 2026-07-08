import { z } from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const representativeSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().regex(/^\+\d{1,4}\d{6,14}$/, 'Teléfono inválido'),
});

export type RepresentativeFields = z.infer<typeof representativeSchema>;
