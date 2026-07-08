import { AxiosError, AxiosHeaders } from 'axios';
import { describe, it, expect } from 'vitest';

import { ServiceError } from './ServiceError';

/** Helper para crear un AxiosError con response */
function createAxiosErrorWithResponse(
  status: number,
  statusText: string,
  url = '/api/v1/test'
): AxiosError {
  const config = { headers: new AxiosHeaders(), url } as AxiosError['config'];
  const response = {
    status,
    statusText,
    data: {},
    headers: {},
    config,
  } as AxiosError['response'];

  const axiosError = new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response);
  return axiosError;
}

/** Helper para crear un AxiosError sin response (error de red) */
function createAxiosNetworkError(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK');
}

/** Helper para crear un AxiosError de timeout */
function createAxiosTimeoutError(): AxiosError {
  return new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED');
}

describe('ServiceError', () => {
  // ─── Constructor y propiedades ─────────────────────────

  describe('constructor', () => {
    it('sets all properties correctly', () => {
      const error = new ServiceError('Not Found', 404, 'ERR_BAD_REQUEST', '/api/v1/items/999');

      expect(error.message).toBe('Not Found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('ERR_BAD_REQUEST');
      expect(error.endpoint).toBe('/api/v1/items/999');
      expect(error.name).toBe('ServiceError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ServiceError);
    });

    it('accepts null for optional fields', () => {
      const error = new ServiceError('Unknown', null, null, null);

      expect(error.status).toBeNull();
      expect(error.code).toBeNull();
      expect(error.endpoint).toBeNull();
    });

    it('preserves original error reference', () => {
      const originalError = new Error('original');
      const error = new ServiceError('Wrapped', 500, null, null, originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  // ─── Helpers de clasificación ──────────────────────────

  describe('isClientError', () => {
    it('returns true for 4xx status codes', () => {
      expect(new ServiceError('', 400, null, null).isClientError).toBe(true);
      expect(new ServiceError('', 404, null, null).isClientError).toBe(true);
      expect(new ServiceError('', 422, null, null).isClientError).toBe(true);
      expect(new ServiceError('', 499, null, null).isClientError).toBe(true);
    });

    it('returns false for non-4xx status codes', () => {
      expect(new ServiceError('', 200, null, null).isClientError).toBe(false);
      expect(new ServiceError('', 500, null, null).isClientError).toBe(false);
      expect(new ServiceError('', null, null, null).isClientError).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('returns true for 5xx status codes', () => {
      expect(new ServiceError('', 500, null, null).isServerError).toBe(true);
      expect(new ServiceError('', 502, null, null).isServerError).toBe(true);
      expect(new ServiceError('', 503, null, null).isServerError).toBe(true);
    });

    it('returns false for non-5xx status codes', () => {
      expect(new ServiceError('', 200, null, null).isServerError).toBe(false);
      expect(new ServiceError('', 404, null, null).isServerError).toBe(false);
      expect(new ServiceError('', null, null, null).isServerError).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('returns true when status is null and code is ERR_NETWORK', () => {
      expect(new ServiceError('', null, 'ERR_NETWORK', null).isNetworkError).toBe(true);
    });

    it('returns false when status exists', () => {
      expect(new ServiceError('', 500, 'ERR_NETWORK', null).isNetworkError).toBe(false);
    });

    it('returns false for other codes without status', () => {
      expect(new ServiceError('', null, 'ECONNABORTED', null).isNetworkError).toBe(false);
    });
  });

  describe('isTimeoutError', () => {
    it('returns true for ECONNABORTED code', () => {
      expect(new ServiceError('', null, 'ECONNABORTED', null).isTimeoutError).toBe(true);
    });

    it('returns false for other codes', () => {
      expect(new ServiceError('', null, 'ERR_NETWORK', null).isTimeoutError).toBe(false);
    });
  });

  describe('specific HTTP status helpers', () => {
    it('isUnauthorized identifies 401', () => {
      expect(new ServiceError('', 401, null, null).isUnauthorized).toBe(true);
      expect(new ServiceError('', 403, null, null).isUnauthorized).toBe(false);
    });

    it('isForbidden identifies 403', () => {
      expect(new ServiceError('', 403, null, null).isForbidden).toBe(true);
      expect(new ServiceError('', 401, null, null).isForbidden).toBe(false);
    });

    it('isNotFound identifies 404', () => {
      expect(new ServiceError('', 404, null, null).isNotFound).toBe(true);
      expect(new ServiceError('', 400, null, null).isNotFound).toBe(false);
    });

    it('isConflict identifies 409', () => {
      expect(new ServiceError('', 409, null, null).isConflict).toBe(true);
      expect(new ServiceError('', 404, null, null).isConflict).toBe(false);
    });

    it('isUnprocessable identifies 422', () => {
      expect(new ServiceError('', 422, null, null).isUnprocessable).toBe(true);
      expect(new ServiceError('', 400, null, null).isUnprocessable).toBe(false);
    });
  });

  // ─── Factory fromAxiosError ────────────────────────────

  describe('fromAxiosError', () => {
    it('extracts status, statusText and endpoint from response errors', () => {
      const axiosError = createAxiosErrorWithResponse(404, 'Not Found', '/api/v1/items/999');

      const error = ServiceError.fromAxiosError(axiosError);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.status).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.isNotFound).toBe(true);
      expect(error.isClientError).toBe(true);
      expect(error.isServerError).toBe(false);
      expect(error.endpoint).toBe('/api/v1/items/999');
      expect(error.originalError).toBe(axiosError);
    });

    it('handles network errors without response', () => {
      const axiosError = createAxiosNetworkError();

      const error = ServiceError.fromAxiosError(axiosError);

      expect(error.status).toBeNull();
      expect(error.isNetworkError).toBe(true);
      expect(error.code).toBe('ERR_NETWORK');
      expect(error.message).toBe('Network Error');
    });

    it('handles timeout errors', () => {
      const axiosError = createAxiosTimeoutError();

      const error = ServiceError.fromAxiosError(axiosError);

      expect(error.isTimeoutError).toBe(true);
      expect(error.code).toBe('ECONNABORTED');
    });

    it('handles 401 unauthorized', () => {
      const axiosError = createAxiosErrorWithResponse(401, 'Unauthorized');

      const error = ServiceError.fromAxiosError(axiosError);

      expect(error.isUnauthorized).toBe(true);
      expect(error.isClientError).toBe(true);
    });

    it('handles 500 server error', () => {
      const axiosError = createAxiosErrorWithResponse(500, 'Internal Server Error');

      const error = ServiceError.fromAxiosError(axiosError);

      expect(error.isServerError).toBe(true);
      expect(error.isClientError).toBe(false);
      expect(error.status).toBe(500);
    });
  });
});
