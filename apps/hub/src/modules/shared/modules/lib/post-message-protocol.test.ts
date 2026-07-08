import { describe, expect, it } from 'vitest';

import { HubToModuleSchema, ModuleToHubSchema } from './post-message-protocol';

describe('HubToModuleSchema', () => {
  it('parses a valid token message', () => {
    const result = HubToModuleSchema.safeParse({
      type: 'corehub.hub.v1.token',
      token: 'eyJhbGciOiJSUzI1NiJ9.test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('corehub.hub.v1.token');
    }
  });

  it('parses a valid signOut message', () => {
    const result = HubToModuleSchema.safeParse({ type: 'corehub.hub.v1.signOut' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown type', () => {
    const result = HubToModuleSchema.safeParse({ type: 'corehub.hub.v1.unknown' });
    expect(result.success).toBe(false);
  });

  it('rejects a token message missing the token field', () => {
    const result = HubToModuleSchema.safeParse({ type: 'corehub.hub.v1.token' });
    expect(result.success).toBe(false);
  });
});

describe('ModuleToHubSchema', () => {
  it('parses a valid ready message', () => {
    const result = ModuleToHubSchema.safeParse({ type: 'corehub.module.v1.ready' });
    expect(result.success).toBe(true);
  });

  it('parses a valid requestToken message', () => {
    const result = ModuleToHubSchema.safeParse({ type: 'corehub.module.v1.requestToken' });
    expect(result.success).toBe(true);
  });

  it('parses a valid error message', () => {
    const result = ModuleToHubSchema.safeParse({
      type: 'corehub.module.v1.error',
      message: 'Something went wrong',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('corehub.module.v1.error');
    }
  });

  it('rejects an error message missing the message field', () => {
    const result = ModuleToHubSchema.safeParse({ type: 'corehub.module.v1.error' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown type', () => {
    const result = ModuleToHubSchema.safeParse({ type: 'corehub.module.v1.unknown' });
    expect(result.success).toBe(false);
  });
});
