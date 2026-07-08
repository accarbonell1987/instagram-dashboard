import { z } from 'zod';

/**
 * Zod schema for the module create form.
 * id and defaultUrl are required only when creating a new module.
 */
export const moduleFormSchema = z.object({
  id: z.string().min(1, 'El ID es obligatorio'),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  defaultUrl: z.string().min(1, 'La URL por defecto es obligatoria'),
});

export type ModuleFormData = z.infer<typeof moduleFormSchema>;

/**
 * Schema for editing an existing module — only name and description are editable.
 */
export const moduleEditSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
});

export type ModuleEditFormData = z.infer<typeof moduleEditSchema>;
