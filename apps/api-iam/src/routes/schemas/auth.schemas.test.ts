import { describe, it, expect } from 'vitest';
import { UserSchema, TenantInSessionSchema } from './auth.schemas.js';

// ─── T-006: UserSchema ─────────────────────────────────────────
describe('UserSchema', () => {
  it('should parse a complete user with fullName and picture', () => {
    const valid = {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      email: 'ana@empresa-acme.com',
      fullName: 'Ana Pereira',
      picture: 'https://example.com/photo.jpg',
      role: 'TenantAdmin' as const,
      status: 'active' as const,
    };
    const result = UserSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Ana Pereira');
      expect(result.data.picture).toBe('https://example.com/photo.jpg');
      expect(result.data.email).toBe('ana@empresa-acme.com');
      expect(result.data.id).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
      expect(result.data.role).toBe('TenantAdmin');
    }
  });

  it('should reject a user missing fullName', () => {
    const invalid = {
      id: 'test-id',
      email: 'test@test.com',
      role: 'User' as const,
      status: 'active' as const,
    };
    const result = UserSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept a user with picture undefined (optional field)', () => {
    const valid = {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      email: 'ana@empresa-acme.com',
      fullName: 'Ana Pereira',
      role: 'SuperAdmin' as const,
      status: 'active' as const,
    };
    const result = UserSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Ana Pereira');
      expect(result.data.picture).toBeUndefined();
    }
  });

  it('should accept a user with picture null (simulating JSON parse)', () => {
    const valid = {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      email: 'ana@empresa-acme.com',
      fullName: 'Ana Pereira',
      picture: null,
      role: 'SuperAdmin' as const,
      status: 'active' as const,
    };
    const result = UserSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Ana Pereira');
      expect(result.data.picture).toBeNull();
    }
  });

  // ── T-006 Task 1.5: status field ───────────────────────────────
  it('should accept valid status values: pending_first_login, active, suspended', () => {
    const statuses = ['pending_first_login', 'active', 'suspended'] as const;
    for (const status of statuses) {
      const valid = {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'ana@empresa-acme.com',
        fullName: 'Ana Pereira',
        role: 'User' as const,
        status,
      };
      const result = UserSchema.safeParse(valid);
      expect(result.success).toBe(true);
    }
  });

  it('should reject an invalid status value', () => {
    const invalid = {
      id: 'test-id',
      email: 'test@test.com',
      fullName: 'Test',
      role: 'User' as const,
      status: 'banned',
    };
    const result = UserSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ─── T-006: TenantInSessionSchema ──────────────────────────────
describe('TenantInSessionSchema', () => {
  it('should parse a complete tenant with planId and status', () => {
    const valid = {
      id: 'a5b8d4d2-9e1c-4d23-9f1f-62eea2c45f81',
      slug: 'empresa-acme',
      name: 'Empresa Acme S.A.',
      planId: 'professional',
      status: 'active' as const,
    };
    const result = TenantInSessionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planId).toBe('professional');
      expect(result.data.status).toBe('active');
      expect(result.data.slug).toBe('empresa-acme');
      expect(result.data.name).toBe('Empresa Acme S.A.');
    }
  });

  it('should reject an invalid status value', () => {
    const invalid = {
      id: 'test-id',
      slug: 'test-slug',
      name: 'Test',
      planId: 'starter',
      status: 'inactive',
    };
    const result = TenantInSessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject a tenant missing planId', () => {
    const invalid = {
      id: 'test-id',
      slug: 'test-slug',
      name: 'Test',
      status: 'active',
    };
    const result = TenantInSessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept all valid status values (pending, active, suspended)', () => {
    const statuses = ['pending', 'active', 'suspended'] as const;
    for (const status of statuses) {
      const valid = {
        id: 'test-id',
        slug: 'test-slug',
        name: 'Test',
        planId: 'starter',
        status,
      };
      const result = TenantInSessionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    }
  });
});
