import { z } from 'zod';

import type { SchemaPasswordPolicy } from '@/lib/api/types';

export type PasswordPolicy = SchemaPasswordPolicy;

// Minimal embedded list of common passwords for MVP disallowCommon check.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', '123456', '12345678', 'qwerty', 'abc123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master', 'iloveyou',
  '1234', '12345', 'sunshine', 'princess', 'football', 'shadow',
  'superman', 'michael', 'baseball', 'harley', 'batman', 'trustno1',
]);

export function buildPasswordSchema(policy: PasswordPolicy): z.ZodString {
  let schema = z.string().min(policy.minLength, `Mínimo ${String(policy.minLength)} caracteres`);

  if (policy.requireUpper) {
    schema = schema.regex(/[A-Z]/, 'Debe contener al menos una mayúscula');
  }
  if (policy.requireLower) {
    schema = schema.regex(/[a-z]/, 'Debe contener al menos una minúscula');
  }
  if (policy.requireDigit) {
    schema = schema.regex(/[0-9]/, 'Debe contener al menos un dígito');
  }
  if (policy.requireSymbol) {
    schema = schema.regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo');
  }
  if (policy.disallowCommon) {
    schema = schema.refine(
      (s) => !COMMON_PASSWORDS.has(s.toLowerCase()),
      'Contraseña demasiado común'
    ) as unknown as z.ZodString;
  }

  return schema;
}

export interface PasswordChecklistItem {
  rule: string;
  label: string;
  passes: boolean;
}

export function evaluatePasswordChecklist(
  policy: PasswordPolicy,
  password: string
): PasswordChecklistItem[] {
  const items: PasswordChecklistItem[] = [];

  items.push({
    rule: 'minLength',
    label: `Mínimo ${String(policy.minLength)} caracteres`,
    passes: password.length >= policy.minLength,
  });

  if (policy.requireUpper) {
    items.push({
      rule: 'requireUpper',
      label: 'Al menos una mayúscula',
      passes: /[A-Z]/.test(password),
    });
  }

  if (policy.requireLower) {
    items.push({
      rule: 'requireLower',
      label: 'Al menos una minúscula',
      passes: /[a-z]/.test(password),
    });
  }

  if (policy.requireDigit) {
    items.push({
      rule: 'requireDigit',
      label: 'Al menos un dígito',
      passes: /[0-9]/.test(password),
    });
  }

  if (policy.requireSymbol) {
    items.push({
      rule: 'requireSymbol',
      label: 'Al menos un símbolo',
      passes: /[^A-Za-z0-9]/.test(password),
    });
  }

  if (policy.disallowCommon) {
    items.push({
      rule: 'disallowCommon',
      label: 'No es una contraseña común',
      passes: !COMMON_PASSWORDS.has(password.toLowerCase()),
    });
  }

  return items;
}
