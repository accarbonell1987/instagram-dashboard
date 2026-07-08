import { describe, it, expect } from 'vitest';

import { getDocumentSignedUrl } from './document.service';

describe('document.service', () => {
  it('returns a URL and an expiresAt ISO string for a valid documentId', async () => {
    const result = await getDocumentSignedUrl('invoice-001');

    expect(result.url).toBeTruthy();
    expect(typeof result.url).toBe('string');
    expect(result.expiresAt).toBeTruthy();
    // expiresAt should be a parseable date string
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(0);
  });

  it('throws an error for a not-found documentId', async () => {
    await expect(getDocumentSignedUrl('not-found')).rejects.toThrow();
  });
});
