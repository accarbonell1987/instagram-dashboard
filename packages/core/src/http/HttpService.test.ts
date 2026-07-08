import { describe, it, expect, beforeEach } from 'vitest';

import { createMockAxios, mockResponse } from '../__tests__/helpers/mockAxios';

import { HttpService } from './HttpService';

/**
 * Subclase que expone los métodos protegidos para testing.
 * Solo existe en este archivo de test.
 */
class TestService extends HttpService {
  doGet<T>(path: string, params?: Record<string, unknown>) {
    return this.get<T>(path, params);
  }
  doPost<T>(path: string, data?: unknown) {
    return this.post<T>(path, data);
  }
  doPut<T>(path: string, data?: unknown) {
    return this.put<T>(path, data);
  }
  doPatch<T>(path: string, data?: unknown) {
    return this.patch<T>(path, data);
  }
  doDelete<T>(path: string) {
    return this.delete<T>(path);
  }
  doGetBlob(path: string) {
    return this.getBlob(path);
  }
  doPostForm<T>(path: string, formData: FormData) {
    return this.postForm<T>(path, formData);
  }
}

describe('HttpService', () => {
  let mock: ReturnType<typeof createMockAxios>;
  let service: TestService;
  const BASE_URL = '/api/v1';

  beforeEach(() => {
    mock = createMockAxios();
    service = new TestService(mock.http, BASE_URL);
  });

  // ─── GET ───────────────────────────────────────────────

  describe('get', () => {
    it('calls http.get with baseUrl + path and returns unwrapped data', async () => {
      const data = [{ id: '1', name: 'Item' }];
      mock.mockGet.mockResolvedValueOnce(mockResponse(data));

      const result = await service.doGet('/items');

      expect(mock.mockGet).toHaveBeenCalledWith(`${BASE_URL}/items`, {
        params: undefined,
      });
      expect(result).toEqual(data);
    });

    it('forwards query params', async () => {
      mock.mockGet.mockResolvedValueOnce(mockResponse([]));

      await service.doGet('/items', { page: 1, size: 10 });

      expect(mock.mockGet).toHaveBeenCalledWith(`${BASE_URL}/items`, {
        params: { page: 1, size: 10 },
      });
    });

    it('propagates errors', async () => {
      mock.mockGet.mockRejectedValueOnce(new Error('Network Error'));

      await expect(service.doGet('/items')).rejects.toThrow('Network Error');
    });
  });

  // ─── POST ──────────────────────────────────────────────

  describe('post', () => {
    it('calls http.post with data and returns unwrapped response', async () => {
      const payload = { name: 'New' };
      const created = { id: '1', name: 'New' };
      mock.mockPost.mockResolvedValueOnce(mockResponse(created));

      const result = await service.doPost('/items', payload);

      expect(mock.mockPost).toHaveBeenCalledWith(`${BASE_URL}/items`, payload, undefined);
      expect(result).toEqual(created);
    });

    it('works without body', async () => {
      mock.mockPost.mockResolvedValueOnce(mockResponse(null));

      await service.doPost('/trigger');

      expect(mock.mockPost).toHaveBeenCalledWith(`${BASE_URL}/trigger`, undefined, undefined);
    });
  });

  // ─── PUT ───────────────────────────────────────────────

  describe('put', () => {
    it('calls http.put with data and returns unwrapped response', async () => {
      const payload = { name: 'Updated' };
      mock.mockPut.mockResolvedValueOnce(mockResponse(payload));

      const result = await service.doPut('/items/1', payload);

      expect(mock.mockPut).toHaveBeenCalledWith(`${BASE_URL}/items/1`, payload, undefined);
      expect(result).toEqual(payload);
    });
  });

  // ─── PATCH ─────────────────────────────────────────────

  describe('patch', () => {
    it('calls http.patch with partial data', async () => {
      const partial = { status: 'active' };
      mock.mockPatch.mockResolvedValueOnce(mockResponse(partial));

      const result = await service.doPatch('/items/1', partial);

      expect(mock.mockPatch).toHaveBeenCalledWith(`${BASE_URL}/items/1`, partial, undefined);
      expect(result).toEqual(partial);
    });
  });

  // ─── DELETE ────────────────────────────────────────────

  describe('delete', () => {
    it('calls http.delete and returns unwrapped response', async () => {
      mock.mockDelete.mockResolvedValueOnce(mockResponse(null));

      const result = await service.doDelete('/items/1');

      expect(mock.mockDelete).toHaveBeenCalledWith(`${BASE_URL}/items/1`, undefined);
      expect(result).toBeNull();
    });
  });

  // ─── POST FORM ─────────────────────────────────────────

  describe('postForm', () => {
    it('sends FormData with multipart/form-data header', async () => {
      const form = new FormData();
      form.append('file', 'test-content');
      const expected = { id: ['file-1'] };
      mock.mockPost.mockResolvedValueOnce(mockResponse(expected));

      const result = await service.doPostForm('/upload', form);

      expect(mock.mockPost).toHaveBeenCalledWith(`${BASE_URL}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      expect(result).toEqual(expected);
    });
  });

  // ─── GET BLOB ──────────────────────────────────────────

  describe('getBlob', () => {
    it('calls http.get with responseType blob', async () => {
      const blob = new Blob(['pdf-content'], { type: 'application/pdf' });
      mock.mockGet.mockResolvedValueOnce(mockResponse(blob));

      const result = await service.doGetBlob('/files/doc.pdf');

      expect(mock.mockGet).toHaveBeenCalledWith(`${BASE_URL}/files/doc.pdf`, {
        responseType: 'blob',
      });
      expect(result).toBe(blob);
    });
  });

  // ─── BASE URL COMPOSITION ─────────────────────────────

  describe('baseUrl composition', () => {
    it('handles full URLs as baseUrl', async () => {
      const testService = new TestService(mock.http, 'https://api.example.com/v2');
      mock.mockGet.mockResolvedValueOnce(mockResponse({}));

      await testService.doGet('/entities/123');

      expect(mock.mockGet).toHaveBeenCalledWith(
        'https://api.example.com/v2/entities/123',
        expect.anything()
      );
    });

    it('handles empty path', async () => {
      mock.mockGet.mockResolvedValueOnce(mockResponse([]));

      await service.doGet('');

      expect(mock.mockGet).toHaveBeenCalledWith(BASE_URL, expect.anything());
    });
  });
});
