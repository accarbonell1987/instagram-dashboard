/**
 * Product Declaration — Tests
 * @core/cli
 */

import { describe, expect, it } from 'vitest';

import {
  createDefaultProductDeclaration,
  validateProductDeclaration,
  type ProductDeclaration,
} from './product-declaration.js';

describe('createDefaultProductDeclaration', () => {
  it('scaffolds a declaration with at least one module, plan, and role', () => {
    const declaration = createDefaultProductDeclaration('demo-product');

    expect(declaration.id).toBe('demo-product');
    expect(declaration.modules.map((module) => module.id)).toContain('demo-product-core');
    expect(declaration.plans.map((plan) => plan.id)).toContain('starter');
    expect(declaration.roles.map((role) => role.key)).toContain('member');
  });

  it('scopes the default plan to the default module', () => {
    const declaration = createDefaultProductDeclaration('demo-product');
    const starterPlan = declaration.plans.find((plan) => plan.id === 'starter');

    expect(starterPlan?.moduleIds).toEqual(['demo-product-core']);
  });
});

describe('validateProductDeclaration', () => {
  it('accepts a well-formed declaration', () => {
    const declaration = createDefaultProductDeclaration('demo-product');

    const result = validateProductDeclaration(declaration);

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a non-kebab-case product id', () => {
    const declaration = createDefaultProductDeclaration('demo-product');
    const invalid: ProductDeclaration = { ...declaration, id: 'Demo_Product' };

    const result = validateProductDeclaration(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('kebab-case'))).toBe(true);
  });

  it('rejects duplicate module ids', () => {
    const declaration = createDefaultProductDeclaration('demo-product');
    const [firstModule] = declaration.modules;
    if (!firstModule) throw new Error('test setup: expected a default module');
    const invalid: ProductDeclaration = {
      ...declaration,
      modules: [...declaration.modules, firstModule],
    };

    const result = validateProductDeclaration(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate module id "demo-product-core".');
  });

  it('rejects a plan referencing a module id that does not exist', () => {
    const declaration = createDefaultProductDeclaration('demo-product');
    const [firstPlan] = declaration.plans;
    if (!firstPlan) throw new Error('test setup: expected a default plan');
    const invalid: ProductDeclaration = {
      ...declaration,
      plans: [{ ...firstPlan, moduleIds: ['unknown-module'] }],
    };

    const result = validateProductDeclaration(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan "starter" references unknown module "unknown-module".');
  });

  it('rejects duplicate role keys', () => {
    const declaration = createDefaultProductDeclaration('demo-product');
    const [firstRole] = declaration.roles;
    if (!firstRole) throw new Error('test setup: expected a default role');
    const invalid: ProductDeclaration = {
      ...declaration,
      roles: [...declaration.roles, firstRole],
    };

    const result = validateProductDeclaration(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate role key "member".');
  });
});
