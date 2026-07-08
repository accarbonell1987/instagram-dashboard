import { describe, it, expect } from 'vitest';

import { buildPasswordSchema, evaluatePasswordChecklist } from './password-policy';
import type { PasswordPolicy } from './password-policy';

const fullPolicy: PasswordPolicy = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
  disallowCommon: true,
};

const minimalPolicy: PasswordPolicy = {
  minLength: 4,
  requireUpper: false,
  requireLower: false,
  requireDigit: false,
  requireSymbol: false,
  disallowCommon: false,
};

describe('buildPasswordSchema', () => {
  it('accepts a password that meets all rules', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('Abc!1234');
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than minLength', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('A!1');
    expect(result.success).toBe(false);
  });

  it('rejects when missing uppercase', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('abc!1234');
    expect(result.success).toBe(false);
  });

  it('rejects when missing lowercase', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('ABC!1234');
    expect(result.success).toBe(false);
  });

  it('rejects when missing digit', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('Abcd!xyz');
    expect(result.success).toBe(false);
  });

  it('rejects when missing symbol', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('Abcd1234');
    expect(result.success).toBe(false);
  });

  it('rejects a common password when disallowCommon is true', () => {
    const schema = buildPasswordSchema(fullPolicy);
    const result = schema.safeParse('password');
    expect(result.success).toBe(false);
  });

  it('accepts anything >= minLength with minimal policy', () => {
    const schema = buildPasswordSchema(minimalPolicy);
    expect(schema.safeParse('abcd').success).toBe(true);
    expect(schema.safeParse('password').success).toBe(true);
  });
});

describe('evaluatePasswordChecklist', () => {
  it('returns failing items for empty password (except disallowCommon — empty is not a common password)', () => {
    const items = evaluatePasswordChecklist(fullPolicy, '');
    expect(items.length).toBe(6);
    // All rules except disallowCommon fail for empty string
    const rulesExpectedToFail = ['minLength', 'requireUpper', 'requireLower', 'requireDigit', 'requireSymbol'];
    for (const rule of rulesExpectedToFail) {
      const item = items.find((i) => i.rule === rule);
      expect(item?.passes, `${rule} should fail for empty string`).toBe(false);
    }
  });

  it('returns passing items for valid password', () => {
    const items = evaluatePasswordChecklist(fullPolicy, 'Abc!1234');
    expect(items.every((i) => i.passes)).toBe(true);
  });

  it('correctly evaluates minLength rule', () => {
    const items = evaluatePasswordChecklist({ ...fullPolicy, minLength: 10 }, 'Short!1A');
    const minItem = items.find((i) => i.rule === 'minLength');
    expect(minItem?.passes).toBe(false);
  });

  it('marks requireUpper passing when uppercase present', () => {
    const items = evaluatePasswordChecklist(fullPolicy, 'Abc!1234');
    const item = items.find((i) => i.rule === 'requireUpper');
    expect(item?.passes).toBe(true);
  });

  it('omits rules not in policy', () => {
    const items = evaluatePasswordChecklist(minimalPolicy, 'test');
    expect(items.length).toBe(1); // only minLength
  });

  it('detects common password', () => {
    const items = evaluatePasswordChecklist(fullPolicy, 'password1');
    const item = items.find((i) => i.rule === 'disallowCommon');
    expect(item?.passes).toBe(false);
  });
});
