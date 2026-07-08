import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as documentService from '../services/document.service';

import { DocumentDownloadButton } from './document-download-button';

vi.mock('../services/document.service.js', () => ({
  getDocumentSignedUrl: vi.fn(),
}));

describe('DocumentDownloadButton', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let windowOpenSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(documentService.getDocumentSignedUrl).mockClear();
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  it('renders with the provided label', () => {
    render(<DocumentDownloadButton documentId="doc-001" label="Descargar factura PDF" />);
    expect(screen.getByRole('button', { name: /Descargar factura PDF/i })).toBeInTheDocument();
  });

  it('calls service and opens window on click', async () => {
    vi.mocked(documentService.getDocumentSignedUrl).mockResolvedValue({
      url: 'https://s3.example.com/doc.pdf',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });

    render(<DocumentDownloadButton documentId="doc-001" label="Descargar factura PDF" />);

    fireEvent.click(screen.getByRole('button', { name: /Descargar factura PDF/i }));

    await waitFor(() => {
      expect(documentService.getDocumentSignedUrl).toHaveBeenCalledWith('doc-001');
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://s3.example.com/doc.pdf',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('shows loading state during fetch (aria-busy)', async () => {
    let resolve: (value: { url: string; expiresAt: string }) => void = () => undefined;
    const pending = new Promise<{ url: string; expiresAt: string }>((res) => {
      resolve = res;
    });
    vi.mocked(documentService.getDocumentSignedUrl).mockReturnValue(pending);

    render(<DocumentDownloadButton documentId="doc-001" label="Descargar factura PDF" />);

    fireEvent.click(screen.getByRole('button', { name: /Descargar factura PDF/i }));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/Generando/i)).toBeInTheDocument();
    });

    // Resolve to clean up
    resolve({
      url: 'https://example.com/doc.pdf',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
  });

  it('shows inline error on service failure', async () => {
    vi.mocked(documentService.getDocumentSignedUrl).mockRejectedValue(new Error('Server error'));

    render(<DocumentDownloadButton documentId="doc-001" label="Descargar factura PDF" />);

    fireEvent.click(screen.getByRole('button', { name: /Descargar factura PDF/i }));

    await waitFor(() => {
      expect(screen.getByText(/No pudimos generar el enlace/i)).toBeInTheDocument();
    });
  });
});
