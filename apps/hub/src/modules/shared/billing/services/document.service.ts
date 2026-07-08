import { apiFetchWithInterceptors } from '@/lib/api/interceptors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentSignedUrl {
  url: string;
  expiresAt: string;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getDocumentSignedUrl(documentId: string): Promise<DocumentSignedUrl> {
  return apiFetchWithInterceptors<DocumentSignedUrl>(
    `/billing/documents/${documentId}/signed-url`,
    { method: 'GET' }
  );
}
