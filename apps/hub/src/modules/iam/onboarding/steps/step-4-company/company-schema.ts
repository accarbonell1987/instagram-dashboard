import { z } from 'zod';

import { DEPARTAMENTOS, TIPOS_EMPRESA, RUC_REGEX } from './paraguay-data';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const companySchema = z.object({
  razonSocial: z.string().min(2, 'La razón social es requerida'),
  ruc: z.string().regex(RUC_REGEX, 'RUC inválido (formato: 12345678-1)'),
  tipoEmpresa: z.enum(TIPOS_EMPRESA, {
    errorMap: () => ({ message: 'Selecciona el tipo de empresa' }),
  }),
  direccionFiscal: z.string().min(5, 'La dirección fiscal es requerida'),
  ciudad: z.string().min(2, 'La ciudad es requerida'),
  departamento: z.enum(DEPARTAMENTOS, {
    errorMap: () => ({ message: 'Selecciona el departamento' }),
  }),
  telefono: z.string().min(7, 'Teléfono inválido'),
  personaContacto: z.string().min(2, 'El nombre de contacto es requerido'),
  cargoContacto: z.string().min(2, 'El cargo es requerido'),
  sitioWeb: z.string().url('URL inválida').optional().or(z.literal('')),
});

export type CompanyFields = z.infer<typeof companySchema>;
