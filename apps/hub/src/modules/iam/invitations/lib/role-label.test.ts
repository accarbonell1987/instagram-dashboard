import { describe, it, expect } from 'vitest';

import { roleLabel } from './role-label';

describe('roleLabel', () => {
  it('maps SuperAdmin to Superadministrador', () => {
    expect(roleLabel('SuperAdmin')).toBe('Superadministrador');
  });

  it('maps TenantAdmin to Administrador', () => {
    expect(roleLabel('TenantAdmin')).toBe('Administrador');
  });

  it('maps User to Usuario', () => {
    expect(roleLabel('User')).toBe('Usuario');
  });
});
