import { describe, it, expect } from 'vitest';

import { credentialsSchema } from './login-schema';

describe('credentialsSchema', () => {
  describe('valid inputs', () => {
    it('accepts a valid email and non-empty password', () => {
      const result = credentialsSchema.safeParse({
        email: 'user@example.com',
        password: 'Pass1234!',
      });
      expect(result.success).toBe(true);
    });

    it('accepts email with subdomain', () => {
      const result = credentialsSchema.safeParse({
        email: 'user@mail.empresa.com.py',
        password: 'cualquier_contraseña',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a single-character password (min 1)', () => {
      const result = credentialsSchema.safeParse({
        email: 'a@b.com',
        password: 'x',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid email', () => {
    it('rejects a missing email', () => {
      const result = credentialsSchema.safeParse({ email: '', password: 'Pass1234!' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find((i) => i.path.includes('email'));
        expect(emailError).toBeDefined();
      }
    });

    it('rejects a non-email string', () => {
      const result = credentialsSchema.safeParse({
        email: 'not-an-email',
        password: 'Pass1234!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find((i) => i.path.includes('email'));
        expect(emailError?.message).toMatch(/correo electrónico válido/i);
      }
    });

    it('rejects email without domain', () => {
      const result = credentialsSchema.safeParse({ email: 'user@', password: 'Pass1234!' });
      expect(result.success).toBe(false);
    });

    it('rejects email without local part', () => {
      const result = credentialsSchema.safeParse({ email: '@example.com', password: 'Pass1234!' });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid password', () => {
    it('rejects an empty password', () => {
      const result = credentialsSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordError = result.error.issues.find((i) => i.path.includes('password'));
        expect(passwordError?.message).toMatch(/contraseña es requerida/i);
      }
    });
  });

  describe('missing fields', () => {
    it('rejects when both fields are missing', () => {
      const result = credentialsSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('rejects when email field is missing entirely', () => {
      const result = credentialsSchema.safeParse({ password: 'Pass1234!' });
      expect(result.success).toBe(false);
    });

    it('rejects when password field is missing entirely', () => {
      const result = credentialsSchema.safeParse({ email: 'user@example.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('round-trip parse', () => {
    it('parse() returns typed data for valid input', () => {
      const data = credentialsSchema.parse({
        email: 'rep@empresa.com',
        password: 'P@ssw0rd!',
      });
      expect(data.email).toBe('rep@empresa.com');
      expect(data.password).toBe('P@ssw0rd!');
    });

    it('parse() throws ZodError for invalid email', () => {
      expect(() => credentialsSchema.parse({ email: 'bad', password: 'pass' })).toThrow();
    });
  });
});
